import type { Metadata } from "next";
import type { Query } from "@/lib/model";
import { NewsDirectory } from "@/components/public-views";
export const metadata:Metadata={title:'Esports news',description:'Read tournament and community news from RJNX.',alternates:{canonical:"/news"}};
export default async function Page({searchParams}:{searchParams:Promise<Query>}){return <NewsDirectory query={await searchParams}/>;}
