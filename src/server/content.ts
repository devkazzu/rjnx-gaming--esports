import { and, count, eq, isNull, sql } from "drizzle-orm";
import { cache } from "react";
import type { z } from "zod";
import { db } from "@/db";
import { announcements, games, news, notifications, profiles, reports, settings, tournaments, userRoles } from "@/db/schema";
import { defaults, type SiteSettings } from "@/lib/model";
import { settingsSchema, type announcementSchema, type gameSchema, type newsSchema, type profileSchema, type reportSchema, type reportUpdateSchema, type userAdminSchema } from "@/lib/validation";
import { lockKey, revokeLocal, type Viewer } from "./auth";
import { broadcast, log } from "./events";
import { Fault } from "./http";
import { checkMedia } from "./media";

export async function saveOwnProfile(user:Viewer,data:z.output<typeof profileSchema>){return db.transaction(async tx=>{
  await checkMedia(tx,user,data.avatarId,"avatar");
  await tx.update(profiles).set({...data,updatedAt:new Date()}).where(eq(profiles.id,user.id));
});}
export async function changeUser(user:Viewer,id:string,data:z.output<typeof userAdminSchema>){return db.transaction(async tx=>{
  await lockKey(tx,"staff:role-changes");
  const [roleRow]=await tx.select({role:userRoles.role}).from(userRoles).where(eq(userRoles.userId,id));
  const [row]=await tx.select().from(profiles).where(eq(profiles.id,id)).for("update");if(!row)throw new Fault(404,"User not found.");
  const oldRole=roleRow?.role||"player";
  if(user.id===id&&(data.suspended||oldRole!==data.role))throw new Fault(403,"You can’t suspend yourself or change your own role.");
  if(user.role!=="super_admin"&&(oldRole!=="player"||data.role!==oldRole))throw new Fault(403,"Only a Super Admin can change roles or manage other staff accounts.");
  if(oldRole==="super_admin"&&(data.role!==oldRole||data.suspended)){
    const [admins]=await tx.select({n:count()}).from(userRoles).innerJoin(profiles,eq(profiles.id,userRoles.userId)).where(and(eq(userRoles.role,"super_admin"),eq(profiles.suspended,false)));
    if(admins.n<=1)throw new Fault(409,"At least one active Super Admin is required.");
  }
  await tx.update(profiles).set({fullName:data.fullName,country:data.country,suspended:data.suspended,updatedAt:new Date()}).where(eq(profiles.id,id));
  await tx.insert(userRoles).values({userId:id,role:data.role}).onConflictDoUpdate({target:userRoles.userId,set:{role:data.role,updatedAt:new Date()}});
  if(data.suspended)await revokeLocal(tx,id);
  await log(tx,user.id,"user.update",id,{fromRole:oldRole,toRole:data.role,suspended:data.suspended});
});}
export async function saveGame(user:Viewer,data:z.output<typeof gameSchema>){return db.transaction(async tx=>{const [row]=await tx.insert(games).values(data).returning({id:games.id});await log(tx,user.id,"game.create",row.id,{slug:data.slug});return row.id;});}
export async function saveNews(user:Viewer,data:z.output<typeof newsSchema>,id?:string){return db.transaction(async tx=>{
  await checkMedia(tx,user,data.imageId,"news");
  const [row]=id?await tx.update(news).set({...data,updatedAt:new Date()}).where(eq(news.id,id)).returning({id:news.id}):await tx.insert(news).values({...data,authorId:user.id}).returning({id:news.id});
  if(!row)throw new Fault(404,"Article not found."); await log(tx,user.id,id?"news.update":"news.create",row.id,{slug:data.slug,publishedAt:data.publishedAt});return row.id;
});}
export async function unpublishNews(user:Viewer,id:string){return db.transaction(async tx=>{
  const [row]=await tx.update(news).set({publishedAt:null,updatedAt:new Date()}).where(eq(news.id,id)).returning({id:news.id});if(!row)throw new Fault(404,"Article not found.");await log(tx,user.id,"news.unpublish",id);
});}
export async function saveAnnouncement(user:Viewer,data:z.output<typeof announcementSchema>,id?:string){return db.transaction(async tx=>{
  const {send,...values}=data;
  if(data.tournamentId){const [event]=await tx.select({id:tournaments.id}).from(tournaments).where(eq(tournaments.id,data.tournamentId));if(!event)throw new Fault(422,"Choose an existing event.");}
  const sentAt=send?new Date():null;
  const [row]=id?await tx.update(announcements).set({...values,sentAt,updatedAt:new Date()}).where(and(eq(announcements.id,id),isNull(announcements.sentAt))).returning({id:announcements.id}):await tx.insert(announcements).values({...values,authorId:user.id,sentAt}).returning({id:announcements.id});
  if(!row)throw new Fault(409,"This announcement was already sent or removed.");
  if(send)await broadcast(tx,data.title,data.body,data.tournamentId);
  await log(tx,user.id,send?"announcement.send":"announcement.save",row.id,{event:data.tournamentId});return row.id;
});}
export async function newReport(user:Viewer|null,data:z.output<typeof reportSchema>){const [row]=await db.insert(reports).values({...data,userId:user?.id,email:user?.email||data.email}).returning({id:reports.id});return row.id;}
export async function updateReport(user:Viewer,id:string,data:z.output<typeof reportUpdateSchema>){return db.transaction(async tx=>{
  const [row]=await tx.update(reports).set({...data,handledBy:user.id,updatedAt:new Date()}).where(eq(reports.id,id)).returning({id:reports.id});if(!row)throw new Fault(404,"Report not found.");await log(tx,user.id,"report.update",id,{status:data.status});
});}
export const siteSettings=cache(async ():Promise<SiteSettings>=>{const [row]=await db.select({value:settings.value}).from(settings).where(eq(settings.key,"site"));const result=settingsSchema.safeParse(row?.value);return result.success?result.data:defaults;});
export async function updateSettings(user:Viewer,value:SiteSettings){return db.transaction(async tx=>{await checkMedia(tx,user,value.heroId,"site");await tx.insert(settings).values({key:"site",value}).onConflictDoUpdate({target:settings.key,set:{value,updatedAt:new Date()}});await log(tx,user.id,"settings.update","site");});}
export async function markNotice(userId:string,id?:string){await db.update(notifications).set({readAt:sql`coalesce(${notifications.readAt},now())`}).where(and(eq(notifications.userId,userId),id?eq(notifications.id,id):isNull(notifications.readAt)));}
