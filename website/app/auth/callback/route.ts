import {NextResponse} from 'next/server';
import {serverClient} from '@/lib/supabase/server';
import {authConfigured,site} from '@/lib/config';
import {sitePath} from '@/lib/site-path';
export async function GET(request:Request){
  const url=new URL(request.url),code=url.searchParams.get('code');
  const next=url.searchParams.get('next')==='/reset-password'?'/reset-password':'/onboarding';
  if(code&&authConfigured){try{const supabase=await serverClient();const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(sitePath(next),site.url));}catch{/* An old account link must not strand the visitor on a server error. */}}
  return NextResponse.redirect(new URL(sitePath('/login?error=verification'),site.url));
}
