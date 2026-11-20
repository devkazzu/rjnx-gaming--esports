import type { Metadata } from "next";
import type { Query } from "@/lib/model";
import { LeaderboardView } from "@/components/public-views";
export const metadata:Metadata={title:'Leaderboard',description:'Verified competitive standings across RJNX tournaments.',alternates:{canonical:"/leaderboard"}};
export default async function Page({searchParams}:{searchParams:Promise<Query>}){return <LeaderboardView query={await searchParams}/>;}
