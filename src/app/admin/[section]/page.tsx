import type { Metadata } from "next";
import type { Query } from "@/lib/model";
import { StaffSection } from "@/components/admin";
import { adminRoutes } from "@/server/admin";
type Props={params:Promise<{section:string}>;searchParams:Promise<Query>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {section}=await params;return {title:adminRoutes.find(r=>r.id===section)?.title||"Admin dashboard",robots:{index:false,follow:false}};}
export default async function Page({params,searchParams}:Props){return <StaffSection section={(await params).section} query={await searchParams}/>;}
