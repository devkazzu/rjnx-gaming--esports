const hosted=!!process.env.NEXT_PUBLIC_SITE_URL;
const security=[
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
  {key:"Content-Security-Policy",value:`object-src 'none'; base-uri 'self'; form-action 'self'${hosted?"; frame-ancestors 'none'":""}`},
  ...(hosted?[{key:"X-Frame-Options",value:"DENY"}]:[]),
];
/** @type {import('next').NextConfig} */
const config={poweredByHeader:false,experimental:{optimizePackageImports:["lucide-react","recharts"]},async headers(){return [{source:"/:path*",headers:security},{source:"/rjnx-source.zip",headers:[{key:"Content-Disposition",value:'attachment; filename="rjnx-source.zip"'}]}];}};
export default config;
