import { and, asc, count, desc, eq, exists, getTableColumns, ilike, inArray, isNotNull, isNull, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { can, MANAGEMENT, pageno, qstr, type Query } from "@/lib/model";
import type { Viewer } from "./auth";
import { Fault } from "./http";

export const PER_PAGE=12;
const pub=notInArray(s.tournaments.status,["draft","archived"]);
const active= inArray(s.registrations.status,["pending","approved"]);
const like=(value:string)=>`%${value.replace(/[\\%_]/g,c=>`\\${c}`)}%`;
const offset=(page:number,limit=PER_PAGE)=>(page-1)*limit;
const columns={...getTableColumns(s.tournaments),game:s.games.name,gameSlug:s.games.slug,artwork:s.games.artwork,registered:sql<number>`(select count(*) from ${s.registrations} where ${s.registrations.tournamentId}=${s.tournaments.id} and ${active})`.mapWith(Number)};
export type Tournament=Awaited<ReturnType<typeof getTournament>>;
export const gameList=()=>db.select().from(s.games).orderBy(s.games.name);
export async function getTournament(slug:string){const [r]=await db.select(columns).from(s.tournaments).innerJoin(s.games,eq(s.games.id,s.tournaments.gameId)).where(and(eq(s.tournaments.slug,slug),pub)).limit(1);return r;}
export async function tournamentsList(q:Query={},size=PER_PAGE,featured=false){
  const query=qstr(q,"q"), game=qstr(q,"game"), state=qstr(q,"status"), page=pageno(q);
  const activeOpening=and(eq(s.tournaments.status,"open"),sql`${s.tournaments.regStart} <= now() and ${s.tournaments.regEnd} > now()`);
  const futureOpening=and(eq(s.tournaments.status,"open"),sql`${s.tournaments.regStart} > now()`);
  const closedOpening=and(eq(s.tournaments.status,"open"),sql`${s.tournaments.regEnd} <= now()`);
  const statuses:Record<string,SQL|undefined>={open:activeOpening, upcoming:or(eq(s.tournaments.status,"upcoming"),futureOpening),closed:or(eq(s.tournaments.status,"closed"),closedOpening),ongoing:eq(s.tournaments.status,"ongoing"),completed:eq(s.tournaments.status,"completed"),cancelled:eq(s.tournaments.status,"cancelled")};
  const filter=and(pub,featured?eq(s.tournaments.featured,true):undefined,query?or(ilike(s.tournaments.title,like(query)),ilike(s.games.name,like(query))):undefined,game?eq(s.games.slug,game):undefined,Object.hasOwn(statuses,state)?statuses[state]:undefined);
  const [rows,[{total}]]=await Promise.all([db.select(columns).from(s.tournaments).innerJoin(s.games,eq(s.games.id,s.tournaments.gameId)).where(filter).orderBy(desc(s.tournaments.featured),sql`case when ${s.tournaments.status}='completed' then 1 else 0 end`,sql`case when ${s.tournaments.status}='open' then 0 when ${s.tournaments.status}='ongoing' then 1 else 2 end`,asc(s.tournaments.startsAt),asc(s.tournaments.id)).limit(size).offset(offset(page,size)),db.select({total:count()}).from(s.tournaments).innerJoin(s.games,eq(s.games.id,s.tournaments.gameId)).where(filter)]);
  return {rows,total,page,size};
}
export async function totals(){
  const result=await db.execute<{players:number;tournaments:number;active:number;teams:number;completed:number;recent:number;upcoming:number;live:number;finished:number;pending:number;matches:number}>(sql`select
  (select count(*)::int from ${s.profiles} where not suspended) as players,
  (select count(*)::int from ${s.tournaments} where ${pub}) as tournaments,
  (select count(*)::int from ${s.tournaments} where status='ongoing' or (status='open' and reg_start<=now() and reg_end>now())) as active,
  (select count(*)::int from ${s.teams} where active) as teams,
  (select count(*)::int from ${s.matches} where status='completed' and published_at is not null) as completed,
  (select count(*)::int from ${s.profiles} where not suspended and last_active_at>now()-interval '30 days') as recent,
  (select count(*)::int from ${s.tournaments} where status='upcoming') as upcoming,
  (select count(*)::int from ${s.tournaments} where status='ongoing') as live,
  (select count(*)::int from ${s.tournaments} where status='completed') as finished,
  (select count(*)::int from ${s.registrations} where status='pending') as pending,
  (select count(*)::int from ${s.matches}) as matches`);
  return result.rows[0];
}
export async function unreadCount(id:string){const [row]=await db.select({n:count()}).from(s.notifications).where(and(eq(s.notifications.userId,id),isNull(s.notifications.readAt)));return row.n;}

export type Rank={rank:number;id:string;name:string;slug:string;avatarId:string|null;matches:number;wins:number;kills:number;points:number;winRate:number;total:number};
export async function leaderboard(q:Query={},size=PER_PAGE,competitorId?:string){
  const team=qstr(q,"type")==="teams",page=pageno(q),game=qstr(q,"game"),event=qstr(q,"tournament"),season=qstr(q,"season"),search=qstr(q,"q");
  const target=team?sql`tg.id`:sql`p.id`, name=team?sql`tg.name`:sql`p.username`, slug=team?sql`tg.slug`:sql`p.username`, avatar=team?sql`tg.logo_id`:sql`p.avatar_id`;
  const join=team ? sql`join ${s.teams} tg on tg.id=r.team_id and tg.active` : sql`join ${s.registrationMembers} rm on rm.registration_id=r.id join ${s.profiles} p on p.id=rm.user_id and not p.suspended`;
  const filters=[game?sql`and g.slug=${game}`:sql``,event?sql`and t.slug=${event}`:sql``,season?sql`and t.season=${season}`:sql``];
  const result=await db.execute<Rank>(sql`with scores as (
    select ${target} id,${name} name,${slug} slug,${avatar} "avatarId",
      count(*)::int matches,count(*) filter(where result.position=1)::int wins,sum(result.kills)::int kills,sum(result.points)::int points
    from ${s.matchResults} result
    join ${s.matches} m on m.id=result.match_id
    join ${s.registrations} r on r.id=result.registration_id
    join ${s.tournaments} t on t.id=m.tournament_id
    join ${s.games} g on g.id=t.game_id ${join}
    where result.verified_at is not null and m.published_at is not null and m.status='completed' and t.status not in ('draft','cancelled')
    ${sql.join(filters,sql` `)} group by ${target},${name},${slug},${avatar}
  ), ranks as(select row_number() over(order by points desc,wins desc,kills desc,id asc)::int rank,*,round(wins*100.0/nullif(matches,0))::int "winRate" from scores)
   ,filtered as(select * from ranks where true ${competitorId?sql`and id=${competitorId}`:sql``} ${search?sql`and name ilike ${like(search)}`:sql``}),
  slice as (select * from filtered order by rank limit ${size} offset ${offset(page,size)})
  select slice.*, tally.total from (select count(*)::int total from filtered) tally left join slice on true order by slice.rank`);
  return {rows:result.rows.filter(r=>r.id!=null),total:result.rows[0]?.total??0,page,size};
}
export function rankFilters(){return db.select({slug:s.tournaments.slug,name:s.tournaments.title,season:s.tournaments.season}).from(s.tournaments).where(notInArray(s.tournaments.status,["draft","cancelled"])).orderBy(desc(s.tournaments.startsAt)).limit(400);}
export async function winners(size=3){return (await db.execute<{id:string;name:string;slug:string;tournament:string;tournamentSlug:string;points:number;type:string}>(sql`with final_scores as (
select t.id event, t.title tournament,t.slug "tournamentSlug", t.ends_at, coalesce(tm.id,p.id) id,coalesce(tm.name,p.username) name,coalesce(tm.slug,p.username) slug,case when tm.id is null then 'players' else 'teams' end type,
sum(mr.points)::int points,count(*) filter(where mr.position=1) wins,sum(mr.kills) kills
from ${s.matchResults} mr join ${s.matches} m on m.id=mr.match_id join ${s.tournaments} t on t.id=m.tournament_id
join ${s.registrations} r on r.id=mr.registration_id left join ${s.teams} tm on tm.id=r.team_id left join ${s.profiles} p on p.id=r.applicant_id
where t.status='completed' and m.status='completed' and m.published_at is not null and mr.verified_at is not null and ((tm.id is not null and tm.active) or (tm.id is null and not p.suspended))
group by t.id, tm.id,p.id,tm.name,p.username,tm.slug,case when tm.id is null then 'players' else 'teams' end
), ranked as (select *,row_number() over(partition by event order by points desc,wins desc,kills desc,id) rank from final_scores)
select id,name,slug,tournament,"tournamentSlug",points,type from ranked where rank=1 order by ends_at desc,event limit ${size}`)).rows;}
export async function newsList(q:Query={},size=PER_PAGE){
  const query=qstr(q,"q"),category=qstr(q,"category"),page=pageno(q);
  const where=and(lte(s.news.publishedAt,new Date()),category?eq(s.news.category,category):undefined,query?or(ilike(s.news.title,like(query)),ilike(s.news.summary,like(query)),ilike(sql`${s.news.tags}::text`,like(query))):undefined);
  const [rows,[{total}]]=await Promise.all([db.select({id:s.news.id,title:s.news.title,slug:s.news.slug,summary:s.news.summary,category:s.news.category,imageId:s.news.imageId,publishedAt:s.news.publishedAt}).from(s.news).where(where).orderBy(desc(s.news.publishedAt),desc(s.news.id)).limit(size).offset(offset(page,size)),db.select({total:count()}).from(s.news).where(where)]);
  return {rows,total,page,size};
}
export const categories=()=>db.selectDistinct({name:s.news.category}).from(s.news).where(lte(s.news.publishedAt,new Date())).orderBy(s.news.category);
export async function getNews(slug:string){const [row]=await db.select({article:s.news,author:s.profiles.username}).from(s.news).leftJoin(s.profiles,and(eq(s.profiles.id,s.news.authorId),eq(s.profiles.suspended,false))).where(and(eq(s.news.slug,slug),lte(s.news.publishedAt,new Date()))).limit(1);return row;}
const teamCols={...getTableColumns(s.teams),members:sql<number>`(select count(*) from ${s.teamMembers} join ${s.profiles} on ${s.profiles.id}=${s.teamMembers.userId} where ${s.teamMembers.teamId}=${s.teams.id} and not ${s.profiles.suspended})`.mapWith(Number)};
export async function teamsList(query:Query={},size=PER_PAGE){const text=qstr(query,"q"),page=pageno(query),where=and(eq(s.teams.active,true),text?or(ilike(s.teams.name,like(text)),ilike(s.teams.tag,like(text))):undefined);const [rows,[{total}]]=await Promise.all([db.select(teamCols).from(s.teams).where(where).orderBy(desc(s.teams.createdAt),asc(s.teams.id)).limit(size).offset(offset(page,size)),db.select({total:count()}).from(s.teams).where(where)]);return {rows,total,page,size};}
export async function getTeam(slug:string){const [row]=await db.select(teamCols).from(s.teams).where(and(eq(s.teams.active,true),eq(s.teams.slug,slug))).limit(1);return row;}
export function roster(teamId:string,includeSuspended=false){return db.select({id:s.profiles.id,username:s.profiles.username,avatarId:s.profiles.avatarId,country:s.profiles.country,ign:s.profiles.ign,role:s.teamMembers.role,suspended:s.profiles.suspended}).from(s.teamMembers).innerJoin(s.profiles,eq(s.profiles.id,s.teamMembers.userId)).where(and(eq(s.teamMembers.teamId,teamId),includeSuspended?undefined:eq(s.profiles.suspended,false))).orderBy(s.teamMembers.role,s.teamMembers.createdAt);}
const playerCols={id:s.profiles.id,username:s.profiles.username,fullName:s.profiles.fullName,country:s.profiles.country,bio:s.profiles.bio,avatarId:s.profiles.avatarId,favoriteGame:s.profiles.favoriteGame,ign:s.profiles.ign,experience:s.profiles.experience,joined:s.profiles.createdAt};
export async function playersList(query:Query={},size=PER_PAGE){const text=qstr(query,"q"),page=pageno(query),where=and(eq(s.profiles.suspended,false),text?or(ilike(s.profiles.username,like(text)),ilike(s.profiles.favoriteGame,like(text))):undefined);const [rows,[{total}]]=await Promise.all([db.select(playerCols).from(s.profiles).where(where).orderBy(desc(s.profiles.createdAt),asc(s.profiles.id)).limit(size).offset(offset(page,size)),db.select({total:count()}).from(s.profiles).where(where)]);return {rows,total,page,size};}
export async function getPlayer(username:string){const [row]=await db.select(playerCols).from(s.profiles).where(and(eq(s.profiles.suspended,false),eq(s.profiles.username,username))).limit(1);return row;}
export async function eventHistory(id:string,team=false){return db.select({id:s.tournaments.id,title:s.tournaments.title,slug:s.tournaments.slug,status:s.tournaments.status,date:s.tournaments.startsAt}).from(s.registrations).innerJoin(s.tournaments,eq(s.tournaments.id,s.registrations.tournamentId)).innerJoin(s.registrationMembers,eq(s.registrations.id,s.registrationMembers.registrationId)).where(and(team?eq(s.registrations.teamId,id):eq(s.registrationMembers.userId,id),eq(s.registrations.status,"approved"),pub)).groupBy(s.tournaments.id).orderBy(desc(s.tournaments.startsAt)).limit(12);}
export async function eventTotal(id:string,team=false){const [row]=await db.select({n:sql<number>`count(distinct ${s.tournaments.id})`.mapWith(Number)}).from(s.registrations).innerJoin(s.tournaments,eq(s.tournaments.id,s.registrations.tournamentId)).innerJoin(s.registrationMembers,eq(s.registrations.id,s.registrationMembers.registrationId)).where(and(team?eq(s.registrations.teamId,id):eq(s.registrationMembers.userId,id),eq(s.registrations.status,"approved"),pub));return row.n;}
export async function entryForUser(eventId:string,userId:string){const [row]=await db.select({id:s.registrations.id,status:s.registrations.status}).from(s.registrations).innerJoin(s.registrationMembers,eq(s.registrations.id,s.registrationMembers.registrationId)).where(and(eq(s.registrations.tournamentId,eventId),eq(s.registrationMembers.userId,userId),active)).limit(1);return row;}
export async function eventSchedule(eventId:string){return db.select({id:s.matches.id,title:s.matches.title,round:s.matches.round,scheduledAt:s.matches.scheduledAt,status:s.matches.status,number:s.matches.number}).from(s.matches).where(and(eq(s.matches.tournamentId,eventId),ne(s.matches.status,"cancelled"))).orderBy(s.matches.scheduledAt).limit(40);}
export async function eventScoring(eventId:string) {const [row]=await db.select().from(s.scoring).where(eq(s.scoring.tournamentId,eventId));return row;}
export async function myRegistrations(userId:string,page=1){return db.select({id:s.registrations.id,applicant:s.registrations.applicantId,status:s.registrations.status,reason:s.registrations.reviewNote,createdAt:s.registrations.createdAt,tournament:s.tournaments.title,slug:s.tournaments.slug,eventStatus:s.tournaments.status,regStart:s.tournaments.regStart,regEnd:s.tournaments.regEnd,mode:s.tournaments.mode,team:s.teams.name}).from(s.registrationMembers).innerJoin(s.registrations,eq(s.registrationMembers.registrationId,s.registrations.id)).innerJoin(s.tournaments,eq(s.registrations.tournamentId,s.tournaments.id)).leftJoin(s.teams,eq(s.teams.id,s.registrations.teamId)).where(eq(s.registrationMembers.userId,userId)).orderBy(desc(s.registrations.createdAt)).limit(PER_PAGE+1).offset(offset(page));}
export async function myMatches(userId:string,page=1){return db.select({id:s.matches.id,title:s.matches.title,status:s.matches.status,scheduledAt:s.matches.scheduledAt,instructions:s.matches.instructions,round:s.matches.round,tournament:s.tournaments.title,slug:s.tournaments.slug,released:s.matchRooms.released}).from(s.registrationMembers).innerJoin(s.registrations,eq(s.registrationMembers.registrationId,s.registrations.id)).innerJoin(s.matchParticipants,eq(s.matchParticipants.registrationId,s.registrations.id)).innerJoin(s.matches,eq(s.matches.id,s.matchParticipants.matchId)).innerJoin(s.tournaments,eq(s.tournaments.id,s.matches.tournamentId)).leftJoin(s.matchRooms,eq(s.matchRooms.matchId,s.matches.id)).where(and(eq(s.registrationMembers.userId,userId),eq(s.registrations.status,"approved"))).orderBy(sql`case when ${s.matches.status}='completed' then 1 else 0 end`,desc(s.matches.scheduledAt)).limit(PER_PAGE+1).offset(offset(page));}
export async function myResults(userId:string,page=1){return db.select({id:s.matchResults.id,title:s.matches.title,tournament:s.tournaments.title,slug:s.tournaments.slug,position:s.matchResults.position,kills:s.matchResults.kills,points:s.matchResults.points,date:s.matches.publishedAt}).from(s.registrationMembers).innerJoin(s.matchResults,eq(s.matchResults.registrationId,s.registrationMembers.registrationId)).innerJoin(s.matches,eq(s.matches.id,s.matchResults.matchId)).innerJoin(s.tournaments,eq(s.tournaments.id,s.matches.tournamentId)).where(and(eq(s.registrationMembers.userId,userId),isNotNull(s.matchResults.verifiedAt),isNotNull(s.matches.publishedAt))).orderBy(desc(s.matches.publishedAt)).limit(PER_PAGE+1).offset(offset(page));}
export async function roomFor(user:Viewer,id:string){
  const where=can(user.role,MANAGEMENT)?undefined:and(eq(s.matchRooms.released,true),inArray(s.matches.status,["scheduled","live"]),exists(db.select({id:s.matchParticipants.registrationId}).from(s.matchParticipants).innerJoin(s.registrations,eq(s.registrations.id,s.matchParticipants.registrationId)).innerJoin(s.registrationMembers,eq(s.registrationMembers.registrationId,s.registrations.id)).where(and(eq(s.matchParticipants.matchId,s.matches.id),eq(s.registrations.status,"approved"),eq(s.registrationMembers.userId,user.id)))));
  const [row]=await db.select({roomId:s.matchRooms.roomId,password:s.matchRooms.password,released:s.matchRooms.released}).from(s.matchRooms).innerJoin(s.matches,eq(s.matches.id,s.matchRooms.matchId)).where(and(eq(s.matchRooms.matchId,id),where)).limit(1);
  if(!row)throw new Fault(404,"Room details aren’t available for your account.");return row;
}
export async function myInvitations(userId:string){return db.select({id:s.invitations.id,team:s.teams.name,tag:s.teams.tag,createdAt:s.invitations.createdAt,status:s.invitations.status}).from(s.invitations).innerJoin(s.teams,eq(s.teams.id,s.invitations.teamId)).where(and(eq(s.invitations.userId,userId),eq(s.teams.active,true))).orderBy(desc(s.invitations.createdAt)).limit(30);}
export async function outgoingInvitations(teamId:string){return db.select({id:s.invitations.id,username:s.profiles.username,createdAt:s.invitations.createdAt}).from(s.invitations).innerJoin(s.profiles,eq(s.profiles.id,s.invitations.userId)).where(and(eq(s.invitations.teamId,teamId),eq(s.invitations.status,"pending"))).orderBy(desc(s.invitations.createdAt));}
export function inbox(userId:string,page=1){return db.select({id:s.notifications.id,title:s.notifications.title,body:s.notifications.body,link:s.notifications.link,readAt:s.notifications.readAt,date:s.notifications.createdAt}).from(s.notifications).where(eq(s.notifications.userId,userId)).orderBy(desc(s.notifications.createdAt),desc(s.notifications.id)).limit(PER_PAGE+1).offset(offset(page));}
