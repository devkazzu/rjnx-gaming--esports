import type { Metadata } from "next";
import { NewsPage } from "@/components/public-views";
import { getNews } from "@/server/reads";
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params;const item=await getNews(slug);return item?{title:item.article.title,description:(item.article.summary||"Competitive profile on RJNX.").slice(0,155),alternates:{canonical:`/news/${slug}`},openGraph:{title:item.article.title,description:(item.article.summary||"Competitive profile on RJNX.").slice(0,155),images:["/images/rjnx-arena.jpg"]}}:{title:"Not found",robots:{index:false}};}
export default async function Page({params}:Props){return <NewsPage slug={(await params).slug}/>;}
