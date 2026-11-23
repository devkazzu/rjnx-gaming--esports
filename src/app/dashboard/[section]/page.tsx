import type { Metadata } from "next";
import type { Query } from "@/lib/model";
import { Dashboard, playerNav } from "@/components/dashboard";
type Props={params:Promise<{section:string}>;searchParams:Promise<Query>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {section}=await params;return {title:playerNav.find(p=>p.href===`/dashboard/${section}`)?.name||"Player dashboard",robots:{index:false,follow:false}};}
export default async function Page({params,searchParams}:Props){return <Dashboard section={(await params).section} query={await searchParams}/>;}
