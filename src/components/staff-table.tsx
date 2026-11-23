"use client";
import Link from "next/link";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";
import { type ReactNode } from "react";
import { Badge, Empty } from "./ui";

export type Cell={text:string;secondary?:string;badge?:string;href?:string;action?:boolean};
export type StaffRow={id:string;cells:Cell[]};
export function StaffTable({headings,rows,caption}:{headings:{name:string;secondary?:boolean}[];rows:StaffRow[];caption:string}){
  const columns:ColumnDef<StaffRow,Cell>[] = headings.map((column,index)=>({id:String(index),accessorFn:row=>row.cells[index],header:column.name,cell:info=>{
    const value=info.getValue(); if(!value)return "—";
    let main:ReactNode=value.badge?<Badge state={value.badge}>{value.text}</Badge>:value.text||"—";
    if(value.href)main=<Link href={value.href} className={value.action?"btn outline compact":undefined}>{main}{value.action&&<ArrowUpRight size={13}/>}</Link>;
    return <>{main}{value.secondary&&<small className="inline-record">{value.secondary}</small>}</>;
  }}));
  // TanStack retains a stable table instance; this component intentionally renders directly from it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table=useReactTable({data:rows,columns,getCoreRowModel:getCoreRowModel(),getRowId:row=>row.id});
  if(!rows.length)return <div className="panel"><Empty title="No matching records" text="Try a different search or filter."/></div>;
  return <div className="table-wrap panel" tabIndex={0} role="region" aria-label={caption}><table className="mutation-table"><caption className="sr-only">{caption}</caption><thead>{table.getHeaderGroups().map(group=><tr key={group.id}>{group.headers.map(header=><th className={headings[Number(header.column.id)].secondary?"wide-col":undefined} key={header.id}>{flexRender(header.column.columnDef.header,header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map(row=><tr key={row.id}>{row.getVisibleCells().map(cell=><td key={cell.id} className={headings[Number(cell.column.id)].secondary?"wide-col":undefined}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</td>)}</tr>)}</tbody></table></div>;
}
