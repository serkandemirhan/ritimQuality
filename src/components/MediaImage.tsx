import React, {useEffect,useState} from 'react';
import { SaasApi } from '../services/api';

export function useMediaSource(source: string | undefined) {
  const [resolved,setResolved]=useState('');
  useEffect(()=>{
    if(!source?.startsWith('media:'))return;
    let active=true;let url='';setResolved('');
    SaasApi.mediaUrl(source.slice(6).split('#')[0]).then(value=>{url=value;if(active)setResolved(value);else if(value.startsWith('blob:'))URL.revokeObjectURL(value);}).catch(()=>{if(active)setResolved('');});
    return()=>{active=false;if(url.startsWith('blob:'))URL.revokeObjectURL(url);};
  },[source]);
  return source?.startsWith('media:') ? resolved : source;
}
export function MediaImage({src,...props}:React.ImgHTMLAttributes<HTMLImageElement>) {
  const resolved=useMediaSource(src);
  if(isPdfMedia(src))return <object data={resolved||undefined} type="application/pdf" className={props.className} aria-label={props.alt||'PDF teknik resim'}/>;
  return <img {...props} src={resolved||undefined}/>;
}
export const isPdfMedia=(source:string|undefined)=>Boolean(source?.startsWith('data:application/pdf')||source?.endsWith('#application/pdf'));
