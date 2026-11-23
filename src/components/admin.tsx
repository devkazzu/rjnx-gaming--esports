import Link from "next/link";
import { ArrowRight, Bell, ClipboardList, Flag, Gamepad2, LockKeyhole, Medal, Plus, Radio, Shield, Trophy, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, news, reports, teams } from "@/db/schema";
import { activities, adminAllowed, adminList, adminResults, adminRoutes, adminStats, candidates, eligiblePick, eventsForAdmin, getAdminUser, getManagerEntry, getManagerMatch, getManagerTournament, key, recentAudit, revisions, summaryQueue } from "@/server/admin";
import { pageIdentity } from "@/server/auth";
import { siteSettings } from "@/server/content";
import { eventScoring, gameList, totals } from "@/server/reads";
import { ADMIN, can, pretty, qstr, roleNames, ROLES, scheduleDate, shortDate, STATUSES, utcInput, type Query, type Role } from "@/lib/model";
import { ActionButton } from "./forms";
import { AnnouncementEditor, ArticleEditor, GameEditor, MatchEditor, ReportEditor, ResultsEditor, ReviewEditor, SettingsEditor, TournamentEditor, UserEditor } from "./admin-forms";
import { Back, Badge, Empty, Filter, FilterSelect, Intro, Pager, Stat } from "./ui";
import { ActivityChart } from "./chart";
import { StaffTable, type Cell, type StaffRow } from "./staff-table";
import { LeaderboardView } from "./public-views";

