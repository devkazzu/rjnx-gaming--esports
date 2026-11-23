import Link from "next/link";
import { Zap } from "lucide-react";
import { Brand } from "@/components/ui";
export default function NotFound(){return <main className="not-found"><Brand/><span className="feature-icon"><Zap size={22}/></span><p className="eyebrow">ERROR 404</p><h1>OFF THE MAP.</h1><p>That page or competition isn’t available.</p><Link href="/" className="btn solid">Return to the arena</Link></main>;}
