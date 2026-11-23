"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, Send, Upload, X } from "lucide-react";
import { useCallback, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "motion/react";
import { MAX_IMAGE } from "@/lib/model";
import { ErrorText } from "./ui";

type Reply={error?:string;message?:string;id?:string;redirect?:string;url?:string};
export async function call(endpoint:string,method:string,data?:unknown){
  const file=data instanceof File;
  const response=await fetch(`/api${endpoint}`,{method,cache:"no-store",signal:AbortSignal.timeout(18000),...(data===undefined?{}:file?{headers:{"Content-Type":data.type},body:data}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(data)})});
  const payload=await response.json().catch(()=>({})) as Reply;
  if(!response.ok)throw Error(payload.error||`Request failed (${response.status}).`);
  return payload;
}
const err=(e:unknown)=>e instanceof Error && e.name==="TimeoutError"?"The arena took too long to respond. Try again.":e instanceof Error?e.message:"Something went wrong.";
export const fv=(form:FormData,key:string)=>String(form.get(key)??"");
export const has=(form:FormData,key:string)=>form.get(key)==="on";
export const idValue=(form:FormData,key:string)=>fv(form,key)||null;
export const dateValue=(form:FormData,key:string)=>{const value=fv(form,key);return value?`${value}${value.length===16?":00":""}Z`:null;};
export const num=(form:FormData,key:string)=>Number(fv(form,key));
export const fields=(form:FormData,keys:string[])=>Object.fromEntries(keys.map(key=>[key,fv(form,key)]));
export function InlineSuccess({text}:{text:string}){return <p className="notice success" role="status"><CheckCircle2 size={16}/>{text}</p>;}
export function Field({label,hint,...props}:{label:string;hint?:string}&InputHTMLAttributes<HTMLInputElement>){return <label className="field"><span>{label}</span><input {...props}/>{hint&&<small>{hint}</small>}</label>;}
export function Textbox({label,name,value,rows=4,required=false,maxLength=3000,hint}:{label:string;name:string;value?:string;rows?:number;required?:boolean;maxLength?:number;hint?:string}){return <label className="field"><span>{label}</span><textarea name={name} rows={rows} defaultValue={value} required={required} maxLength={maxLength}/>{hint&&<small>{hint}</small>}</label>;}
export function Select({name,label,options,value,empty,required=false}:{name:string;label:string;options:readonly (string|{value:string;label:string})[];value?:string|null;empty?:string;required?:boolean}){return <label className="field"><span>{label}</span><select name={name} defaultValue={value||""} required={required}>{empty!==undefined&&<option value="">{empty}</option>}{options.map(item=>typeof item==="string"?<option key={item}>{item}</option>:<option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;}
export function Check({name,label,checked,required=false}:{name:string;label:ReactNode;checked?:boolean;required?:boolean}){return <label className="checkbox-field"><input type="checkbox" name={name} defaultChecked={checked} required={required}/><span>{label}</span></label>;}
export function UploadField({name,purpose,label,initial,small=false}:{name:string;purpose:string;label:string;initial?:string|null;small?:boolean}){
  const [id,setId]=useState(initial||""),[working,setWorking]=useState(false),[problem,setProblem]=useState("");
  async function add(file?:File,input?:HTMLInputElement){if(input)input.value="";if(!file)return;setProblem("");if(file.size>MAX_IMAGE||!file.size){setProblem("Choose an image no larger than 3 MiB.");return;}setWorking(true);try{const data=await call(`/media/${purpose}`,"POST",file);if(!data.id)throw Error("Image upload did not complete.");setId(data.id);}catch(e){setProblem(err(e));}finally{setWorking(false);}}
  return <div className="upload"><span className="upload-label">{label}</span><input type="hidden" name={name} value={id}/><div className="upload-row">{id&&<a href={`/api/media/${id}`} target="_blank" rel="noreferrer" aria-label={`Preview ${label}`}><Image className="upload-preview" src={`/api/media/${id}`} alt="" width={42} height={34} unoptimized/></a>}<label className="btn outline compact upload-btn">{working?<LoaderCircle size={14} className="animate-spin"/>:<Upload size={14}/>} {working?"Uploading…":small?"Upload":"Choose image"}<input type="file" aria-label={label} accept="image/png,image/jpeg,image/webp" disabled={working} data-uploading={working?"true":"false"} onChange={e=>void add(e.currentTarget.files?.[0],e.currentTarget)}/></label>{id&&<button type="button" className="icon-btn" onClick={()=>setId("")} aria-label={`Remove ${label}`} disabled={working}><X size={13}/></button>}</div>{problem&&<ErrorText message={problem}/>}</div>;
}
export function ActionForm({endpoint,children,method="POST",encode,success="Saved successfully.",label="Save changes",to,refresh=true,hideOnSuccess=false,className="form-stack"}:{endpoint:string;children:ReactNode;method?:string;encode?:(form:FormData)=>unknown;success?:string;label?:string;to?:string;refresh?:boolean;hideOnSuccess?:boolean;className?:string}){
  const router=useRouter();const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[problem,setProblem]=useState("");
  const onSubmit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(busy)return;const form=e.currentTarget;setMessage("");setProblem("");if(form.querySelector('[data-uploading="true"]')){setProblem("Wait for the image upload to finish first.");return;}
    const formData=new FormData(form);setBusy(true);
    try{const result=await call(endpoint,method,encode?encode(formData):Object.fromEntries(formData));setMessage(result.message||success);if(to){window.dispatchEvent(new CustomEvent("rjnx-toast",{detail:result.message||success}));router.push(to); }if(refresh)router.refresh();}
    catch(e){setProblem(err(e));}finally{setBusy(false);}
  };
  if(message&&hideOnSuccess)return <InlineSuccess text={message}/>;
  return <form className={className} onSubmit={onSubmit} aria-busy={busy}><fieldset disabled={busy} className="form-stack">{children}<div className="form-actions"><button type="submit" className="btn solid" disabled={busy}>{busy?<LoaderCircle size={16} className="animate-spin"/>:<ArrowRight size={16}/>} {busy?"Working…":label}</button></div></fieldset>{problem&&<ErrorText message={problem}/>} {message&&<InlineSuccess text={message}/>}</form>;
}
export function ActionButton({endpoint,label,data,method="PATCH",confirm,success="Updated.",danger=false,icon,hide=false}:{endpoint:string;label:string;data?:unknown;method?:string;confirm?:string;success?:string;danger?:boolean;icon?:ReactNode;hide?:boolean}){
  const router=useRouter();const [busy,setBusy]=useState(false),[asked,setAsk]=useState(false),[status,setStatus]=useState(""),[problem,setProblem]=useState("");
  async function act(){if(confirm&&!asked){setAsk(true);return;}setBusy(true);setStatus("");setProblem("");try{await call(endpoint,method,data);setAsk(false);setStatus(success);router.refresh();window.dispatchEvent(new Event("rjnx-notification"));}catch(e){setProblem(err(e));}finally{setBusy(false);}}
  return <div className="confirm-wrap">{!(status&&hide)&&<div className="inline-buttons"><button className={`btn compact ${danger?"danger":"outline"}`} type="button" onClick={()=>void act()} disabled={busy}>{busy?<LoaderCircle size={13} className="animate-spin"/>:icon}{busy?"Working…":asked?"Confirm":label}</button>{asked&&<button className="btn compact outline" onClick={()=>setAsk(false)} disabled={busy}>Cancel</button>}</div>}{asked&&<p className="form-help">{confirm}</p>}{problem&&<ErrorText message={problem}/>} {status&&<span className="form-help" role="status">{status}</span>}</div>;
}
export function RoomButton({matchId}:{matchId:string}){
  const [room,setRoom]=useState<{roomId:string;password:string}|null>(null),[busy,setBusy]=useState(false),[problem,setProblem]=useState("");
  const show=useCallback(async()=>{if(room){setRoom(null);return;}setBusy(true);setProblem("");try{const response=await fetch(`/api/me/matches/${matchId}/room`,{cache:"no-store",signal:AbortSignal.timeout(10000)});const value=await response.json();if(!response.ok)throw Error(value.error||"Room is unavailable.");setRoom(value);}catch(e){setProblem(err(e));}finally{setBusy(false);}},[room,matchId]);
  return <div><button type="button" className="btn outline compact" onClick={()=>void show()} disabled={busy}><LockKeyhole size={14}/>{room?"Hide room details":busy?"Loading room…":"Reveal room details"}</button>{room&&<div className="room-secret"><span><b>Room ID:</b> <code>{room.roomId}</code></span><span><b>Password:</b> <code>{room.password||"No password"}</code></span><small>Private to approved participants. Don’t share these details.</small></div>}{problem&&<ErrorText message={problem}/>}</div>;
}
export function EntryForm({tournamentId,roster,teamId,size,ownId}:{tournamentId:string;roster:{id:string;username:string;ign:string}[];teamId:string|null;size:number;ownId:string}){
  const [selected,setSelected]=useState<string[]>(()=>roster.length===size?roster.map(p=>p.id):[ownId]);
  return <ActionForm endpoint="/me/registrations" label="Submit registration" success="Entry received. Track your approval in My tournaments." hideOnSuccess encode={form=>({tournamentId,teamId,rulesAccepted:has(form,"rules"),note:fv(form,"note"),players:selected.map(id=>({id,ign:fv(form,`ign:${id}`)}))})}>
    {roster.length>size&&<div><p className="form-label">Choose {size} players (including yourself)</p><div className="choice-grid">{roster.map(p=><label key={p.id}><input type="checkbox" aria-label={`Select ${p.username}`} checked={selected.includes(p.id)} disabled={p.id===ownId||(!selected.includes(p.id)&&selected.length>=size)} onChange={e=>setSelected(current=>e.target.checked?[...current,p.id]:current.filter(id=>id!==p.id))}/><span>{p.username}</span></label>)}</div></div>}
    {roster.filter(p=>selected.includes(p.id)).map(p=><Field key={p.id} name={`ign:${p.id}`} label={teamId?`In-game name · ${p.username}`:"In-game username"} required maxLength={64} defaultValue={p.ign}/>)}
    <Textbox name="note" label="Note to staff (optional)" maxLength={500} rows={2}/><Check name="rules" label={<>I have read and agree to the <a className="text-link" href="#event-rules">tournament rules</a>.</>} required/>
  </ActionForm>;
}
export function AuthForm({mode,next,notice,local}:{mode:"login"|"register"|"forgot"|"reset";next:string;notice?:string;local:boolean}){
  const router=useRouter();const [shown,setShown]=useState(false),[status,setStatus]=useState(""),[problem,setProblem]=useState(""); const reduce=useReducedMotion();
  const form=useForm<{email:string;username:string;password:string}>({defaultValues:{email:"",username:"",password:""}});
  const {register,handleSubmit,formState:{isSubmitting,errors}}=form;
  const labels={login:"Log in",register:"Create account",forgot:"Send recovery link",reset:"Set new password"};
  async function submit(values:{email:string;username:string;password:string}){setProblem("");setStatus("");try{
    const result=await call("/session","POST",{action:mode,...values});
    if(result.redirect){router.replace(mode==="login"||mode==="register"?next||result.redirect:result.redirect);router.refresh();}else setStatus(result.message||"Check your inbox for the next step.");
  }catch(e){setProblem(err(e));}}
  return <motion.div className="auth-form" initial={reduce?false:{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:.2}}><p className="eyebrow"><i/> RJNX PLAYER ACCESS</p><h1>{{login:"Welcome back.",register:"Join the arena.",forgot:"Recover access.",reset:"Set a new password."}[mode]}</h1><p className="form-intro">{{login:"Sign in to manage your squad and competitions.",register:"Create your player account and compete for your spot.",forgot:"We’ll send a secure password recovery link.",reset:"Choose a strong password to secure your account."}[mode]}</p>{notice&&<p className="notice">{notice}</p>}{local&&(mode==="forgot"||mode==="reset")&&<p className="notice">Email recovery requires a configured Supabase environment.</p>}
  <form className="form-stack" onSubmit={handleSubmit(submit)}><fieldset disabled={isSubmitting} className="form-stack">{mode!=="reset"&&<label className="field"><span>Email address</span><input type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" {...register("email",{required:true})}/></label>}{mode==="register"&&<label className="field"><span>Player handle</span><input autoComplete="username" required placeholder="your_handle" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" {...register("username",{required:true,pattern:/^[a-zA-Z0-9_]{3,24}$/})}/><small>3–24 letters, numbers or underscores.</small></label>}
  {mode!=="forgot"&&<><label className="field"><span>{mode==="reset"?"New password":"Password"}</span><input type={shown?"text":"password"} autoComplete={mode==="login"?"current-password":"new-password"} required maxLength={128} minLength={mode==="login"?1:12} {...register("password",{required:true,minLength:mode==="login"?1:12})}/></label><div className="inline-buttons"><button className="text-link" type="button" onClick={()=>setShown(!shown)}>{shown?<EyeOff size={15}/>:<Eye size={15}/>} {shown?"Hide password":"Show password"}</button>{mode==="login"&&<Link className="text-link" href="/forgot-password">Forgot password?</Link>}</div></>}
  {Object.keys(errors).length>0&&<ErrorText message="Check the required fields."/>}<button className="btn solid" type="submit" disabled={isSubmitting||Boolean(status)}>{isSubmitting?<LoaderCircle className="animate-spin" size={17}/>:<ArrowRight size={17}/>} {isSubmitting?"Working…":labels[mode]}</button></fieldset>{problem&&<ErrorText message={problem}/>} {status&&<InlineSuccess text={status}/>}</form><div className="form-end">{mode==="login"?<span>New here? <Link href="/register">Create an account</Link></span>:<Link href="/login">Back to login</Link>}</div></motion.div>;
}
export function ContactForm({email}:{email?:string}){return <ActionForm endpoint="/contact" label="Send message" success="Your message was received. Staff will review it in the support queue." refresh={false} hideOnSuccess><Field name="email" type="email" label="Contact email" defaultValue={email} required maxLength={254}/><Field name="subject" label="Subject" required minLength={3} maxLength={120}/><Textbox name="body" label="How can we help?" required rows={6} maxLength={4000}/><p className="form-help"><Send size={13} className="inline"/> Never include passwords or match room credentials.</p></ActionForm>;}
