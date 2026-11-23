import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { db } from "@/db";
import { accounts, profiles, sessions, userRoles } from "@/db/schema";
import { localEnabled, supabaseConfig, supabaseServer } from "@/lib/supabase";
import { can, STAFF, type Role } from "@/lib/model";
import { username as usernameSchema } from "@/lib/validation";
import { address, cookieOptions, digest, Fault, limit, requestOrigin, type Tx } from "./http";
import type { z } from "zod";
import type { authSchema } from "@/lib/validation";

export const LOCAL_COOKIE="rjnx_session";
export const RECOVERY_COOKIE="rjnx_recovery";
const ttl=14*24*3600;
function recoverySignature(userId:string,expires:number){const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)throw new Fault(503,"Hosted password recovery needs the configured server secret.");return createHmac("sha256",secret).update(`rjnx:recovery:${userId}:${expires}`).digest("hex");}
export async function grantRecovery(request:Request,userId:string){const expires=Math.floor(Date.now()/1000)+900;const value=`${userId}.${expires}.${recoverySignature(userId,expires)}`;(await cookies()).set(RECOVERY_COOKIE,value,{...cookieOptions(request),maxAge:900});}
function allowsRecovery(value:string|undefined,id:string){const [subject,expiry,signature,extra]=(value||"").split(".");const expires=Number(expiry);const now=Math.floor(Date.now()/1000);if(subject!==id||!signature||extra||!/^[a-f0-9]{64}$/.test(signature)||!Number.isInteger(expires)||expires<now||expires>now+900)return false;return timingSafeEqual(Buffer.from(signature,"hex"),Buffer.from(recoverySignature(id,expires),"hex"));}
type Login = z.output<typeof authSchema>;
const profileFields={id:profiles.id,username:profiles.username,fullName:profiles.fullName,avatarId:profiles.avatarId,country:profiles.country,bio:profiles.bio,favoriteGame:profiles.favoriteGame,ign:profiles.ign,experience:profiles.experience,createdAt:profiles.createdAt,suspended:profiles.suspended,lastActiveAt:profiles.lastActiveAt,role:userRoles.role};
export type Viewer=Omit<typeof profiles.$inferSelect,"updatedAt"> & {role:Role;email:string};
async function provision(user:User) {
  const requested=usernameSchema.safeParse(user.user_metadata?.username);
  for (const candidate of [...(requested.success?[requested.data]:[]),`player_${user.id.replace(/-/g,"").slice(0,14)}`,`player_${randomBytes(8).toString("hex")}`]) {
    const exists=await db.transaction(async tx=>{
      const [row]=await tx.insert(profiles).values({id:user.id,username:candidate}).onConflictDoNothing().returning({id:profiles.id});
      if(row){await tx.insert(userRoles).values({userId:user.id,role:"player"}).onConflictDoNothing();return true;}
      const [existing]=await tx.select({id:profiles.id}).from(profiles).where(eq(profiles.id,user.id));return !!existing;
    });
    if(exists)return;
  }
  throw new Fault(409,"Couldn’t assign a player handle. Try signing in again.");
}
async function profileFor(id:string,email:string):Promise<Viewer|null> {
  const [row]=await db.select(profileFields).from(profiles).leftJoin(userRoles,eq(profiles.id,userRoles.userId)).where(eq(profiles.id,id)).limit(1);
  if(!row||row.suspended)return null;
  if(!row.lastActiveAt||+row.lastActiveAt<Date.now()-15*60_000)await db.update(profiles).set({lastActiveAt:new Date()}).where(and(eq(profiles.id,id),or(isNull(profiles.lastActiveAt),lt(profiles.lastActiveAt,new Date(Date.now()-15*60_000)))));
  return {...row,role:row.role??"player",email};
}
export const viewer=cache(async ():Promise<Viewer|null>=>{
  const jar=await cookies();
  if(supabaseConfig()) {
    if(!jar.getAll().some(c=>c.name.startsWith("sb-")&&c.name.includes("-auth-token")))return null;
    const client=await supabaseServer();
    const {data,error}=await client!.auth.getUser();
    if(error||!data.user?.email_confirmed_at||!data.user.email)return null;
    const [exists]=await db.select({id:profiles.id}).from(profiles).where(eq(profiles.id,data.user.id)).limit(1);
    if(!exists)await provision(data.user);
    return profileFor(data.user.id,data.user.email);
  }
  if(!localEnabled())return null;
  const token=jar.get(LOCAL_COOKIE)?.value;
  if(!token||!/^[-_a-zA-Z0-9]{43}$/.test(token))return null;
  const [row]=await db.select({uid:sessions.userId,email:accounts.email}).from(sessions).innerJoin(accounts,eq(accounts.userId,sessions.userId)).where(and(eq(sessions.hash,digest(token)),gt(sessions.expiresAt,new Date()))).limit(1);
  return row?profileFor(row.uid,row.email):null;
});
export async function identity(roles?:readonly Role[]) {
  const user=await viewer(); if(!user)throw new Fault(401,"Sign in to continue.");
  if(roles&&!can(user.role,roles))throw new Fault(403,"You don’t have permission to do that.");
  return user;
}
export async function pageIdentity(admin=false) {
  const user=await viewer(); if(!user)redirect(admin?"/login?next=/admin":"/login?next=/dashboard");
  if(admin&&!can(user.role,STAFF))redirect("/dashboard?notice=restricted");
  return user;
}
function derive(password:string,salt:Buffer) { return new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(e,v)=>e?reject(e):resolve(v))); }
async function hash(password:string){const salt=randomBytes(16);return `s1:${salt.toString("hex")}:${(await derive(password,salt)).toString("hex")}`;}
async function matches(password:string,stored?:string){const valid=!!stored&&/^s1:[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored);const [,salt,target]=(valid?stored!:"s1:"+"0".repeat(32)+":"+"0".repeat(128)).split(":");return timingSafeEqual(await derive(password,Buffer.from(salt,"hex")),Buffer.from(target,"hex"))&&valid;}
async function issue(tx:Tx,id:string){const value=randomBytes(32).toString("base64url");await tx.insert(sessions).values({userId:id,hash:digest(value),expiresAt:new Date(Date.now()+ttl*1000)});return value;}
async function clearLocal(request:Request){const jar=await cookies();const token=jar.get(LOCAL_COOKIE)?.value;if(token)await db.delete(sessions).where(eq(sessions.hash,digest(token)));jar.set(LOCAL_COOKIE,"",{...cookieOptions(request),maxAge:0});}
const authError=(e:{status?:number})=>{if(e.status===429)throw new Fault(429,"Too many attempts. Try again later.");if(!e.status||e.status>=500)throw new Fault(503,"The identity provider is temporarily unavailable.");};
export async function authenticate(request:Request, data:Login){
  if(data.action!=="logout")await limit(`auth.ip:${address(request)}`,address(request)==="shared"?150:30,900);
  if("email" in data)await limit(`auth.email:${data.action}:${data.email}`,data.action==="login"?12:6,900);
  const jar=await cookies();
  const sb=await supabaseServer(request);
  if(sb) {
    if(data.action==="register"){
      const [taken]=await db.select({id:profiles.id}).from(profiles).where(eq(profiles.username,data.username)).limit(1);
      if(taken)throw new Fault(409,"That player handle is already in use.");
      const {error}=await sb.auth.signUp({email:data.email,password:data.password,options:{data:{username:data.username},emailRedirectTo:`${requestOrigin(request)}/auth/confirm`}});
      if(error){authError(error);throw new Fault(422,"Couldn’t create the account. Check your information or try signing in.");}
      return {message:"Check your email to verify your account before signing in."};
    }
    if(data.action==="login"){
      const {data:auth,error}=await sb.auth.signInWithPassword({email:data.email,password:data.password});
      if(error){authError(error);throw new Fault(401,error.code==="email_not_confirmed"?"Verify your email before signing in.":"Email or password is incorrect.");}
      if(!auth.user.email_confirmed_at){await sb.auth.signOut({scope:"local"});throw new Fault(401,"Verify your email before signing in.");}
      await provision(auth.user);
      if(!await profileFor(auth.user.id,data.email)){await sb.auth.signOut({scope:"local"});throw new Fault(403,"This account is suspended.");}
      return {redirect:"/dashboard"};
    }
    if(data.action==="logout"){const {error}=await sb.auth.signOut({scope:"local"});if(error&&error.name!=="AuthSessionMissingError")authError(error);jar.set(RECOVERY_COOKIE,"",{...cookieOptions(request),maxAge:0});return {redirect:"/"};}
    if(data.action==="forgot"){
      const {error}=await sb.auth.resetPasswordForEmail(data.email,{redirectTo:`${requestOrigin(request)}/auth/confirm`});if(error)authError(error);
      return {message:"If the email belongs to an account, a recovery link will arrive shortly."};
    }
    const {data:auth}=await sb.auth.getUser();
    if(!auth.user||!allowsRecovery(jar.get(RECOVERY_COOKIE)?.value,auth.user.id))throw new Fault(403,"Open a valid password recovery link first.");
    const {error}=await sb.auth.updateUser({password:data.password});if(error){authError(error);throw new Fault(422,"Couldn’t update your password. Request a fresh link and try again.");}
    await sb.auth.signOut({scope:"global"});jar.set(RECOVERY_COOKIE,"",{...cookieOptions(request),maxAge:0});return {redirect:"/login?notice=reset"};
  }
  if(!localEnabled())throw new Fault(503,"Authentication is not configured. Set up Supabase to continue.");
  if(data.action==="forgot"||data.action==="reset")throw new Fault(503,"Email verification and recovery require Supabase email delivery. This local workspace does not send email.");
  if(data.action==="logout"){await clearLocal(request);return {redirect:"/"};}
  let token:string;
  if(data.action==="register"){
    const credential=await hash(data.password);
    token=await db.transaction(async tx=>{const [user]=await tx.insert(profiles).values({username:data.username}).returning({id:profiles.id});await tx.insert(accounts).values({userId:user.id,email:data.email,passwordHash:credential});await tx.insert(userRoles).values({userId:user.id,role:"player"});return issue(tx,user.id);});
  }else{
    const [row]=await db.select({id:accounts.userId,hash:accounts.passwordHash,suspended:profiles.suspended}).from(accounts).innerJoin(profiles,eq(profiles.id,accounts.userId)).where(eq(accounts.email,data.email)).limit(1);
    if(!await matches(data.password,row?.hash)||!row)throw new Fault(401,"Email or password is incorrect.");
    if(row.suspended)throw new Fault(403,"This account is suspended.");
    token=await db.transaction(tx=>issue(tx,row.id));
  }
  await clearLocal(request);jar.set(LOCAL_COOKIE,token,{...cookieOptions(request),maxAge:ttl});return {redirect:"/dashboard"};
}
export async function revokeLocal(tx:Tx,userId:string){await tx.delete(sessions).where(eq(sessions.userId,userId));}
export async function lockActiveUser(tx:Tx,userId:string) {
  const [row]=await tx.select({id:profiles.id}).from(profiles).where(and(eq(profiles.id,userId),eq(profiles.suspended,false))).for("update");
  if(!row) throw new Fault(403,"Account no longer available.");
}
export function lockKey(tx:Tx,key:string){return tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);}
