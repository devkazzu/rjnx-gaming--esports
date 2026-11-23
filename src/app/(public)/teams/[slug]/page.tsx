import type { Metadata } from "next";
import { TeamPage } from "@/components/public-views";
import { getTeam } from "@/server/reads";
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params;const item=await getTeam(slug);return item?{title:item.name,description:(item.description||"Competitive profile on RJNX.").slice(0,155),alternates:{canonical:`/teams/${slug}`},openGraph:{title:item.name,description:(item.description||"Competitive profile on RJNX.").slice(0,155),images:["/images/rjnx-arena.jpg"]}}:{title:"Not found",robots:{index:false}};}
export default async function Page({params}:Props){return <TeamPage slug={(await params).slug}/>;}
