import { and, count, eq, ne } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { invitations, profiles, teamMembers, teams } from "@/db/schema";
import type { teamActionSchema, teamSchema } from "@/lib/validation";
import { slugify } from "@/lib/model";
import { lockKey, type Viewer } from "./auth";
import { log, notify } from "./events";
import { Fault, type Tx } from "./http";
import { checkMedia } from "./media";

export async function membership(userId:string,includeInactive=false){const [row]=await db.select({team:teams,role:teamMembers.role}).from(teamMembers).innerJoin(teams,eq(teams.id,teamMembers.teamId)).where(and(eq(teamMembers.userId,userId),includeInactive?undefined:eq(teams.active,true)));return row;}
async function teamLock(tx:Tx,id:string,includeInactive=false){const [row]=await tx.select().from(teams).where(eq(teams.id,id)).for("update");if(!row||(!row.active&&!includeInactive))throw new Fault(404,"Team not found.");return row;}
async function member(tx:Tx,teamId:string,userId:string){const [row]=await tx.select().from(teamMembers).where(and(eq(teamMembers.teamId,teamId),eq(teamMembers.userId,userId)));return row;}
async function leader(tx:Tx,teamId:string,userId:string,captainOnly=false){const row=await member(tx,teamId,userId);if(!row||row.role==="member"||(captainOnly&&row.role!=="captain"))throw new Fault(403,"You don’t have permission to manage this roster.");return row;}
export async function saveTeam(user:Viewer,data:z.output<typeof teamSchema>,id?:string){return db.transaction(async tx=>{
  await checkMedia(tx,user,data.logoId,"team");
  if(id){await teamLock(tx,id);await leader(tx,id,user.id);await tx.update(teams).set({...data,updatedAt:new Date()}).where(eq(teams.id,id));return id;}
  await lockKey(tx,`membership:${user.id}`);
  const [inTeam]=await tx.select({id:teamMembers.teamId}).from(teamMembers).where(eq(teamMembers.userId,user.id));if(inTeam)throw new Fault(409,"Leave your existing team before creating a new one.");
  const slug=`${slugify(data.name).slice(0,68).replace(/-+$/,"")||"squad"}-${data.tag.toLowerCase()}`;
  const [team]=await tx.insert(teams).values({...data,slug}).returning({id:teams.id});await tx.insert(teamMembers).values({teamId:team.id,userId:user.id,role:"captain"});return team.id;
});}
export async function invite(user:Viewer,teamId:string,name:string){return db.transaction(async tx=>{
  const team=await teamLock(tx,teamId);await leader(tx,teamId,user.id);
  const [target]=await tx.select({id:profiles.id}).from(profiles).where(and(eq(profiles.username,name),eq(profiles.suspended,false))).limit(1);
  if(!target)throw new Fault(404,"Eligible player not found.");
  const [inTeam]=await tx.select({team:teamMembers.teamId}).from(teamMembers).where(eq(teamMembers.userId,target.id));if(inTeam)throw new Fault(409,"That player already belongs to a team.");
  const [size]=await tx.select({n:count()}).from(teamMembers).where(eq(teamMembers.teamId,teamId));if(size.n>=12)throw new Fault(409,"This team has reached its roster limit.");
  const [pending]=await tx.select({n:count()}).from(invitations).where(and(eq(invitations.teamId,teamId),eq(invitations.status,"pending")));if(pending.n>=24)throw new Fault(409,"Cancel open invitations before sending another.");
  const [row]=await tx.insert(invitations).values({teamId,userId:target.id,sentBy:user.id}).returning({id:invitations.id});
  await notify(tx,[target.id],"Team invitation",`${team.name} invited you to join their roster.`,"/dashboard/my-team");return row.id;
});}
export async function respondInvite(user:Viewer,id:string,status:"accepted"|"rejected"|"cancelled"){return db.transaction(async tx=>{
  const [pre]=await tx.select({teamId:invitations.teamId,userId:invitations.userId}).from(invitations).where(eq(invitations.id,id));
  if(!pre)throw new Fault(404,"Invitation not found.");
  if(status!=="cancelled"&&pre.userId!==user.id)throw new Fault(404,"Invitation not found.");
  if(status==="accepted")await lockKey(tx,`membership:${user.id}`);
  const team=await teamLock(tx,pre.teamId);
  const [row]=await tx.select().from(invitations).where(eq(invitations.id,id)).for("update");
  if(row?.status!=="pending")throw new Fault(409,"This invitation is no longer pending.");
  if(status==="cancelled")await leader(tx,team.id,user.id);
  if(status==="accepted"){
    const [occupied]=await tx.select({id:teamMembers.teamId}).from(teamMembers).where(eq(teamMembers.userId,user.id));if(occupied)throw new Fault(409,"Leave your existing team before accepting.");
    const [size]=await tx.select({n:count()}).from(teamMembers).where(eq(teamMembers.teamId,team.id));if(size.n>=12)throw new Fault(409,"The team is full.");
    await tx.insert(teamMembers).values({teamId:team.id,userId:user.id,role:"member"});
    await tx.update(invitations).set({status:"cancelled",updatedAt:new Date()}).where(and(eq(invitations.userId,user.id),eq(invitations.status,"pending"),ne(invitations.id,id)));
    const captains=await tx.select({id:teamMembers.userId}).from(teamMembers).where(and(eq(teamMembers.teamId,team.id),ne(teamMembers.role,"member")));
    await notify(tx,captains.map(p=>p.id),"Team invitation accepted",`${user.username} joined ${team.name}.`,"/dashboard/my-team");
  }
  await tx.update(invitations).set({status,updatedAt:new Date()}).where(eq(invitations.id,id));
});}
export async function manageMember(user:Viewer,id:string,data:z.output<typeof teamActionSchema>){return db.transaction(async tx=>{
  if(data.action==="remove")await lockKey(tx,`membership:${data.userId}`);
  const team=await teamLock(tx,id,true);
  const own=await member(tx,id,user.id);if(!own)throw new Fault(403,"You are not on this roster.");
  const target=await member(tx,id,data.userId);if(!target)throw new Fault(404,"Team member not found.");
  const self=user.id===data.userId;
  if(!team.active&&!(self&&data.action==="remove")&&data.action!=="transfer")throw new Fault(409,"A suspended team cannot change its roster except to leave or transfer captaincy.");
  if(data.action==="remove"){
    if(!self&&(own.role==="member"||target.role==="captain"||(own.role==="co_captain"&&target.role!=="member")))throw new Fault(403,"You can’t remove this player.");
    if(target.role==="captain"){
      const [size]=await tx.select({n:count()}).from(teamMembers).where(eq(teamMembers.teamId,id));if(size.n>1)throw new Fault(409,"Transfer captaincy before leaving the team.");
      await tx.update(teams).set({active:false,updatedAt:new Date()}).where(eq(teams.id,id));
      await tx.update(invitations).set({status:"cancelled",updatedAt:new Date()}).where(and(eq(invitations.teamId,id),eq(invitations.status,"pending")));
    }
    await tx.delete(teamMembers).where(and(eq(teamMembers.teamId,id),eq(teamMembers.userId,data.userId)));
    if(!self)await notify(tx,[data.userId],"Team roster updated",`You were removed from ${team.name}.`,"/dashboard/my-team");return;
  }
  if(own.role!=="captain"||self)throw new Fault(403,"Only the captain can assign another member a role.");
  if(data.action==="transfer")await tx.update(teamMembers).set({role:"member"}).where(and(eq(teamMembers.teamId,id),eq(teamMembers.userId,user.id)));
  await tx.update(teamMembers).set({role:data.action==="transfer"?"captain":data.action}).where(and(eq(teamMembers.teamId,id),eq(teamMembers.userId,data.userId)));
});}
export async function moderateTeam(user:Viewer,id:string,active:boolean){return db.transaction(async tx=>{
  const [row]=await tx.select().from(teams).where(eq(teams.id,id)).for("update");if(!row)throw new Fault(404,"Team not found.");
  if(active){const [captain]=await tx.select({id:teamMembers.userId}).from(teamMembers).where(and(eq(teamMembers.teamId,id),eq(teamMembers.role,"captain")));if(!captain)throw new Fault(409,"This team no longer has a captain.");}
  await tx.update(teams).set({active,updatedAt:new Date()}).where(eq(teams.id,id));await log(tx,user.id,active?"team.restore":"team.suspend",id);
});}
