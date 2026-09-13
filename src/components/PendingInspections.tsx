import React, { useEffect, useState } from 'react';
import { SaasApi } from '../services/api';
import { StorageService } from '../services/storage';

export function PendingInspections({onSaved}: {onSaved: () => void}) {
  const [items,setItems]=useState(SaasApi.pendingInspections);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{ const refresh=()=>setItems(SaasApi.pendingInspections()); window.addEventListener('quality-pending-changed',refresh);return()=>window.removeEventListener('quality-pending-changed',refresh);},[]);
  if(!items.length)return null;
  return <section className="m-3 rounded-xl border border-amber-300 bg-amber-50 p-4" role="status">
    <p className="font-bold">{items.length} ölçüm sunucu onayı bekliyor</p>
    <p className="text-sm">Kayıtlar bu cihazda korunuyor. Gönderim tamamlanana kadar cihaz verilerini temizlemeyin.</p>
    {items.map(item=><p key={item.log.id} className="mt-2 text-sm">{item.log.sessionCode} · {item.error || 'Gönderiliyor…'}</p>)}
    <button disabled={busy} className="mt-3 rounded-lg bg-amber-900 px-4 py-3 text-white disabled:opacity-50" onClick={async()=>{setBusy(true);try{for(const item of items)await StorageService.saveInspectionLog(item.log);onSaved();}catch(error){StorageService.reportSyncError(error);}finally{setBusy(false);}}}>{busy?'Gönderiliyor…':'Gönderimi tekrar dene'}</button>
  </section>;
}
