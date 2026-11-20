import type {ReactNode} from "react";
import { PublicNavigation } from "@/components/site";
export const dynamic="force-dynamic";
export default function Layout({children}:{children:ReactNode}){return <><PublicNavigation/><main>{children}</main></>;}
