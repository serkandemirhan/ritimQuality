import React, { useState } from 'react';
import { PushSettings } from './PushSettings';
import { WorkCenter } from './WorkCenter';
import { PWAInstall } from './PWAInstall';
import type { User, Product } from '../types';

export function Settings({currentUser,users,products,onInspect,onOpenBackup,onNavigate}:{currentUser:User;users:User[];products:Product[];onInspect:(id:string)=>void;onOpenBackup:()=>void;onNavigate:(tab:'users'|'subscription')=>void}) {
  const [section,setSection]=useState('preferences');
  const key='quality:preferences:'+currentUser.id;
  const [hand,setHand]=useState(()=>localStorage.getItem(key)==='left'?'left':'right');
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-2" aria-label="Ayar kategorileri">
      {[['preferences','Kişisel tercihler'],...(['admin','auditor'].includes(currentUser.role)?[['audit','Denetim izi']]:[])].map(([id,label])=><button key={id} type="button" aria-pressed={section===id} onClick={()=>setSection(id)} className={'rounded-lg px-4 py-3 text-sm font-semibold '+(section===id?'bg-slate-900 text-white':'border border-slate-200 bg-white text-slate-600')}>{label}</button>)}
    </div>
    {section==='preferences'?<div className="max-w-3xl space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold text-slate-900">Ölçüm kullanımı</h2>
        <p className="mt-2 text-sm text-slate-500">Telefon ve tablette menü ile ölçüm düğmelerinin yerleşimini kullandığınız ele göre düzenleyin.</p>
        <label className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">Kullanılan el<select aria-label="Kullanılan el" value={hand} onChange={event=>{setHand(event.target.value);localStorage.setItem(key,event.target.value);document.documentElement.dataset.hand=event.target.value;}} className="rounded-lg border border-slate-300 bg-white px-4 py-3"><option value="right">Sağ el</option><option value="left">Sol el</option></select></label>
        <p className="mt-3 text-xs text-slate-500">Tercihiniz bu tarayıcıda hesabınız için saklanır.</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="font-bold">Cihaz bildirimleri</h2><p className="mt-2 mb-4 text-sm text-slate-500">Uygulama kapalıyken de gelişmelerden haberdar olun. Uygulama içindeki bildirimler üst menüdeki zil simgesinde bulunur.</p><PushSettings/></section>
      <PWAInstall/>
      {currentUser.role==='admin'&&<section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold">Çalışma alanı yönetimi</h2><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={()=>onNavigate('users')} className="rounded-lg border px-4 py-3 text-sm font-semibold">Kullanıcılar ve roller</button><button type="button" onClick={()=>onNavigate('subscription')} className="rounded-lg border px-4 py-3 text-sm font-semibold">Abonelik ve faturalandırma</button><button type="button" onClick={onOpenBackup} className="rounded-lg border px-4 py-3 text-sm font-semibold">Veri Yönetimi</button></div></section>}
    </div>:<WorkCenter section={section} onSectionChange={setSection} currentUser={currentUser} users={users} products={products} onInspect={onInspect}/>}
  </div>;
}
