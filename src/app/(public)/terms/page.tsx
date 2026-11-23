import type { Metadata } from "next";
import { InfoPage } from "@/components/info";
export const metadata:Metadata={title:'Terms of use',description:"Terms of use for RJNX Gaming Esports.",alternates:{canonical:"/terms"}};
export default function Page(){return <InfoPage section="terms"/>;}
