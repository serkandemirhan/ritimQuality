import {site} from '@/lib/config';
export default function Page(){const url=new URL(site.applicationUrl);url.searchParams.set('auth','forgot');return <div className="auth-layout"><h1>Hesap erişimi</h1><p>Şifre yenileme işleminize ana kalite uygulamasında devam edin.</p><a className="button button-dark" href={url.toString()}>Şifremi yenile</a></div>;}
