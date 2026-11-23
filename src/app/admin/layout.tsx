import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageIdentity } from "@/server/auth";
import { adminAllowed, adminRoutes } from "@/server/admin";
import { PublicNavigation } from "@/components/site";
import { Rail } from "@/components/rail";
import { roleNames } from "@/lib/model";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Admin dashboard",robots:{index:false,follow:false}};
export default async function Layout({children}:{children:ReactNode}){const user=await pageIdentity(true);return <><a className="skip" href="#main">Skip to content</a><PublicNavigation/><div className="site-container workspace-wrap"><Rail title={`${roleNames[user.role]} menu`} name={user.username} avatar={user.avatarId} items={adminRoutes.filter(r=>adminAllowed(r.id,user.role)).map(r=>({href:r.id?`/admin/${r.id}`:"/admin",name:r.title,icon:r.icon}))}/><main className="workspace-content" id="main">{children}</main></div></>;}
