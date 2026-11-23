import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { ZodType } from "zod";
import { db } from "@/db";
import { rate } from "@/db/schema";
import { id } from "@/lib/validation";

export class Fault extends Error { constructor(public status:number,message:string,public retry?:number){super(message);} }
export function errorCode(error:unknown):string|undefined {
  if (!error || typeof error!=="object") return;
  if ("code" in error && typeof error.code==="string") return error.code;
  if ("cause" in error && error.cause!==error) return errorCode(error.cause);
}
export const digest = (value:string) => createHash("sha256").update(value).digest("hex");
export const originConfig = () => process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_ORIGIN || "";
export function sameOrigin(request:Request) {
  const origin=request.headers.get("origin"); const site=request.headers.get("sec-fetch-site");
  if (site==="cross-site") throw new Fault(403,"This request must come from RJNX.");
  if (!origin) return; // Non-browser clients don't send an Origin; auth is still required on protected routes.
  try {
    const received=new URL(origin); const config=originConfig();
    if (config ? received.origin===new URL(config).origin : received.origin===new URL(request.url).origin || received.host===request.headers.get("host") || site==="same-origin") return;
  } catch { /* Reject malformed origins. */ }
  throw new Fault(403,"This request must come from RJNX.");
}
export function requestOrigin(request:Request) {
  return originConfig() ? new URL(originConfig()).origin : new URL(request.headers.get("origin") || request.url).origin;
}
export function cookieOptions(request:Request) {
  const secure = originConfig().startsWith("https://") || request.url.startsWith("https://") || request.headers.get("origin")?.startsWith("https://") || request.headers.get("x-forwarded-proto")==="https";
  const embedded=!!secure&&!originConfig();
  return { httpOnly:true, path:"/", secure:!!secure,sameSite:embedded ? "none" as const:"lax" as const, partitioned:embedded };
}
export function reply(data:unknown,status=200,extra?:HeadersInit) {
  const headers=new Headers(extra); headers.set("Cache-Control","private, no-store"); return Response.json(data,{status,headers});
}
export function failure(error:unknown,operation:string) {
  if (error instanceof Fault) return reply({error:error.message},error.status,error.retry ? {"Retry-After":String(error.retry)}:undefined);
  const code=errorCode(error);
  if (code==="23505") return reply({error:"That name, identifier, or entry is already in use."},409);
  if (code==="23503"||code==="23514") return reply({error:"One of the selected values is no longer valid."},422);
  console.error("[rjnx] request failed",{operation,code:code||"internal"}); return reply({error:"The arena couldn’t process that request. Try again."},500);
}
export function uuid(value:unknown) { const checked=id.safeParse(value); if(!checked.success)throw new Fault(404,"Record not found.");return checked.data; }
export async function bodyBytes(request:Request,limit:number) {
  const length=request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length)||Number(length)>limit)) throw new Fault(413,"This request exceeds the upload limit.");
  const reader=request.body?.getReader(); if(!reader)throw new Fault(400,"A request body is required.");
  const chunks:Uint8Array[]=[]; let size=0;
  try {for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel().catch(()=>{});throw new Fault(413,"This request exceeds the upload limit.");}chunks.push(part.value);}}
  finally {reader.releaseLock();}
  return Buffer.concat(chunks,size);
}
export async function input<T>(request:Request,schema:ZodType<T>) {
  if(request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")throw new Fault(415,"Send an application/json request.");
  const buffer=await bodyBytes(request,384*1024); let parsed:unknown;
  try {parsed=JSON.parse(buffer.toString("utf8"));}catch{throw new Fault(400,"Invalid JSON request.");}
  const checked=schema.safeParse(parsed); if(!checked.success){const issue=checked.error.issues[0];throw new Fault(422,`${issue.path.join(".") ? issue.path.join(".")+": " : ""}${issue.message}`);}
  return checked.data;
}
export async function limit(key:string,max:number,period=60) {
  const now=Math.floor(Date.now()/1000), boundary=Math.floor(now/period)*period;
  const [row]=await db.insert(rate).values({key:digest(key),hits:1,window:boundary}).onConflictDoUpdate({target:rate.key,set:{window:sql`greatest(${rate.window},excluded."window")`,hits:sql`case when ${rate.window}<excluded."window" then 1 else ${rate.hits}+1 end`}}).returning({hits:rate.hits});
  if(row.hits>max)throw new Fault(429,"Too many attempts. Please try again shortly.",boundary+period-now);
}
export function address(request:Request) {
  const hosted=process.env.VERCEL==="1" ? request.headers.get("x-vercel-forwarded-for") : null;
  return (hosted || (process.env.TRUST_PROXY==="1" ? request.headers.get("x-real-ip") : null) || "shared").slice(0,120);
}
export type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
