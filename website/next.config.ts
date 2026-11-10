import type {NextConfig} from 'next';
const basePath=process.env.NEXT_PUBLIC_BASE_PATH||'';
if(basePath&&!/^\/[a-z0-9-]+$/.test(basePath))throw new Error('Invalid site base path');
const config:NextConfig={basePath,poweredByHeader:false,turbopack:{root:process.cwd()},
  async redirects(){return basePath?['/','/demo','/pricing','/signup','/login','/privacy','/terms','/help','/forgot-password','/reset-password'].map(source=>({source,destination:basePath+(source==='/'?'':source),basePath:false as const,permanent:false})):[];}
};
export default config;
