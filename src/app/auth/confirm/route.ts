import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requestOrigin } from "@/server/http";
import { grantRecovery } from "@/server/auth";

export async function GET(request:Request){
  const target=requestOrigin(request);
  const query=new URL(request.url).searchParams;
  const token=query.get("token_hash"), type=query.get("type"), code=query.get("code");
  const auth=await supabaseServer(request);
  if(auth){
    if(token&&token.length<=512&&(type==="email"||type==="signup"||type==="recovery")){
      const {data,error}=await auth.auth.verifyOtp({token_hash:token,type});
      if(!error&&data.user){
        if(type==="recovery"){
          try {await grantRecovery(request,data.user.id);} catch {return NextResponse.redirect(new URL("/login?notice=recovery-unavailable",target));}
          return NextResponse.redirect(new URL("/reset-password",target));
        }
        return NextResponse.redirect(new URL("/dashboard",target));
      }
    }else if(code&&code.length<=512){
      const {error}=await auth.auth.exchangeCodeForSession(code);
      if(!error)return NextResponse.redirect(new URL("/dashboard",target));
    }
  }
  return NextResponse.redirect(new URL("/login?notice=expired",target));
}
