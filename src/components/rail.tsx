"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, ChartNoAxesColumnIncreasing, ChevronDown, ClipboardList, Flag, Gamepad2, Home, Logs, Medal, Megaphone, Newspaper, Settings, Shield, Trophy, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { Avatar } from "./ui";

const icons={home:Home,users:Users,user:UserRound,trophy:Trophy,clipboard:ClipboardList,gamepad:Gamepad2,medal:Medal,shield:Shield,chart:ChartNoAxesColumnIncreasing,news:Newspaper,megaphone:Megaphone,flag:Flag,settings:Settings,audit:Logs,bell:Bell};
export type RailItem={href:string;name:string;icon:keyof typeof icons};
export function Rail({title,name,avatar,items}:{title:string;name:string;avatar:string|null;items:RailItem[]}){
  const path=usePathname();
  const [openPath,setOpenPath]=useState("");
  const open=openPath===path;
  return <aside className="workspace-sidebar panel" data-open={open}><button type="button" className="rail-menu" aria-expanded={open} aria-controls="arena-rail" onClick={()=>setOpenPath(open?"":path)}>{title} <ChevronDown size={15} className="inline"/></button><div className="rail-brand"><Avatar id={avatar} name={name} size={35}/><span><strong>{name}</strong><small>{title}</small></span></div><nav id="arena-rail" className="rail-nav" aria-label={title}>{items.map(item=>{const Icon=icons[item.icon];return <Link key={item.href} className={path===item.href?"active":undefined} href={item.href} onClick={()=>setOpenPath("")} aria-current={path===item.href?"page":undefined}><Icon size={16}/>{item.name}</Link>;})}</nav></aside>;
}
