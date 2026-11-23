"use client";
import { CircleAlert, RefreshCcw } from "lucide-react";
export default function ErrorView({reset}:{reset:()=>void}){return <main className="site-container content-page"><section className="panel empty" role="alert"><span className="feature-icon"><CircleAlert size={22}/></span><h3>Connection to the arena interrupted.</h3><p>Try reloading this view. Your saved work hasn’t changed.</p><button className="btn solid" onClick={reset}><RefreshCcw size={16}/>Try again</button></section></main>;}
