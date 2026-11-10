import {useEffect,useState} from 'react';
import {SaasApi} from '../services/api';
import {Button,Card} from './ui';
export function VerifyEmailNotice(){
  const [profile,setProfile]=useState<{email:string;workspace:string}|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{let active=true;Promise.all([SaasApi.authCapabilities(),SaasApi.accountProfile()]).then(([cap,user])=>{if(active&&cap.accountEmail&&!user.email_verified_at)setProfile(user);}).catch(()=>{});return()=>{active=false;};},[]);
  if(!profile)return null;
  return <Card className="mb-6"><h2 className="font-bold">E-posta adresinizi doğrulayın</h2><p className="text-sm text-slate-600 mt-2">Hesap iletişimi için {profile.email} adresinin size ait olduğunu doğrulayın.</p><Button className="mt-3" disabled={busy||Boolean(message)} onClick={async()=>{setBusy(true);try{const result=await SaasApi.requestAccountLink({...profile,purpose:'verify'});setMessage(result.message);}catch(error){setMessage(error instanceof Error?error.message:'İşlem tamamlanamadı.');}finally{setBusy(false);}}}>{busy?'Hazırlanıyor…':'Doğrulama bağlantısı iste'}</Button>{message&&<p role="status" className="mt-3 text-sm">{message}</p>}</Card>;
}
