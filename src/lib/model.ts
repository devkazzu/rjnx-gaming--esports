export const ROLES = ["super_admin","admin","manager","moderator","player"] as const;
export const STATUSES = ["draft","upcoming","open","closed","ongoing","completed","cancelled","archived"] as const;
export const FORMATS = ["Single Elimination","Double Elimination","Round Robin","League","Points Based","Battle Royale"] as const;
export const MODES = ["solo","duo","squad"] as const;
export const PLATFORMS = ["PC","Mobile","Console","Cross-platform"] as const;
export const REG_STATES = ["pending","approved","rejected","cancelled"] as const;
export const MATCH_STATES = ["scheduled","live","completed","cancelled"] as const;
export type Role = typeof ROLES[number];
export type Status = typeof STATUSES[number];
export const STAFF = ["super_admin","admin","manager","moderator"] as const;
export const MANAGEMENT = ["super_admin","admin","manager"] as const;
export const ADMIN = ["super_admin","admin"] as const;
export const roleNames: Record<Role,string> = {super_admin:"Super Admin",admin:"Admin",manager:"Tournament Manager",moderator:"Moderator",player:"Player"};
export const labels: Record<string,string> = {draft:"Draft",upcoming:"Upcoming",open:"Registration Open",closed:"Registration Closed",ongoing:"Live Now",completed:"Completed",cancelled:"Cancelled",archived:"Archived",pending:"Pending",approved:"Approved",rejected:"Rejected",scheduled:"Scheduled",live:"Live",solo:"Solo",duo:"Duo",squad:"Squad",co_captain:"Co-captain",captain:"Captain",member:"Member",verifying:"Awaiting verification",reviewing:"In review",resolved:"Resolved",accepted:"Accepted",published:"Published"};
export const pretty = (value:string) => labels[value] || value.replace(/_/g," ").replace(/^./, c=>c.toUpperCase());
export const shortDate = (value: Date|string|null|undefined) => value ? new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(value)) : "—";
export const scheduleDate = (value: Date|string|null|undefined) => value ? new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(value)) + " UTC" : "—";
export const utcInput = (value:Date|string|null|undefined) => value ? new Date(value).toISOString().slice(0,16) : "";
export const initial = (value:string) => value.trim().split(/\s+/).slice(0,2).map(v=>v[0]?.toUpperCase()).join("");
export const slugify = (value:string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80).replace(/-+$/g,"");
export const verifyWindow = (status:Status, start:Date, end:Date, now = new Date()) => status === "open" && now >= start && now < end;
export function displayStatus(status:Status, start:Date, end:Date, now = new Date()) : Status {
  if (status !== "open") return status;
  return now < start ? "upcoming" : now >= end ? "closed" : status;
}
export const countLabel = (value:number) => new Intl.NumberFormat("en-US").format(value);
export type Query = Record<string,string|string[]|undefined>;
export const qstr = (q:Query,key:string,max=100) => (typeof q[key] === "string" ? q[key] : "").trim().slice(0,max);
export const pageno = (q:Query) => Math.max(1,Math.min(1000,Math.trunc(Number(qstr(q,"page")) || 1)));
export const can = (role:Role, allowed:readonly Role[]) => allowed.includes(role);
export const artFor = (artwork?:string|null) => artwork && /^\/images\/rjnx-(valorant|bgmi|freefire|arena)\.jpg$/.test(artwork) ? artwork : "/images/rjnx-arena.jpg";
export const MAX_IMAGE = 3*1024*1024;
export const FAQ = [
  {q:"How do I register for a tournament?", a:"Create your RJNX account, open a tournament, and submit an entry while registration is open. Its status will appear in My tournaments."},
  {q:"Are RJNX tournaments free to enter?", a:"Yes. RJNX currently supports free-entry events only. Each tournament lists its own prize information and eligibility rules."},
  {q:"How do I enter a duo or squad tournament?", a:"Create or join a team first. A captain or co-captain can submit the accepted members’ in-game details for the tournament’s required roster size."},
  {q:"Where do I find match room details?", a:"When staff release room details, approved participants assigned to the match can view them from their Matches dashboard."},
  {q:"How are rankings calculated?", a:"Only published, verified results count. Points come from the tournament’s scoring rules; ties are broken by wins, kills, then a stable competitor identifier."},
];
export type SiteSettings = { heroId:string|null; communityUrl:string; tagline:string; homepageNote:string; faqs:{q:string;a:string}[] };
export const defaults:SiteSettings = { heroId:null, communityUrl:"",tagline:"PLAY. COMPETE. CONQUER.",homepageNote:"Join the competitive gaming community. Participate in tournaments, build your squad, compete against the best and make your mark in esports.",faqs:FAQ };
