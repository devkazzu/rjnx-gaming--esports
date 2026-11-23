import type { ReactNode } from "react";
import { Footer, PublicNavigation } from "@/components/site";
export const dynamic="force-dynamic";
export default function PublicLayout({children}:{children:ReactNode}){return <><a className="skip" href="#main">Skip to content</a><PublicNavigation/><main id="main">{children}</main><Footer/></>;}
