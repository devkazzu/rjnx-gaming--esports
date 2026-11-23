"use client";
import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";

export function Toast(){
  const [message,setMessage]=useState("");
  useEffect(()=>{
    let timer:number|undefined;
    function handle(event:Event){const value=(event as CustomEvent<unknown>).detail;if(typeof value!=="string")return;window.clearTimeout(timer);setMessage(value);timer=window.setTimeout(()=>setMessage(""),4300);}
    window.addEventListener("rjnx-toast",handle);
    return()=>{window.removeEventListener("rjnx-toast",handle);window.clearTimeout(timer);};
  },[]);
  return message?<div className="notice success notice-tray" role="status"><CheckCircle2 size={16}/><span>{message}</span><button type="button" className="toast-close" aria-label="Dismiss message" onClick={()=>setMessage("")}><X size={15}/></button></div>:null;
}
