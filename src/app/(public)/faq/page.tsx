import type { Metadata } from "next";
import { InfoPage } from "@/components/info";
export const metadata:Metadata={title:'About RJNX',description:"About RJNX for RJNX Gaming Esports.",alternates:{canonical:"/about"}};
export default function Page(){return <InfoPage section="about"/>;}
