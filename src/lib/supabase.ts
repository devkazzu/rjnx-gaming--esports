import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cookieOptions } from "@/server/http";

export function supabaseConfig() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url&&key ? {url,key}:null;
}
export const localEnabled=() => {
  if (process.env.RJNX_AUTH_MODE==="supabase" || process.env.VERCEL==="1") return false;
  try {return new Set(["localhost","127.0.0.1","[::1]"]).has(new URL(process.env.DATABASE_URL||"").hostname);} catch {return false;}
};
export async function supabaseServer(request?:Request) {
  const config=supabaseConfig(); if (!config) return null;
  const jar=await cookies();
  return createServerClient(config.url,config.key,{global:{fetch:(url,options)=>fetch(url,{...options,cache:"no-store",signal:AbortSignal.timeout(9500)})},cookies:{
    getAll:()=>jar.getAll(),
    setAll:(list)=>{try{for(const {name,value,options} of list)jar.set(name,value,{...options,...(request?cookieOptions(request):{httpOnly:true})});}catch{/* The proxy handles refresh for server-rendered pages. */}},
  }});
}
export function storageClient() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url&&key ? createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false},global:{fetch:(url,options)=>fetch(url,{...options,cache:"no-store",signal:AbortSignal.timeout(12000)})}}):null;
}
