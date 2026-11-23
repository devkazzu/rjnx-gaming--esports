"use client";

import dynamic from "next/dynamic";
const Chart=dynamic(()=>import("./chart-inner"),{ssr:false,loading:()=> <div className="chart-fallback" role="status">Loading activity…</div>});
export function ActivityChart({data}:{data:{label:string;entries:number;matches:number}[]}){return <Chart data={data}/>;}
