import type { Metadata } from "next";
import { Suspense } from "react";
import { Home } from "@/components/site";
import HomeLoading from "@/components/home-loading";
export const metadata:Metadata={alternates:{canonical:"/"}};
export default function Homepage(){return <Suspense fallback={<HomeLoading/>}><Home/></Suspense>;}
