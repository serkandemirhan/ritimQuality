'use client';
import {sitePath} from '@/lib/site-path';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from './ui/button';
import {track} from '@/lib/analytics';
export function SaveSample(){const[message,setMessage]=useState(''),[busy,setBusy]=useState(false);const router=useRouter();return <div><Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);setMessage('');try{const data=sessionStorage.getItem('ritim:sample-measurements');if(!data)throw Error('Önce örnek ölçümü tamamlayın.');const request=await fetch(sitePath('/api/sample-inspections'),{method:'POST',headers:{'Content-Type':'application/json'},body:data});const response=await request.json();if(!request.ok)throw Error(response.error||'Kayıt tamamlanamadı.');track('first_inspection_completed');setMessage('Örnek kontrol kaydedildi.');router.push('/app/inspections');router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Kayıt tamamlanamadı.');}finally{setBusy(false);}}}>{busy?'Kaydediliyor…':'Son örnek ölçümümü kaydet'}</Button>{message&&<p role="status" style={{fontSize:12,marginTop:8}}>{message}</p>}</div>;}
