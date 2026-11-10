// Next Link prefixes navigation automatically. Native assets and fetch need this helper.
export const siteBasePath=process.env.NEXT_PUBLIC_BASE_PATH||'';
export const sitePath=(path:string)=>`${siteBasePath}${path.startsWith('/')?path:'/'+path}`;
