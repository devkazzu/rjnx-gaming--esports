import type { Metadata } from "next";
import type { Query } from "@/lib/model";
import { AuthPage } from "@/components/info";
export const metadata:Metadata={title:'Create account',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<Query>}){return <AuthPage mode="register" query={await searchParams}/>;}
