import type { Metadata } from "next";
import { PlayerPage } from "@/components/public-views";
import { getPlayer } from "@/server/reads";
type Props={params:Promise<{username:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {username}=await params;const item=await getPlayer(username);return item?{title:item.username,description:(item.bio||"Competitive profile on RJNX.").slice(0,155),alternates:{canonical:`/players/${username}`},openGraph:{title:item.username,description:(item.bio||"Competitive profile on RJNX.").slice(0,155),images:["/images/rjnx-arena.jpg"]}}:{title:"Not found",robots:{index:false}};}
export default async function Page({params}:Props){return <PlayerPage username={(await params).username}/>;}
