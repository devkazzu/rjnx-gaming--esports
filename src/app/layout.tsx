import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Toast } from "@/components/toast";
const url=process.env.NEXT_PUBLIC_SITE_URL;
export const metadata:Metadata={
  metadataBase:new URL(url||"http://localhost:3000"),applicationName:"RJNX GAMING ESPORTS",
  title:{default:"RJNX GAMING ESPORTS — Play. Compete. Conquer.",template:"%s | RJNX GAMING ESPORTS"},
  description:"Enter the RJNX arena. Find esports tournaments, build your squad, and climb the competitive leaderboard.",
  icons:{icon:"/rjnx-logo.svg"},
  openGraph:{type:"website",siteName:"RJNX Gaming Esports",title:"RJNX Gaming Esports — Enter the Arena",description:"Play. Compete. Conquer.",images:["/images/rjnx-arena.jpg"]},
  twitter:{card:"summary_large_image",title:"RJNX Gaming Esports — Enter the Arena",images:["/images/rjnx-arena.jpg"]},
};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en"><body>{children}<Toast/></body></html>;}
