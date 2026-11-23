"use client";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

type Ticket={url:string;key:string;userId:string;token:string;expiresAt:number};
export function subscribeInbox(changed:()=>void){
  let active=true;
  let client:SupabaseClient|undefined;
  let subscription:RealtimeChannel|undefined;
  const controller=new AbortController();
  async function credentials():Promise<Ticket|null>{
    try{
      const response=await fetch("/api/me/notifications/realtime",{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(9000)])});
      if(!response.ok)return null;
      const data=await response.json() as Partial<Ticket>;
      if(typeof data.token!=="string"||typeof data.expiresAt!=="number"||typeof data.key!=="string"||typeof data.url!=="string"||typeof data.userId!=="string")return null;
      return data as Ticket;
    }catch{return null;}
  }
  void (async()=>{
    const first=await credentials();if(!active||!first)return;
    let access:Ticket|null=first;
    client=createClient(first.url,first.key,{accessToken:async()=>{
      if(!active)return null;
      if(access&&access.expiresAt>Date.now()/1000+60)return access.token;
      access=await credentials();return access?.userId===first.userId?access.token:null;
    },auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    subscription=client.channel(`rjnx:inbox:${first.userId}`,{config:{private:true}}).on("broadcast",{event:"changed"},()=>{if(active)changed();}).subscribe();
  })().catch(()=>{/* Polling remains available if Realtime is not configured. */});
  return ()=>{active=false;controller.abort();if(client&&subscription)void client.removeChannel(subscription);};
}
