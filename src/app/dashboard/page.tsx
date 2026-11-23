import type { Query } from "@/lib/model";
import { Dashboard } from "@/components/dashboard";
export default async function Page({searchParams}:{searchParams:Promise<Query>}){return <Dashboard section="" query={await searchParams}/>;}
