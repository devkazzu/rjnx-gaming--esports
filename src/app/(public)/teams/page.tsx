import type { Metadata } from "next";
import type { Query } from "@/lib/model";
import { TeamsDirectory } from "@/components/public-views";
export const metadata:Metadata={title:'Teams',description:'Explore competitive rosters in the RJNX arena.',alternates:{canonical:"/teams"}};
export default async function Page({searchParams}:{searchParams:Promise<Query>}){return <TeamsDirectory query={await searchParams}/>;}
