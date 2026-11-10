'use client';
import {useState} from 'react';
import {browserClient} from '@/lib/supabase/client';
import {authConfigured} from '@/lib/config';
import {Button} from './ui/button';
export function GoogleLogin(){const[busy,setBusy]=useState(false),[error,setError]=useState('');if(!authConfigured||process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED!=='true')return null;return <div><Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');const{error}=await browserClient().auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/auth/callback'}});if(error){setError('Google ile giriş başlatılamadı.');setBusy(false);}}}>Google ile devam et</Button>{error&&<p role="alert" className="error">{error}</p>}</div>;}
