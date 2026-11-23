import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { audit, notifications, profiles, registrationMembers, registrations } from "@/db/schema";
import type { Tx } from "./http";

export async function log(tx:Tx,actorId:string,action:string,target:string,details:object={}){await tx.insert(audit).values({actorId,action,target,details});}
export async function notify(tx:Tx,users:string[],title:string,body:string,link:string){
  const recipients=[...new Set(users)];
  for(let offset=0;offset<recipients.length;offset+=500)await tx.insert(notifications).values(recipients.slice(offset,offset+500).map(userId=>({userId,title,body,link})));
}
export async function notifyMatch(tx:Tx,entryIds:string[],title:string,body:string,link="/dashboard/matches"){
  if(!entryIds.length)return;
  const members=await tx.selectDistinct({userId:registrationMembers.userId}).from(registrationMembers).innerJoin(registrations,eq(registrations.id,registrationMembers.registrationId)).where(and(inArray(registrationMembers.registrationId,entryIds),eq(registrations.status,"approved")));
  await notify(tx,members.map(r=>r.userId),title,body,link);
}
export async function broadcast(tx:Tx,title:string,body:string,tournamentId:string|null){
  const audience=tournamentId ? tx.selectDistinct({userId:registrationMembers.userId}).from(registrationMembers).innerJoin(registrations,eq(registrations.id,registrationMembers.registrationId)).where(and(eq(registrations.tournamentId,tournamentId),ne(registrations.status,"cancelled"),ne(registrations.status,"rejected"))) : tx.select({userId:profiles.id}).from(profiles).where(eq(profiles.suspended,false));
  await tx.insert(notifications).select(tx.select({id:sql<string>`gen_random_uuid()`.as("id"),userId:audience.as("audience").userId,title:sql<string>`${title}::varchar`.as("title"),body:sql<string>`${body}::text`.as("body"),link:sql<string>`'/dashboard/notifications'::varchar`.as("link"),readAt:sql<Date|null>`null::timestamptz`.as("read_at"),createdAt:sql<Date>`now()`.as("created_at")}).from(audience.as("audience")));
}
export const unread = (userId:string)=>and(eq(notifications.userId,userId),isNull(notifications.readAt));
