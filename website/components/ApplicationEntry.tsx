import React from 'react';
import {site} from '../lib/config';
import {ArrowRight,ShieldCheck} from 'lucide-react';
export function ApplicationEntry({signup=false}:{signup?:boolean}){
  const destination=new URL(site.applicationUrl);destination.searchParams.set('auth',signup?'register':'login');
  return <div className="auth-layout"><span className="eyebrow">TEK HESAP · TEK ÇALIŞMA ALANI</span><h1>{signup?'Atölyenizin çalışma alanını oluşturun.':'Kalite uygulamasına giriş yapın.'}</h1><p>{signup?'Firma hesabınızı oluşturun; iki aktif kontrol planıyla ücretsiz başlayın ve ilk raporunuzu hazırlayın.':'Mevcut firma ve kullanıcı bilgilerinizle devam edin. Satış sitesi için ikinci bir hesap gerekmez.'}</p><div className="form-card"><ShieldCheck size={28}/><p>Kontrol planlarınız, ekibiniz, ölçümleriniz ve aboneliğiniz aynı firma hesabında yönetilir.</p><a className="button button-dark" href={destination.toString()}>{signup?'Ücretsiz hesap oluştur':'Uygulamaya giriş yap'} <ArrowRight size={17}/></a><small>Demo PDF’niz otomatik aktarılmaz. İndirdiğiniz raporu saklayabilirsiniz.</small></div></div>;
}