const sectionInfo:Record<string,{copy:string;statuses?:string[];create?:string;event?:boolean}>={
 users:{copy:"Search players, edit permitted information, and assign roles with authorization.",statuses:["active","suspended",...ROLES]},tournaments:{copy:"Prepare events, publish registration, and manage competition status and scoring.",statuses:[...STATUSES],create:"New tournament"},registrations:{copy:"Review submitted entries and frozen rosters. Decisions notify affected players.",statuses:["pending","approved","rejected","cancelled"],event:true},matches:{copy:"Schedule approved participants and release room details privately.",statuses:["scheduled","live","completed","cancelled"],create:"Schedule match",event:true},results:{copy:"Enter scorecards, review proof, and publish verified standings.",statuses:["verifying","published","live","completed"],event:true},teams:{copy:"Inspect the current rosters and moderate teams as needed.",statuses:["active","suspended"]},news:{copy:"Draft, finish, or schedule community articles.",statuses:["draft","scheduled","published"],create:"New article"},announcements:{copy:"Draft announcements and send them to all players or a tournament’s entrants.",statuses:["draft","published"],create:"New announcement"},reports:{copy:"Review contact requests and fair-play reports. Resolution notes remain private.",statuses:["open","reviewing","resolved"]},"audit-logs":{copy:"Track sensitive staff changes. Credentials are never included in these records."},
};
export async function StaffSection({section,query}:{section:string;query:Query}){
  const user=await pageIdentity(true);const info=adminRoutes.find(x=>x.id===section);
  if(!info)notFound();
  if(!adminAllowed(section,user.role))return <><Intro eyebrow="Staff access" title="Permission required">Your role doesn’t allow access to this section.</Intro><Link href="/admin" className="btn outline">Back to control center <ArrowRight size={15}/></Link></>;
  if(!section)return <ControlCenter role={user.role}/>;
  if(section==="leaderboard")return <LeaderboardView path="/admin/leaderboard" query={query} admin/>;
  if(section==="settings")return <><Intro eyebrow="Platform operations" title="Platform settings">Manage the homepage message and banner, community destination, and support FAQ.</Intro><section className="panel form-panel"><SettingsEditor settings={await siteSettings()}/></section></>;
  const path=`/admin/${section}`, config=sectionInfo[section];
  const edit=key(query,"edit"),create=qstr(query,"create")==="1";
  if(edit||create){const detail=await details(section,edit,create,query,user.role);if(detail)return <><Back href={path}>Back to {info.title.toLowerCase()}</Back>{detail}</>;}
  const [list,events]=await Promise.all([adminList(section,query),config.event?eventsForAdmin():[]]);
  const table=structure(section,list.rows,user.role);
  return <><Intro eyebrow="Admin dashboard" title={info.title} action={config.create&&<Link className="btn solid" href={`${path}?create=1`}><Plus size={16}/>{config.create}</Link>}>{config.copy}</Intro><Filter path={path} query={query} placeholder={`Search ${info.title.toLowerCase()}…`}>{config.statuses&&<FilterSelect name="status" label="All statuses" current={qstr(query,"status")} options={config.statuses.map(s=>({value:s,label:roleNames[s as Role]||pretty(s)}))}/>} {config.event&&<FilterSelect name="tournament" label="All tournaments" current={qstr(query,"tournament")} options={events.map(event=>({value:event.id,label:event.title}))}/>}</Filter><StaffTable caption={`${info.title} records`} headings={table.headings} rows={table.rows}/><Pager path={path} query={query} page={list.page} more={list.more}/></>;
}
async function ControlCenter({role}:{role:Role}){
  const [data,stats,chart,logs,queue]=await Promise.all([totals(),adminStats(),activities(),can(role,ADMIN)?recentAudit():[],adminAllowed("registrations",role)?summaryQueue():[]]);
  return <><Intro eyebrow="RJNX operations" title="Control center">Manage competitions, player records, and the day-to-day operations of the arena.</Intro><div className="admin-shortcuts">{adminAllowed("tournaments",role)&&<Link className="btn solid compact" href="/admin/tournaments?create=1"><Plus size={15}/> Create tournament</Link>}{adminAllowed("registrations",role)&&<Link className="btn outline compact" href="/admin/registrations?status=pending"><ClipboardList size={15}/> Review queue</Link>}{adminAllowed("announcements",role)&&<Link className="btn outline compact" href="/admin/announcements?create=1"><Bell size={15}/> New announcement</Link>}</div><div className="metric-grid"><Stat label="TOTAL USERS" value={stats.users.total} icon={<Users/>}/><Stat label="ACTIVE IN 30 DAYS" value={stats.users.active} icon={<Radio/>}/><Stat label="TOTAL TOURNAMENTS" value={stats.events.total} icon={<Trophy/>}/><Stat label="UPCOMING TOURNAMENTS" value={stats.events.upcoming} icon={<Trophy/>}/><Stat label="LIVE TOURNAMENTS" value={stats.events.live} icon={<Radio/>}/><Stat label="COMPLETED TOURNAMENTS" value={stats.events.completed} icon={<Medal/>}/><Stat label="PENDING REGISTRATIONS" value={data.pending} icon={<ClipboardList/>}/><Stat label="TEAMS" value={data.teams} icon={<Shield/>}/><Stat label="MATCHES" value={stats.matches} icon={<Gamepad2/>}/></div><div className="dashboard-grid"><section className="panel workspace-panel"><h2>Activity · last 7 days</h2><ActivityChart data={chart}/></section>{adminAllowed("registrations",role)&&<section className="panel workspace-panel workspace-empty"><header><h2>Registration queue</h2><Link href="/admin/registrations?status=pending" className="text-link">Open queue <ArrowRight size={13}/></Link></header>{queue.length?queue.map(item=><div className="queue-row" key={item.id}><Link className="text-link" href={`/admin/registrations?edit=${item.id}`}>{item.title}</Link><Badge state={item.status}/></div>):<Empty title="No pending entries" text="New applications will show up here."/>}</section>}{can(role,ADMIN)&&<section className="panel workspace-panel workspace-empty"><header><h2>Recent staff actions</h2><Link className="text-link" href="/admin/audit-logs">Audit logs <ArrowRight size={13}/></Link></header>{logs.length?logs.map(row=><div key={row.id} className="queue-row"><span>{row.action}</span><small>{row.actor||"System"} · {shortDate(row.date)}</small></div>):<Empty title="Nothing logged yet" text="Staff changes will appear in the audit trail."/>}</section>}{adminAllowed("reports",role)&&<section className="panel workspace-panel"><header><h2>Player support</h2><Link className="text-link" href="/admin/reports?status=open">Review reports <ArrowRight size={13}/></Link></header><p className="muted">Review contact messages and fair-play concerns submitted by players.</p></section>}</div></>;
}
function structure(section:string,data:Record<string,unknown>[],role:Role){
  const columns=(x:string[])=>x.map(name=>({name:name.replace(/^\*/,""),secondary:name.startsWith("*")}));
  const headingMap:Record<string,string[]>={users:["Player","Role","Status","*Joined","Action"],tournaments:["Tournament","Status","*Game","Starts","Action"],registrations:["Entry","Status","*Applied","Action"],matches:["Match","Status","*Scheduled","Action"],results:["Match","Verification","*Scheduled","Action"],teams:["Team","Status","*Roster","Action"],news:["Article","Status","*Category","Action"],announcements:["Announcement","Status","*Audience","Action"],reports:["Report","Status","*Received","Action"],"audit-logs":["Action","Actor","*Record","Date"]};
  const rows:StaffRow[]=data.map(row=>{
    const s=(name:string)=>row[name]==null?"":String(row[name]);
    const d=(name:string)=>shortDate(row[name] instanceof Date?row[name]:s(name));
    const p=(name:string,secondary?:string,href?:string):Cell=>({text:s(name),secondary,href});
    const b=(value:string,text=pretty(value)):Cell=>({text,badge:value});
    const a=(text="Open",href=`/admin/${section}?edit=${s("id")}`):Cell=>({text,href,action:true});
    const staffRole=(s("role")||"player") as Role;
    let cells:Cell[]=[];
    if(section==="users")cells=[p("username",s("name")||s("country")),{text:roleNames[staffRole]},b(row.suspended?"suspended":"active"),{text:d("date")},role==="super_admin"||staffRole==="player"?a("Edit"):{text:"Staff"}];
    if(section==="tournaments")cells=[p("title",s("season")),b(s("status")),p("game"),{text:d("date")},a("Edit")];
    if(section==="registrations")cells=[p("title",s("team")||s("player")),b(s("status")),{text:d("date")},a("Review")];
    if(section==="matches")cells=[p("title",`${s("event")} · #${s("number")}`),b(s("status")),{text:d("date")},row.has?a("Results",`/admin/results?edit=${s("id")}`):a("Edit")];
    if(section==="results")cells=[p("title",s("event")),b(row.publishedAt?"published":row.has?"verifying":s("status"),row.publishedAt?"Published":row.has?"Awaiting review":s("status")==="cancelled"?"Cancelled":"No scores yet"),{text:d("date")},a("Scorecard")];
    if(section==="teams")cells=[p("name",s("tag")),b(row.active?"active":"suspended"),{text:`${s("members")} members`},a("Manage")];
    if(section==="news")cells=[p("title",s("slug")),b(row.publishedAt instanceof Date?+row.publishedAt>Date.now()?"scheduled":"published":"draft"),p("category"),a("Edit")];
    if(section==="announcements")cells=[p("title",d("date")),b(row.sentAt?"published":"draft",row.sentAt?"Sent":"Draft"),{text:s("event")||"All players"},a(row.sentAt?"Open":"Edit")];
    if(section==="reports")cells=[p("title",s("email")),b(s("status")),{text:d("date")},a("Review")];
    if(section==="audit-logs")cells=[p("action",JSON.stringify(row.details).slice(0,150)),{text:s("actor")||"System"},p("target"),{text:d("date")}];
    return {id:s("id"),cells};
  });
  return {headings:columns(headingMap[section]),rows};
}
function Editor({title,subtitle,children}:{title:string;subtitle?:string;children:React.ReactNode}){return <><Intro eyebrow="Admin dashboard" title={title}>{subtitle}</Intro><section className="panel form-panel">{children}</section></>;}
async function details(section:string,id:string|undefined,create:boolean,query:Query,role:Role){
  if(section==="tournaments"){
    const [all,editing]=await Promise.all([gameList(),id?getManagerTournament(id):undefined]);if(id&&!editing)notFound();
    const date=(hours:number)=>utcInput(new Date(Date.now()+hours*3600_000));
    const dates={regStart:date(-1),regEnd:date(48),startsAt:date(72),endsAt:date(120)};
    const event=editing?{...editing.row,regStart:utcInput(editing.row.regStart),regEnd:utcInput(editing.row.regEnd),startsAt:utcInput(editing.row.startsAt),endsAt:utcInput(editing.row.endsAt),scoring:editing.rules}:undefined;
    return <><Editor title={id?"Edit tournament":"New tournament"} subtitle="Configure tournament information, registration dates in UTC, and point rules."><TournamentEditor event={event} games={all} dates={dates}/></Editor><div className="page-spacer panel form-panel"><h2>Add a custom game</h2><GameEditor/></div>{id&&event&&["draft","upcoming","completed","cancelled"].includes(event.status)&&<div className="page-spacer panel form-panel"><h2>Archive tournament</h2><p className="form-intro">Archived events are hidden from the directory; published records remain in historical standings.</p><ActionButton method="DELETE" endpoint={`/admin/tournaments/${id}`} label="Archive tournament" confirm="Hide this tournament from the public directory?" danger/></div>}</>;
  }
  if(section==="registrations"&&id){
    const item=await getManagerEntry(id);if(!item)notFound();
    return <Editor title="Review registration" subtitle={item.event}><div className="side-sections"><div><Badge state={item.entry.status}/><p className="plain muted page-spacer">{item.entry.note||"No note supplied."}</p></div><div><h3>Submitted roster</h3><ul className="list-rows">{item.members.map(m=><li key={m.id}><strong>{m.username}</strong><span className="muted">{m.ign}</span></li>)}</ul></div>{["pending","approved"].includes(item.entry.status)&&<ReviewEditor id={id} status={item.entry.status} value={item.entry.reviewNote}/>}</div></Editor>;
  }
  if(section==="matches"){
    const [events,editing]=await Promise.all([eventsForAdmin(),id?getManagerMatch(id):undefined]);if(id&&!editing)notFound();
    if(editing?.row.publishedAt)return <Editor title="Match completed" subtitle="Use Results to review or correct this published scorecard."><Link className="btn solid" href={`/admin/results?edit=${id}`}>Open scorecard <ArrowRight size={15}/></Link></Editor>;
    const selectable=eligiblePick(events), tournament=editing?.row.tournamentId||key(query,"tournament"),chosen=selectable.find(e=>e.id===tournament);
    if(editing&&!chosen)return <Editor title="Match isn’t editable" subtitle="The tournament no longer accepts schedule changes."><Link className="btn outline" href={`/admin/results?edit=${id}`}>View scorecard</Link></Editor>;
    const eligible=chosen?await candidates(chosen.id):[];
    const matchDefault=chosen&&chosen.startsAt.getUTCSeconds()+chosen.startsAt.getUTCMilliseconds()>0?new Date(Math.ceil(+chosen.startsAt/60000)*60000):chosen?.startsAt;
    const match=editing?{...editing.row,scheduledAt:utcInput(editing.row.scheduledAt),roomId:editing.room?.roomId||"",password:editing.room?.password||"",released:editing.room?.released||false,entries:editing.participants.map(p=>p.id)}:undefined;
    return <Editor title={id?"Edit match":"Schedule match"} subtitle={chosen?.title||"Choose a published tournament to load its approved entries."}>{!id&&<form className="inline-pick form-block" action="/admin/matches"><input type="hidden" name="create" value="1"/><label className="field"><span>Tournament</span><select name="tournament" required defaultValue={chosen?.id||""}><option value="">Select tournament</option>{selectable.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label><button className="btn outline" type="submit">Load participants</button></form>}{chosen&&(eligible.length>=2?<div className="page-spacer"><MatchEditor key={id||chosen.id} event={chosen.id} candidates={eligible} match={match} when={utcInput(matchDefault)}/></div>:<Empty title="Not enough approved entries" text="Approve at least two entries before scheduling a match." action={<Link className="btn outline compact" href={`/admin/registrations?tournament=${chosen.id}`}>Review entries</Link>}/>)}</Editor>;
  }
  if(section==="results"&&id){
    const [item,rows,history]=await Promise.all([getManagerMatch(id),adminResults(id),revisions(id)]);if(!item)notFound();
    const rules=await eventScoring(item.row.tournamentId),isAdmin=can(role,ADMIN),published=!!item.row.publishedAt;
    const allowEdit=!!rules&&item.row.status!=="cancelled"&&(!published||isAdmin)&&item.participants.length>1;
    const editing=allowEdit&&(!published||qstr(query,"revise")==="1");
    return <><Editor title="Match scorecard" subtitle={`${item.row.title} · ${item.row.round} · ${scheduleDate(item.row.scheduledAt)}`}><div className="side-sections"><div><Badge state={published?"published":rows.length?"verifying":item.row.status}/>{rows.length>0&&<div className="page-spacer table-wrap"><table className="mutation-table"><thead><tr><th>Place</th><th>Entrant</th><th>Kills</th><th>Points</th><th>Proof</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.position}</td><td>{item.participants.find(e=>e.id===r.registrationId)?.name||"Entrant"}</td><td>{r.kills}</td><td className="points">{r.points}</td><td>{r.proofId?<a href={`/api/media/${r.proofId}`} target="_blank" rel="noreferrer">Open image</a>:"—"}</td></tr>)}</tbody></table></div>}</div>{isAdmin&&rows.length>0&&!published&&<ActionButton endpoint={`/admin/results/${id}/publish`} method="POST" label="Verify & publish" confirm="Publish verified scores to leaderboards and notify entrants?" icon={<Medal size={15}/>}/>} {!isAdmin&&rows.length>0&&!published&&<p className="notice"><LockKeyhole size={16}/> An Admin or Super Admin must verify and publish these scores.</p>}
    {published&&allowEdit&&!editing&&<Link className="btn outline compact" href={`/admin/results?edit=${id}&revise=1`}>Correct published scores</Link>}{editing&&rules&&<div className="form-block"><h3>{published?"Correct published scores":"Enter scores"}</h3>{published&&<p className="notice error">Submitting corrections removes current standings until they are verified again.</p>}<p className="form-help">Give each entrant a unique placement. The tournament’s scoring settings calculate points automatically.</p><ResultsEditor key={id} match={id} maxBonus={rules.bonusMax} maxPenalty={rules.penaltyMax} entries={item.participants.map((p,i)=>{const old=rows.find(r=>r.registrationId===p.id);return {id:p.id,name:p.name,position:old?.position||i+1,kills:old?.kills||0,bonus:old?.bonus||0,penalty:old?.penalty||0,proofId:old?.proofId||null};})}/></div>}</div></Editor><section className="panel workspace-panel page-spacer"><h2>Result revision history</h2>{history.length?history.map(r=><div className="queue-row" key={r.id}><strong>{pretty(r.action)}</strong><small>{r.actor||"System"} · {scheduleDate(r.date)}</small></div>):<p className="muted">There are no saved revisions yet.</p>}</section></>;
  }
  if(section==="users"&&id){const data=await getAdminUser(id);if(!data)notFound();return <Editor title="Manage player" subtitle={data.username}>{role!=="super_admin"&&data.role&&data.role!=="player"?<p className="notice">Only Super Admins can manage staff accounts.</p>:<UserEditor id={id} data={data} superAdmin={role==="super_admin"}/>}</Editor>;}
  if(section==="teams"&&id){const [team]=await db.select().from(teams).where(eq(teams.id,id));if(!team)notFound();return <Editor title={team.name} subtitle={`${team.tag} · Team moderation`}><div className="side-sections"><Badge state={team.active?"active":"suspended"}/><p className="plain muted">{team.description||"No team description."}</p>{team.active&&<Link className="btn outline compact" href={`/teams/${team.slug}`}>Open public page</Link>}<ActionButton endpoint={`/admin/teams/${id}`} data={{active:!team.active}} label={team.active?"Suspend team":"Restore team"} danger={team.active} confirm={team.active?"Hide this team from public and prevent further registrations?":"Restore this team to the public directory?"}/></div></Editor>;}
  if(section==="news"){
    const article=id?(await db.select().from(news).where(eq(news.id,id)))[0]:undefined;if(id&&!article)notFound();
    return <><Editor title={create?"New article":"Edit article"} subtitle="Use the publish date to release this article now or schedule it."><ArticleEditor article={article?{...article,publishedAt:utcInput(article.publishedAt)}:undefined}/></Editor>{article?.publishedAt&&<section className="panel form-panel page-spacer"><h2>Remove from public news</h2><ActionButton endpoint={`/admin/news/${id}`} method="DELETE" danger label="Unpublish article" confirm="Move this article back to drafts?"/></section>}</>;
  }
  if(section==="announcements"){
    const [events,item]=await Promise.all([eventsForAdmin(),id?db.select().from(announcements).where(eq(announcements.id,id)).then(x=>x[0]):undefined]);if(id&&!item)notFound();
    return <Editor title={item?.sentAt?"Sent announcement":id?"Edit announcement":"New announcement"} subtitle={item?.sentAt?`Sent ${scheduleDate(item.sentAt)}`:"Target all players or an event’s current registrations."}>{item?.sentAt?<div className="prose-panel"><h2>{item.title}</h2><p className="plain">{item.body}</p></div>:<AnnouncementEditor item={item} events={events}/>}</Editor>;
  }
  if(section==="reports"&&id){const [row]=await db.select().from(reports).where(eq(reports.id,id));if(!row)notFound();return <Editor title={row.subject} subtitle={`Submitted ${scheduleDate(row.createdAt)}`}><div className="side-sections"><p><Flag size={16} className="inline"/> {row.email}</p><p className="plain muted">{row.body}</p><ReportEditor id={id} status={row.status} value={row.response}/></div></Editor>;}
  return null;
}
