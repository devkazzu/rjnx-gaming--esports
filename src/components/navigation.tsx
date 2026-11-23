"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Bell, ChevronDown, LogOut, Menu, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, Brand } from "./ui";

export type NavUser={username:string;avatarId:string|null;staff:boolean};
const links=[{path:"/",label:"Home"},{path:"/tournaments",label:"Tournaments"},{path:"/leaderboard",label:"Leaderboard"},{path:"/teams",label:"Teams"},{path:"/news",label:"News"},{path:"/about",label:"About"}];
export function Unread({initial,realtime=false}:{initial:number;realtime?:boolean}){
  const [n,setN]=useState(initial);
  const path=usePathname();const router=useRouter();
  useEffect(()=>{
    let live=true;
    let stopRealtime:(()=>void)|undefined;
    async function poll(){if(document.hidden)return;try{const reply=await fetch("/api/me/notifications?summary=1",{cache:"no-store",signal:AbortSignal.timeout(6500)});if(reply.ok){const value=await reply.json();if(live&&typeof value.unread==="number")setN(value.unread);}}catch{/* Keep the last known count. */}}
    const timer=window.setInterval(poll,20000);
    if(realtime)void import("./realtime-client").then(({subscribeInbox})=>{if(live)stopRealtime=subscribeInbox(()=>{void poll();if(!document.hidden&&path==="/dashboard/notifications")router.refresh();});}).catch(()=>{});
    document.addEventListener("visibilitychange",poll);
    window.addEventListener("rjnx-notification",poll);
    return()=>{live=false;stopRealtime?.();window.clearInterval(timer);document.removeEventListener("visibilitychange",poll);window.removeEventListener("rjnx-notification",poll);};
  },[path,realtime,router]);
  return n?<span className="unread-count" aria-label={`${n} unread`}>{n>99?"99+":n}</span>:null;
}
export function SignOut(){const router=useRouter();const [busy,setBusy]=useState(false),[problem,setProblem]=useState("");
  async function logOut(){setBusy(true);setProblem("");try{const res=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"logout"}),signal:AbortSignal.timeout(15000)});if(!res.ok){const data=await res.json();throw Error(data.error||"Could not sign out.");}router.replace("/");router.refresh();}catch(e){setProblem(e instanceof Error?e.message:"Could not sign out.");setBusy(false);}}
  return <><button onClick={()=>void logOut()} className="logout-btn" type="button" disabled={busy}><LogOut size={16}/>{busy?"Signing out…":"Sign out"}</button>{problem&&<span className="menu-error" role="alert">{problem}</span>}</>;
}
export function Navbar({user,unread=0,realtime=false}:{user:NavUser|null;unread?:number;realtime?:boolean}){
  const path=usePathname();const [opened,setOpen]=useState<string|null>(null);const open=opened===path;
  useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(null);};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[open]);
  return <header className="site-header"><div className="site-container nav-inner"><Brand/><nav className="desktop-nav" aria-label="Main navigation">{links.map(link=>{const active=link.path==="/"?path==="/":path===link.path||path.startsWith(`${link.path}/`);return <Link key={link.path} href={link.path} className={active?"active":undefined} aria-current={active?"page":undefined}>{link.label}</Link>;})}</nav><div className="nav-actions">
  {user?<><Link href="/dashboard/notifications" aria-label="Notifications" className="icon-btn bell"><Bell size={19}/><Unread key={unread} initial={unread} realtime={realtime}/></Link><details className="account-menu"><summary aria-label="Account menu"><Avatar name={user.username} id={user.avatarId} size={32}/><span>{user.username}</span><ChevronDown size={14}/></summary><div className="menu-panel"><Link href="/dashboard">Player dashboard <ArrowUpRight size={14}/></Link><Link href={`/players/${user.username}`}>Public profile <ArrowUpRight size={14}/></Link>{user.staff&&<Link href="/admin">Admin dashboard <ArrowUpRight size={14}/></Link>}<SignOut/></div></details></>:<><Link className="login-link" href="/login">Log in</Link><Link className="btn solid compact nav-join" href="/register"><Zap size={15} fill="currentColor"/> Join RJNX</Link></>}
  <button type="button" className="icon-btn nav-toggle" aria-label={open?"Close navigation":"Open navigation"} aria-expanded={open} aria-controls="mobile-nav" onClick={()=>setOpen(open?null:path)}>{open?<X size={23}/>:<Menu size={23}/>}</button></div></div>
  {open&&<nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">{links.map(link=><Link key={link.path} href={link.path} onClick={()=>setOpen(null)}>{link.label}</Link>)}<Link href="/players" onClick={()=>setOpen(null)}>Players</Link>{!user?<><Link href="/login" onClick={()=>setOpen(null)}>Log in</Link><Link className="btn solid" href="/register" onClick={()=>setOpen(null)}>Join RJNX</Link></>:<Link href="/dashboard" onClick={()=>setOpen(null)}>Dashboard</Link>}</nav>}
  </header>;
}
