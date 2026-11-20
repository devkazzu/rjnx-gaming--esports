import type { Metadata } from "next";
import type { Query } from "@/lib/model";
import { PlayersDirectory } from "@/components/public-views";
export const metadata:Metadata={title:'Players',description:'Meet the players in the RJNX esports community.',alternates:{canonical:"/players"}};
export default async function Page({searchParams}:{searchParams:Promise<Query>}){return <PlayersDirectory query={await searchParams}/>;}
