import { z } from "zod";
import { FORMATS, MATCH_STATES, MODES, PLATFORMS, REG_STATES, ROLES, STATUSES } from "./model";
const safe = (min:number,max:number) => z.string().trim().min(min).max(max).refine(s=>!s.includes("\0"),"Remove invalid characters.");
export const id = z.uuid();
export const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,"Use lowercase letters, numbers and hyphens.").max(90);
export const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/,"Use 3–24 lowercase letters, numbers or underscores.");
export const email = z.string().trim().max(254).toLowerCase().pipe(z.email());
const password = z.string().min(12,"Use at least 12 characters.").max(128);
const optionalFile = id.nullable().default(null);
const datetime = z.iso.datetime({offset:true}).transform(s=>new Date(s));
const int = (min:number,max:number) => z.coerce.number().int().min(min).max(max);
export const authSchema = z.discriminatedUnion("action", [
  z.object({action:z.literal("register"),email,password,username}),
  z.object({action:z.literal("login"),email,password:z.string().min(1).max(128)}),
  z.object({action:z.literal("forgot"),email}),
  z.object({action:z.literal("reset"),password}),
  z.object({action:z.literal("logout")}),
]);
export const profileSchema = z.object({ username, fullName:safe(0,80), country:safe(0,60), bio:safe(0,1000), favoriteGame:safe(0,60), ign:safe(0,64), experience:safe(0,50), avatarId:optionalFile });
export const gameSchema = z.object({ name:safe(2,80),slug:slug.refine(s=>s.length<=60) });
const placements = z.record(z.string().regex(/^[1-9]\d{0,2}$/),int(0,1000)).refine(o=>Object.keys(o).length<=128 && Object.keys(o).every(k=>Number(k)<=512));
export const scoringSchema = z.object({placements,killPoints:int(0,100),winPoints:int(0,100),bonusMax:int(0,1000),penaltyMax:int(0,1000)});
export const tournamentSchema = z.object({title:safe(3,100),slug,gameId:id,description:safe(10,8000),rules:safe(10,12000),format:z.enum(FORMATS),mode:z.enum(MODES),squadSize:int(1,8),status:z.enum(STATUSES),season:safe(1,40),prize:safe(0,100),platform:z.enum(PLATFORMS),capacity:int(2,512),regStart:datetime,regEnd:datetime,startsAt:datetime,endsAt:datetime,featured:z.boolean().default(false),bannerId:optionalFile,logoId:optionalFile,scoring:scoringSchema}).superRefine((v,c)=>{
  if (!(v.regStart<v.regEnd && v.regEnd<=v.startsAt && v.startsAt<v.endsAt)) c.addIssue({code:"custom",path:["regEnd"],message:"Dates must progress from registration opening to registration closing, then event start and end."});
  if ((v.mode==="solo" && v.squadSize!==1)||(v.mode==="duo" && v.squadSize!==2)||(v.mode==="squad" && v.squadSize<3)) c.addIssue({code:"custom",path:["squadSize"],message:"Choose 1 for solo, 2 for duo, or 3–8 for a squad."});
});
export const registrationSchema = z.object({tournamentId:id,teamId:id.nullable(), rulesAccepted:z.literal(true),players:z.array(z.object({id,ign:safe(1,64)})).min(1).max(8),note:safe(0,500)});
export const reviewSchema = z.object({status:z.enum(REG_STATES).exclude(["pending"]),reviewNote:safe(0,500)});
export const teamSchema = z.object({name:safe(2,70),tag:z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/,"Use 2–6 letters or numbers."),description:safe(0,1500),logoId:optionalFile});
export const inviteSchema = z.object({username});
export const teamActionSchema = z.object({action:z.enum(["remove","co_captain","member","transfer"]),userId:id});
export const invitationSchema = z.object({status:z.enum(["accepted","rejected","cancelled"])});
export const matchSchema = z.object({tournamentId:id,title:safe(2,100),number:int(1,10000),round:safe(1,50),scheduledAt:datetime,status:z.enum(MATCH_STATES).exclude(["completed"]),instructions:safe(0,3000),roomId:safe(0,100),password:safe(0,100),released:z.boolean(),entries:z.array(id).min(2).max(128)}).refine(v=>!v.released || !!v.roomId,{path:["roomId"],message:"A room ID is required before releasing details."});
export const matchResultSchema = z.object({entries:z.array(z.object({registrationId:id,position:int(1,512),kills:int(0,999),bonus:int(0,1000),penalty:int(0,1000),proofId:optionalFile})).min(2).max(128)});
export const userAdminSchema = z.object({fullName:safe(0,80),country:safe(0,60),suspended:z.boolean(),role:z.enum(ROLES)});
export const newsSchema = z.object({title:safe(3,125),slug,summary:safe(5,280),content:safe(15,20000),category:safe(2,50),tags:z.array(safe(1,30)).max(12),imageId:optionalFile,publishedAt:datetime.nullable()});
export const announcementSchema = z.object({title:safe(3,120),body:safe(5,3000),tournamentId:id.nullable(),send:z.boolean()});
export const reportSchema = z.object({email,subject:safe(3,120),body:safe(10,4000)});
export const reportUpdateSchema = z.object({status:z.enum(["open","reviewing","resolved"]),response:safe(0,3000)});
export const settingsSchema = z.object({heroId:optionalFile,tagline:safe(3,75),homepageNote:safe(15,400),communityUrl:z.string().max(250).refine(s=>s===""||/^https:\/\/[^\s]+$/i.test(s)),faqs:z.array(z.object({q:safe(5,150),a:safe(10,800)})).min(1).max(15)});
