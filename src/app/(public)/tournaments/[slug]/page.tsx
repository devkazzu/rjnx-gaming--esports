import type { Metadata } from "next";
import { TournamentPage } from "@/components/public-views";
import { getTournament } from "@/server/reads";
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params;const item=await getTournament(slug);return item?{title:item.title,description:(item.description||"Competitive profile on RJNX.").slice(0,155),alternates:{canonical:`/tournaments/${slug}`},openGraph:{title:item.title,description:(item.description||"Competitive profile on RJNX.").slice(0,155),images:["/images/rjnx-arena.jpg"]}}:{title:"Not found",robots:{index:false}};}
export default async function Page({params}:Props){return <TournamentPage slug={(await params).slug}/>;}
