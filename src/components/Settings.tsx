import {currentRelease, releaseHistory} from '../releaseHistory';
import { InspectionRulesSettings } from './InspectionRulesSettings';
import React, { useState } from 'react';
import { PushSettings } from './PushSettings';
import { WorkCenter } from './WorkCenter';
import { PWAInstall } from './PWAInstall';
import type { User, Product } from '../types';
import {Button, Select, Tabs} from './ui';

export function Settings({currentUser,users,products,onInspect,onOpenBackup,onNavigate}:{currentUser:User;users:User[];products:Product[];onInspect:(id:string)=>void;onOpenBackup:()=>void;onNavigate:(tab:'users'|'subscription')=>void}) {
  const [section,setSection]=useState('preferences');
  const key='quality:preferences:'+currentUser.id;
  const [hand,setHand]=useState(()=>localStorage.getItem(key)==='left'?'left':'right');
  return <div className="space-y-6">
    <Tabs label="Ayar kategorileri" value={section} onChange={setSection} items={[{id:'preferences',label:'Kişisel tercihler'},{id:'releases',label:'Sürüm geçmişi'},...(['admin','auditor'].includes(currentUser.role)?[{id:'audit',label:'Denetim izi'}]:[])]}/>
    {section==='releases'?<div className="max-w-3xl space-y-4"><section className="rq-card"><h2 className="font-bold text-slate-900">Değişiklik geçmişi</h2><p className="mt-2 text-sm text-slate-500">Uygulama sürümleri ve yayınlanan yenilikler.</p><p className="mt-3 text-sm font-semibold">Uygulama v{currentRelease.version} · Gerekli veritabanı sürümü {currentRelease.databaseVersion}</p></section>{releaseHistory.map(release=><article className="rq-card" key={release.version}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">v{release.version}</h3><span className="text-xs text-slate-500">{release.date ? new Date(release.date+'T12:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'}) : 'Yayın tarihi henüz belirlenmedi'}</span></div><p className="mt-1 text-xs text-slate-500">Gerekli veritabanı sürümü: {release.databaseVersion}</p><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">{release.changes.map(change=><li key={change}>{change}</li>)}</ul></article>)}</div>:section==='preferences'?<div className="max-w-3xl space-y-5">
      <section className="rq-card">
        <h2 className="font-bold text-slate-900">Ölçüm kullanımı</h2>
        <p className="mt-2 text-sm text-slate-500">Telefon ve tablette menü ile ölçüm düğmelerinin yerleşimini kullandığınız ele göre düzenleyin.</p>
        <label className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">Kullanılan el<Select aria-label="Kullanılan el" value={hand} onChange={event=>{setHand(event.target.value);localStorage.setItem(key,event.target.value);document.documentElement.dataset.hand=event.target.value;}}><option value="right">Sağ el</option><option value="left">Sol el</option></Select></label>
        <p className="mt-3 text-xs text-slate-500">Tercihiniz bu tarayıcıda hesabınız için saklanır.</p>
      </section>
      <section className="rq-card"><h2 className="font-bold">Cihaz bildirimleri</h2><p className="mt-2 mb-4 text-sm text-slate-500">Uygulama kapalıyken de gelişmelerden haberdar olun. Uygulama içindeki bildirimler üst menüdeki zil simgesinde bulunur.</p><PushSettings/></section>
      {currentUser.role==='admin'&&<InspectionRulesSettings/>}
      <PWAInstall/>
      {currentUser.role==='admin'&&<section className="rq-card"><h2 className="font-bold">Çalışma alanı yönetimi</h2><div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={()=>onNavigate('users')}>Kullanıcılar ve roller</Button><Button type="button" onClick={()=>onNavigate('subscription')}>Abonelik ve faturalandırma</Button><Button type="button" onClick={onOpenBackup}>Veri Yönetimi</Button></div></section>}
    </div>:<WorkCenter section={section} onSectionChange={setSection} currentUser={currentUser} users={users} products={products} onInspect={onInspect}/>}
  </div>;
}
