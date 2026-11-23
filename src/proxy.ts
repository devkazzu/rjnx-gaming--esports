import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request:NextRequest) {
  let result=NextResponse.next({request});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key||!request.cookies.getAll().some(c=>c.name.startsWith("sb-")&&c.name.includes("-auth-token")))return result;
  const client=createServerClient(url,key,{global:{fetch:(input,options)=>fetch(input,{...options,cache:"no-store",signal:AbortSignal.timeout(8500)})},cookies:{getAll:()=>request.cookies.getAll(),setAll:(list,headers)=>{
    list.forEach(({name,value})=>request.cookies.set(name,value));
    result=NextResponse.next({request});
    list.forEach(({name,value,options})=>result.cookies.set(name,value,{...options,httpOnly:true,secure:(process.env.NEXT_PUBLIC_SITE_URL||request.url).startsWith("https://"),sameSite:"lax"}));
    Object.entries(headers||{}).forEach(([key,value])=>result.headers.set(key,value));
    result.headers.set("Cache-Control","private, no-store");
  }}});
  await client.auth.getClaims().catch(()=>{});
  return result;
}
export const config={matcher:["/((?!api/|auth/|_next/|images/|fonts/|rjnx|robots\\.txt|sitemap\\.xml).*)"]};
