import {redirect} from 'next/navigation';
import {authConfigured} from './config';
import {serverClient} from './supabase/server';
export async function account(){if(!authConfigured)redirect('/login');const supabase=await serverClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');return {supabase,user};}
export async function workspace(){const {supabase,user}=await account();const {data,error}=await supabase.from('site_workspaces').select('id,name,plan_id,created_at').eq('owner_id',user.id).maybeSingle();if(error)throw new Error('Çalışma alanı bağlantısı tamamlanamadı.');if(!data)redirect('/onboarding');return {supabase,user,workspace:data};}
