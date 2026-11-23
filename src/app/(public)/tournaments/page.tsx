import type { Metadata } from "next";
import type { Query } from "@/lib/model";
import { TournamentDirectory } from "@/components/public-views";
export const metadata:Metadata={title:'Tournaments',description:'Find and enter RJNX esports competitions.',alternates:{canonical:"/tournaments"}};
export default async function Page({searchParams}:{searchParams:Promise<Query>}){return <TournamentDirectory query={await searchParams}/>;}
