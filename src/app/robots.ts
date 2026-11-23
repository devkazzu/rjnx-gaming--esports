import type { MetadataRoute } from "next";
export default function robots():MetadataRoute.Robots {
  const site=process.env.NEXT_PUBLIC_SITE_URL;
  return site?{rules:{userAgent:"*",allow:"/",disallow:["/admin","/dashboard","/api/","/auth/","/login","/register","/reset-password","/forgot-password"]},sitemap:new URL("/sitemap.xml",site).toString()}:{rules:{userAgent:"*",disallow:"/"}};
}
