import React, { useEffect, useState } from 'react';
import { AlertTriangle, CloudUpload, RefreshCw } from 'lucide-react';
import { SaasApi } from '../services/api';
import { StorageService } from '../services/storage';
import { Button } from './ui';

export function PendingInspections({onSaved}: {onSaved: () => void}) {
  const [items,setItems]=useState(SaasApi.pendingInspections);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{const refresh=()=>setItems(SaasApi.pendingInspections());window.addEventListener('quality-pending-changed',refresh);return()=>window.removeEventListener('quality-pending-changed',refresh);},[]);
  if(!items.length)return null;
  const failed=items.some(item=>item.error);
  const latest=items[0];
  return <section className="rq-sync-strip" role="status" aria-live="polite">
    <div className="rq-sync-strip-icon">{failed?<AlertTriangle size={18}/>:<CloudUpload size={18}/>}</div>
    <div className="rq-sync-strip-copy">
      <strong>{items.length} ölçüm sunucu onayı bekliyor</strong>
      <span>{latest.log.sessionCode} · {latest.error || 'Kayıt cihazda korunuyor; gönderim kuyruğu izleniyor.'}</span>
    </div>
    <Button loading={busy} variant="primary" onClick={async()=>{setBusy(true);try{for(const item of items)await StorageService.saveInspectionLog(item.log);onSaved();}catch(error){StorageService.reportSyncError(error);}finally{setBusy(false);}}}><RefreshCw size={15}/>Tekrar dene</Button>
  </section>;
}
