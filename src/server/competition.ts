import { and, count, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { games, matches, matchParticipants, matchResults, matchRooms, profiles, registrationMembers, registrations, resultHistory, scoring, teamMembers, teams, tournaments } from "@/db/schema";
import { verifyWindow, type Status } from "@/lib/model";
import type { matchResultSchema, matchSchema, registrationSchema, reviewSchema, tournamentSchema } from "@/lib/validation";
import type { Viewer } from "./auth";
import { log, notify, notifyMatch } from "./events";
import { Fault, type Tx } from "./http";
import { checkMedia } from "./media";

type TournamentInput=z.output<typeof tournamentSchema>;
type RegInput=z.output<typeof registrationSchema>;
type Review=z.output<typeof reviewSchema>;
type MatchInput=z.output<typeof matchSchema>;
type Results=z.output<typeof matchResultSchema>;
const activeEntries=["pending","approved"] as const;
const transitions:Record<Status,readonly Status[]>={draft:["draft","upcoming","open","archived"],upcoming:["upcoming","open","closed","cancelled","archived"],open:["open","closed","cancelled"],closed:["closed","open","ongoing","cancelled"],ongoing:["ongoing","completed","cancelled"],completed:["completed","archived"],cancelled:["cancelled","archived"],archived:["archived"]};
const verifyRules = (v:typeof scoring.$inferSelect, entry:Results["entries"][number]) => (v.placements[String(entry.position)]||0)+entry.kills*v.killPoints+(entry.position===1?v.winPoints:0)+entry.bonus-entry.penalty;

async function lockTournament(tx:Tx,id:string) {
  const [row]=await tx.select().from(tournaments).where(eq(tournaments.id,id)).for("update"); if(!row)throw new Fault(404,"Tournament not found.");return row;
}
export async function saveTournament(user:Viewer,data:TournamentInput,id?:string){
  return db.transaction(async tx=>{
    const {scoring:rules,...event}=data;
    const [game]=await tx.select({id:games.id}).from(games).where(eq(games.id,data.gameId)); if(!game)throw new Fault(422,"Select a valid game.");
    await checkMedia(tx,user,event.bannerId,"tournament");await checkMedia(tx,user,event.logoId,"tournament");
    if(!id){
      if(!["draft","upcoming","open"].includes(data.status))throw new Fault(422,"New tournaments start as draft, upcoming or registration open.");
      const [row]=await tx.insert(tournaments).values({...event,createdBy:user.id}).returning({id:tournaments.id});
      await tx.insert(scoring).values({...rules,tournamentId:row.id});
      await log(tx,user.id,"tournament.create",row.id,{status:event.status,slug:event.slug});return row.id;
    }
    const old=await lockTournament(tx,id);
    if(!transitions[old.status].includes(event.status))throw new Fault(409,`That status is not available from ${old.status}.`);
    const [entries]=await tx.select({n:count()}).from(registrations).where(and(eq(registrations.tournamentId,id),inArray(registrations.status,[...activeEntries])));
    if(entries.n>event.capacity)throw new Fault(409,"Capacity cannot be lower than active entries.");
    if(entries.n>0&&(old.gameId!==event.gameId||old.mode!==event.mode||old.squadSize!==event.squadSize))throw new Fault(409,"Game and roster size cannot change once entries have been received.");
    const scheduled=await tx.select({id:matches.id,at:matches.scheduledAt,status:matches.status}).from(matches).where(eq(matches.tournamentId,id));
    if(scheduled.some(m=>m.status!=="cancelled"&&(m.at<event.startsAt||m.at>event.endsAt)))throw new Fault(409,"Move existing matches before changing the tournament dates.");
    if(event.status==="completed"&&old.status!=="completed"&&(!scheduled.some(m=>m.status==="completed")||scheduled.some(m=>m.status!=="completed"&&m.status!=="cancelled")))throw new Fault(409,"Publish all active match results before completing the tournament.");
    if(event.status==="cancelled"&&old.status!=="cancelled"){
      const [verified]=await tx.select({id:matches.id}).from(matches).where(and(eq(matches.tournamentId,id),isNotNull(matches.publishedAt))).limit(1);
      if(verified)throw new Fault(409,"An event with published scores can’t be cancelled. Complete and archive it instead.");
      await tx.update(matches).set({status:"cancelled",updatedAt:new Date()}).where(eq(matches.tournamentId,id));
      const rows=await tx.update(registrations).set({status:"cancelled",reviewNote:"Tournament cancelled",updatedAt:new Date()}).where(and(eq(registrations.tournamentId,id),inArray(registrations.status,[...activeEntries]))).returning({id:registrations.id});
      if(rows.length){const members=await tx.select({id:registrationMembers.userId}).from(registrationMembers).where(inArray(registrationMembers.registrationId,rows.map(r=>r.id))); await notify(tx,members.map(r=>r.id),`${old.title} was cancelled`,"This event will no longer take place.","/dashboard/my-tournaments");}
    }
    const [hasResult]=await tx.select({id:matchResults.id}).from(matchResults).innerJoin(matches,eq(matches.id,matchResults.matchId)).where(eq(matches.tournamentId,id)).limit(1);
    const [oldRules]=await tx.select().from(scoring).where(eq(scoring.tournamentId,id));
    if(hasResult&&oldRules&&(rules.killPoints!==oldRules.killPoints||rules.winPoints!==oldRules.winPoints||rules.bonusMax!==oldRules.bonusMax||rules.penaltyMax!==oldRules.penaltyMax||JSON.stringify(rules.placements)!==JSON.stringify(oldRules.placements)))throw new Fault(409,"Scoring is locked once results have been entered.");
    await tx.update(tournaments).set({...event,updatedAt:new Date()}).where(eq(tournaments.id,id));
    await tx.insert(scoring).values({...rules,tournamentId:id}).onConflictDoUpdate({target:scoring.tournamentId,set:{...rules,updatedAt:new Date()}});
    await log(tx,user.id,"tournament.update",id,{from:old.status,to:event.status,slug:event.slug});return id;
  });
}
export async function archiveTournament(user:Viewer,id:string){return db.transaction(async tx=>{
  const bracket=await lockTournament(tx,id);
  if(!["draft","upcoming","completed","cancelled","archived"].includes(bracket.status))throw new Fault(409,"Conclude or cancel the tournament before archiving it.");
  await tx.update(tournaments).set({status:"archived",featured:false,updatedAt:new Date()}).where(eq(tournaments.id,id));await log(tx,user.id,"tournament.archive",id);
});}
export async function applyTournament(user:Viewer,data:RegInput){return db.transaction(async tx=>{
  const bracket=await lockTournament(tx,data.tournamentId);
  if(!verifyWindow(bracket.status,bracket.regStart,bracket.regEnd))throw new Fault(409,"Registration is not open for this event.");
  const playerIds=[...new Set(data.players.map(p=>p.id))];
  if(playerIds.length!==data.players.length||playerIds.length!==bracket.squadSize||!playerIds.includes(user.id))throw new Fault(422,`Enter exactly ${bracket.squadSize} distinct eligible player${bracket.squadSize===1?"":"s"}, including yourself.`);
  if(bracket.mode==="solo") {if(data.teamId||playerIds[0]!==user.id)throw new Fault(422,"This event is solo.");}
  else {
    if(!data.teamId)throw new Fault(422,"Select an eligible team first.");
    const [team]=await tx.select({active:teams.active}).from(teams).where(eq(teams.id,data.teamId)).for("update");
    if(!team?.active)throw new Fault(404,"Team not found.");
    const roster=await tx.select({id:teamMembers.userId,role:teamMembers.role}).from(teamMembers).where(eq(teamMembers.teamId,data.teamId));
    if(!roster.some(p=>p.id===user.id&&p.role!=="member"))throw new Fault(403,"Only a captain or co-captain can submit a team entry.");
    if(!playerIds.every(id=>roster.some(p=>p.id===id)))throw new Fault(422,"Only accepted team members can enter.");
  }
  const eligible=await tx.select({id:profiles.id}).from(profiles).where(and(inArray(profiles.id,playerIds),eq(profiles.suspended,false)));
  if(eligible.length!==playerIds.length)throw new Fault(422,"At least one player is not eligible.");
  const [existing]=await tx.select({id:registrations.id}).from(registrations).innerJoin(registrationMembers,eq(registrationMembers.registrationId,registrations.id)).where(and(eq(registrations.tournamentId,bracket.id),inArray(registrations.status,[...activeEntries]),inArray(registrationMembers.userId,playerIds))).limit(1);
  if(existing)throw new Fault(409,"A player on this roster already has an active entry.");
  const [total]=await tx.select({n:count()}).from(registrations).where(and(eq(registrations.tournamentId,bracket.id),inArray(registrations.status,[...activeEntries])));
  if(total.n>=bracket.capacity)throw new Fault(409,"This tournament is full.");
  const [entry]=await tx.insert(registrations).values({tournamentId:bracket.id,applicantId:user.id,teamId:data.teamId,note:data.note}).returning({id:registrations.id});
  await tx.insert(registrationMembers).values(data.players.map(p=>({registrationId:entry.id,userId:p.id,ign:p.ign})));
  await notify(tx,playerIds,"Tournament registration received",`Your entry for ${bracket.title} is awaiting review.`,"/dashboard/my-tournaments");return entry.id;
});}
async function entryFor(tx:Tx,id:string){
  const [first]=await tx.select({event:registrations.tournamentId}).from(registrations).where(eq(registrations.id,id));
  if(!first)throw new Fault(404,"Entry not found.");
  const event=await lockTournament(tx,first.event);
  const [entry]=await tx.select().from(registrations).where(eq(registrations.id,id)).for("update");if(!entry)throw new Fault(404,"Entry not found.");return {entry,event};
}
async function ensureNotAssigned(tx:Tx,id:string){
  const [assigned]=await tx.select({id:matches.id}).from(matchParticipants).innerJoin(matches,eq(matches.id,matchParticipants.matchId)).where(and(eq(matchParticipants.registrationId,id),notInArray(matches.status,["cancelled"]))).limit(1);
  if(assigned)throw new Fault(409,"Remove the entry from its active matches before changing its status.");
}
export async function withdraw(user:Viewer,id:string){return db.transaction(async tx=>{
  const {entry,event}=await entryFor(tx,id);
  if(entry.applicantId!==user.id)throw new Fault(403,"Only the submitting player can withdraw this entry.");
  if(!activeEntries.some(s=>s===entry.status)||!verifyWindow(event.status,event.regStart,event.regEnd))throw new Fault(409,"This entry can no longer be withdrawn online.");
  await ensureNotAssigned(tx,id);
  await tx.update(registrations).set({status:"cancelled",reviewNote:"Withdrawn by entrant",updatedAt:new Date()}).where(eq(registrations.id,id));
  const members=await tx.select({id:registrationMembers.userId}).from(registrationMembers).where(eq(registrationMembers.registrationId,id));
  await notify(tx,members.map(r=>r.id),"Registration withdrawn",`Your entry for ${event.title} was withdrawn.`,"/dashboard/my-tournaments");
});}
export async function reviewEntry(user:Viewer,id:string,data:Review){return db.transaction(async tx=>{
  const {entry,event}=await entryFor(tx,id);
  if(["completed","cancelled","archived"].includes(event.status)||entry.status===data.status||!["pending","approved"].includes(entry.status))throw new Fault(409,"This registration can no longer be reviewed.");
  if(data.status!=="approved")await ensureNotAssigned(tx,id);
  const members=await tx.select({id:registrationMembers.userId,suspended:profiles.suspended}).from(registrationMembers).innerJoin(profiles,eq(profiles.id,registrationMembers.userId)).where(eq(registrationMembers.registrationId,id));
  if(data.status==="approved"&&members.some(p=>p.suspended))throw new Fault(409,"A player on this roster is suspended.");
  await tx.update(registrations).set({...data,reviewedBy:user.id,updatedAt:new Date()}).where(eq(registrations.id,id));
  await notify(tx,members.map(p=>p.id),`Registration ${data.status}`,`${event.title}${data.reviewNote?`: ${data.reviewNote}`:""}`,"/dashboard/my-tournaments");
  await log(tx,user.id,"registration.review",id,{from:entry.status,to:data.status});
});}
export async function saveMatch(user:Viewer,data:MatchInput,id?:string){return db.transaction(async tx=>{
  const event=await lockTournament(tx,data.tournamentId);
  if(!["open","closed","ongoing","upcoming"].includes(event.status))throw new Fault(409,"Matches can only be scheduled for published, unfinished events.");
  if(data.scheduledAt<event.startsAt||data.scheduledAt>event.endsAt)throw new Fault(422,"Schedule the match within the tournament dates.");
  const entries=[...new Set(data.entries)];if(entries.length!==data.entries.length)throw new Fault(422,"Select distinct participants.");
  const allowed=await tx.select({id:registrations.id}).from(registrations).where(and(eq(registrations.tournamentId,event.id),eq(registrations.status,"approved"),inArray(registrations.id,entries)));
  if(allowed.length!==entries.length)throw new Fault(422,"All participants must have approved entries for this tournament.");
  const update={title:data.title,number:data.number,round:data.round,scheduledAt:data.scheduledAt,status:data.status,instructions:data.instructions,updatedAt:new Date()};
  let matchId=id;
  if(id){
    const [old]=await tx.select().from(matches).where(and(eq(matches.id,id),eq(matches.tournamentId,event.id))).for("update");if(!old)throw new Fault(404,"Match not found.");
    const [saved]=await tx.select({id:matchResults.id}).from(matchResults).where(eq(matchResults.matchId,id)).limit(1);
    if(saved||old.publishedAt)throw new Fault(409,"A match with submitted results can only be changed through Results.");
    await tx.update(matches).set(update).where(eq(matches.id,id));
    await tx.delete(matchParticipants).where(eq(matchParticipants.matchId,id));
  }else{
    if(data.status==="cancelled")throw new Fault(422,"Create a scheduled or live match first.");
    const [row]=await tx.insert(matches).values({...update,tournamentId:event.id,createdBy:user.id}).returning({id:matches.id});matchId=row.id;
  }
  await tx.insert(matchParticipants).values(entries.map(registrationId=>({matchId:matchId!,registrationId})));
  const room={roomId:data.roomId,password:data.password,released:data.released&&data.status!=="cancelled",updatedAt:new Date()};
  await tx.insert(matchRooms).values({...room,matchId:matchId!}).onConflictDoUpdate({target:matchRooms.matchId,set:room});
  await notifyMatch(tx,entries,data.status==="cancelled"?"Match cancelled":id?"Match schedule updated":"Match scheduled",`${data.title} · ${event.title}${room.released?". Room details are available in Matches.":"."}`);
  if(room.released)await notifyMatch(tx,entries,"Room details released",`${data.title} is ready. View your private room details in Matches.`);
  await log(tx,user.id,id?"match.update":"match.create",matchId!,{tournamentId:event.id,participants:entries.length,status:data.status,released:room.released});return matchId!;
});}
async function lockMatch(tx:Tx,id:string){
  const [first]=await tx.select({event:matches.tournamentId}).from(matches).where(eq(matches.id,id));if(!first)throw new Fault(404,"Match not found.");
  const event=await lockTournament(tx,first.event);
  const [match]=await tx.select().from(matches).where(eq(matches.id,id)).for("update");if(!match)throw new Fault(404,"Match not found.");
  if(match.status==="cancelled"||!["open","closed","ongoing","completed"].includes(event.status))throw new Fault(409,"This match cannot accept results.");return {match,event};
}
export async function submitResults(user:Viewer,id:string,data:Results) {return db.transaction(async tx=>{
  const {match,event}=await lockMatch(tx,id);
  if(match.publishedAt&&user.role==="manager")throw new Fault(403,"Published results can only be corrected by an administrator.");
  const participants=await tx.select({id:matchParticipants.registrationId}).from(matchParticipants).where(eq(matchParticipants.matchId,id));
  const ids=new Set(data.entries.map(e=>e.registrationId)), positions=new Set(data.entries.map(e=>e.position));
  if(ids.size!==participants.length||ids.size!==data.entries.length||!participants.every(p=>ids.has(p.id))||positions.size!==ids.size||data.entries.some(e=>e.position>ids.size))throw new Fault(422,"Give every assigned entrant one unique placement, from first through last.");
  const [rules]=await tx.select().from(scoring).where(eq(scoring.tournamentId,event.id));if(!rules)throw new Fault(409,"Configure tournament scoring first.");
  for(const entry of data.entries){if(entry.bonus>rules.bonusMax||entry.penalty>rules.penaltyMax)throw new Fault(422,"A bonus or penalty exceeds the limits for this tournament.");await checkMedia(tx,user,entry.proofId,"proof");}
  const old=await tx.select().from(matchResults).where(eq(matchResults.matchId,id));
  if(old.length)await tx.insert(resultHistory).values({matchId:id,actorId:user.id,action:match.publishedAt?"retract":"replace",data:old});
  await tx.delete(matchResults).where(eq(matchResults.matchId,id));
  const payload=data.entries.map(entry=>({...entry,matchId:id,points:verifyRules(rules,entry),submittedBy:user.id}));
  await tx.insert(matchResults).values(payload);
  await tx.update(matches).set({publishedAt:null,status:"live",updatedAt:new Date()}).where(eq(matches.id,id));
  await tx.insert(resultHistory).values({matchId:id,actorId:user.id,action:"submit",data:payload});
  await log(tx,user.id,"results.submit",id,{entries:payload.length,retracted:!!match.publishedAt});
});}
export async function publishResults(user:Viewer,id:string){return db.transaction(async tx=>{
  const {match,event}=await lockMatch(tx,id);
  if(match.publishedAt)throw new Fault(409,"These results are already published.");
  const saved=await tx.select().from(matchResults).where(eq(matchResults.matchId,id)).for("update");if(!saved.length)throw new Fault(409,"Submit results before publishing them.");
  const now=new Date();await tx.update(matchResults).set({verifiedBy:user.id,verifiedAt:now,updatedAt:now}).where(eq(matchResults.matchId,id));
  await tx.update(matches).set({status:"completed",publishedAt:now,updatedAt:now}).where(eq(matches.id,id));
  await tx.update(matchRooms).set({released:false,updatedAt:now}).where(eq(matchRooms.matchId,id));
  await tx.insert(resultHistory).values({matchId:id,actorId:user.id,action:"publish",data:saved.map(r=>({id:r.id,points:r.points}))});
  await notifyMatch(tx,saved.map(r=>r.registrationId),"Results published",`${match.title} · ${event.title}`,"/dashboard/results");
  await log(tx,user.id,"results.publish",id,{entries:saved.length});
});}
