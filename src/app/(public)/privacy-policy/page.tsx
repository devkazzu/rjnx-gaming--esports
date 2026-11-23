import type { Metadata } from "next";
import { InfoPage } from "@/components/info";
export const metadata:Metadata={title:'Privacy policy',description:"Privacy policy for RJNX Gaming Esports.",alternates:{canonical:"/privacy-policy"}};
export default function Page(){return <InfoPage section="privacy-policy"/>;}
