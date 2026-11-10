'use client';
import {browserClient} from '@/lib/supabase/client';
import {Button} from './ui/button';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
export function AccountSettings({email}:{email:string}){const router=useRouter(),[error,setError]=useState('');return <div className="workspace-card"><h2>Hesabınız</h2><p>{email}</p><div className="row" style={{marginTop:20}}><a href="/forgot-password" className="button button-outline">Şifremi yenile</a><Button onClick={async()=>{const{error}=await browserClient().auth.signOut();if(error){setError('Çıkış yapılamadı.');return;}router.push('/login');router.refresh();}}>Çıkış yap</Button></div>{error&&<p role="alert">{error}</p>}</div>;}
