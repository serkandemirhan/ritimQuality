import type {Metadata} from 'next';
import {Header} from '@/components/Header';
import {Footer} from '@/components/Footer';
import {site} from '@/lib/config';
import './globals.css';
import './mobile.css';
export const metadata:Metadata={metadataBase:new URL(site.url),title:{default:'Ritim Quality — Kalite kontrol artık çok daha kolay',template:'%s | Ritim Quality'},description:'Teknik resmini yükle. Ölçümünü yap. Raporunu oluştur. CNC atölyeleri ve üretim ekipleri için çizim tabanlı kalite kontrol.',openGraph:{type:'website',locale:'tr_TR',siteName:site.name,title:'Kalite kontrol artık çok daha kolay.',description:'Çizimden ölçüme, ölçümden rapora. Kayıt olmadan örnek demoyu deneyin.'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="tr" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main">İçeriğe geç</a><Header/><main id="main">{children}</main><Footer/></body></html>;}
