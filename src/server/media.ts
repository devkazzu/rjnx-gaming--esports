import { randomUUID } from "node:crypto";
import { and, eq, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import sharp from "sharp";
import { media, news, profiles, settings, teams, tournaments } from "@/db/schema";
import { ADMIN, can, MANAGEMENT, MAX_IMAGE } from "@/lib/model";
import { localEnabled, storageClient, supabaseConfig } from "@/lib/supabase";
import type { Viewer } from "./auth";
import { bodyBytes, Fault, limit, type Tx } from "./http";

export const purposes=["avatar","team","tournament","news","proof","site"] as const;
export type Purpose=typeof purposes[number];
const ext:Record<string,string>={"image/png":"png","image/jpeg":"jpg","image/webp":"webp"};
const bucket="rjnx-media";
function validImage(mime:string,buf:Buffer){
  if(mime==="image/png")return buf.length>33&&buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&buf.toString("ascii",12,16)==="IHDR"&&buf.readUInt32BE(16)>0&&buf.readUInt32BE(16)<=8192&&buf.readUInt32BE(20)>0&&buf.readUInt32BE(20)<=8192;
  if(mime==="image/jpeg")return buf.length>20&&buf[0]===255&&buf[1]===216&&buf[2]===255&&buf.at(-2)===255&&buf.at(-1)===217;
  if(mime==="image/webp")return buf.length>24&&buf.toString("ascii",0,4)==="RIFF"&&buf.toString("ascii",8,12)==="WEBP"&&buf.readUInt32LE(4)+8===buf.length;
  return false;
}
function canPurpose(user:Viewer,purpose:Purpose){return (purpose==="news"||purpose==="site")?can(user.role,ADMIN):purpose==="tournament"||purpose==="proof"?can(user.role,MANAGEMENT):true;}
export async function checkMedia(tx:Tx,user:Viewer,id:string|null,purpose:Purpose){
  if(!id)return;
  const [row]=await tx.select({owner:media.uploader,purpose:media.purpose}).from(media).where(eq(media.id,id));
  if(!row||row.purpose!==purpose||(row.owner!==user.id&&!(can(user.role,MANAGEMENT)&&["tournament","proof","news","site"].includes(purpose))))throw new Fault(422,"Upload a valid image for this field first.");
}
export async function upload(request:Request,user:Viewer,purpose:Purpose){
  if(!canPurpose(user,purpose))throw new Fault(403,"You don’t have permission to upload that image.");
  await limit(`upload:${user.id}`,12,3600);
  const inputMime=(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(!ext[inputMime])throw new Fault(415,"Use a PNG, JPEG or WebP image.");
  const incoming=await bodyBytes(request,MAX_IMAGE);
  if(!validImage(inputMime,incoming))throw new Fault(422,"The uploaded file is not a valid image.");
  let data:Buffer;
  try{
    data=await sharp(incoming,{limitInputPixels:25_000_000,animated:false,failOn:"error"})
      .rotate().resize({width:1920,height:1440,fit:"inside",withoutEnlargement:true}).webp({quality:84,effort:3}).toBuffer();
  }catch{throw new Fault(422,"This image cannot be decoded safely.");}
  if(!data.length||data.length>MAX_IMAGE)throw new Fault(422,"This image is too large after normalization.");
  const mime="image/webp",id=randomUUID(),client=storageClient(),path=`${user.id}/${id}.webp`;
  if(supabaseConfig()||!localEnabled()){
    if(!client)throw new Fault(503,"Supabase image storage is not configured.");
    const {error}=await client.storage.from(bucket).upload(path,new Uint8Array(data),{contentType:mime,upsert:false,cacheControl:"60"});
    if(error)throw new Fault(503,"Image storage is unavailable. Check the bucket configuration.");
    try{await db.insert(media).values({id,uploader:user.id,purpose,mime,size:data.length,path});}catch(error){await client.storage.from(bucket).remove([path]);throw error;}
  }else await db.insert(media).values({id,uploader:user.id,purpose,mime,size:data.length,data});
  return {id,url:`/api/media/${id}`};
}
export async function getMedia(user:Viewer|null,id:string){
  const [record]=await db.select().from(media).where(eq(media.id,id));if(!record)throw new Fault(404,"Image not found.");
  let publicImage=false;
  if(record.purpose==="avatar")publicImage=!!(await db.select({id:profiles.id}).from(profiles).where(and(eq(profiles.avatarId,id),eq(profiles.suspended,false))).limit(1))[0];
  if(record.purpose==="team")publicImage=!!(await db.select({id:teams.id}).from(teams).where(and(eq(teams.logoId,id),eq(teams.active,true))).limit(1))[0];
  if(record.purpose==="tournament")publicImage=!!(await db.select({id:tournaments.id}).from(tournaments).where(and(or(eq(tournaments.bannerId,id),eq(tournaments.logoId,id)),notInArray(tournaments.status,["draft","archived"]))).limit(1))[0];
  if(record.purpose==="site")publicImage=!!(await db.select({key:settings.key}).from(settings).where(and(eq(settings.key,"site"),sql`${settings.value}->>'heroId'=${id}`)).limit(1))[0];
  if(record.purpose==="news")publicImage=!!(await db.select({id:news.id}).from(news).where(and(eq(news.imageId,id),lte(news.publishedAt,new Date()))).limit(1))[0];
  if(!publicImage&&(!user||!(user.id===record.uploader||(["tournament","proof","news","site"].includes(record.purpose)&&canPurpose(user,record.purpose as Purpose)))))throw new Fault(404,"Image not found.");
  if(record.purpose==="proof"&&(!user||!can(user.role,MANAGEMENT)))throw new Fault(404,"Image not found.");
  let data:Blob|Uint8Array<ArrayBuffer>;
  if(record.path){const client=storageClient(); if(!client)throw new Fault(503,"Storage is unavailable.");const result=await client.storage.from(bucket).download(record.path);if(!result.data)throw new Fault(404,"Image not found.");data=result.data;}
  else if(record.data)data=new Uint8Array(record.data);else throw new Fault(404,"Image not found.");
  return new Response(data,{headers:{"Content-Type":record.mime,"Content-Length":String(record.size),"Cache-Control":publicImage?"public, max-age=60":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
}
