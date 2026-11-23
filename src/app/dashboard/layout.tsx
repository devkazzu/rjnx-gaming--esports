import type { ReactNode } from "react";
import type { Metadata } from "next";
import { pageIdentity } from "@/server/auth";
import { PublicNavigation } from "@/components/site";
import { Rail } from "@/components/rail";
import { playerNav } from "@/components/dashboard";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Player dashboard",robots:{index:false,follow:false}};
export default async function Layout({children}:{children:ReactNode}){const user=await pageIdentity();return <><a href="#main" className="skip">Skip to content</a><PublicNavigation/><div className="site-container workspace-wrap"><Rail title="Player menu" name={user.username} avatar={user.avatarId} items={playerNav}/><main className="workspace-content" id="main">{children}</main></div></>;}
