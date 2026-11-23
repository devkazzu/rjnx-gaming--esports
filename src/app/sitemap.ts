import type { MetadataRoute } from "next";
import { and, eq, lte, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { news, profiles, teams, tournaments } from "@/db/schema";
export const dynamic="force-dynamic";
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const url=(process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000").replace(/\/$/,"");
  const paths=["/","/about","/tournaments","/leaderboard","/teams","/players","/news","/rules","/contact","/faq","/privacy-policy","/terms"];
  const sources=await Promise.all([
    db.select({slug:tournaments.slug,date:tournaments.updatedAt}).from(tournaments).where(notInArray(tournaments.status,["draft","archived"])).orderBy(tournaments.slug).limit(10000),
    db.select({slug:teams.slug,date:teams.updatedAt}).from(teams).where(eq(teams.active,true)).orderBy(teams.slug).limit(10000),
    db.select({slug:profiles.username,date:profiles.updatedAt}).from(profiles).where(eq(profiles.suspended,false)).orderBy(profiles.username).limit(10000),
    db.select({slug:news.slug,date:news.updatedAt}).from(news).where(and(lte(news.publishedAt,new Date()))).orderBy(news.slug).limit(10000),
  ]);
  const prefixes=["tournaments","teams","players","news"];
  return [...paths.map(path=>({url:`${url}${path}`})),...sources.flatMap((rows,i)=>rows.map(row=>({url:`${url}/${prefixes[i]}/${row.slug}`,lastModified:row.date})))];
}
