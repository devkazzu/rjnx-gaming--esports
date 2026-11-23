import type { Metadata } from "next";
import { InfoPage } from "@/components/info";
export const metadata:Metadata={title:'Rules and fair play',description:"Rules and fair play for RJNX Gaming Esports.",alternates:{canonical:"/rules"}};
export default function Page(){return <InfoPage section="rules"/>;}
