import React, { useEffect, useState } from 'react';
import { SaasApi, type InspectionRules } from '../services/api';
import {Button, Card, DataTable, Badge, Switch, Skeleton} from './ui';

export function InspectionRulesSettings() {
  const [rules, setRules] = useState<InspectionRules | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { SaasApi.inspectionRules().then(setRules).catch(error => setMessage(error.message)); }, []);
  const save = async () => {
    if (!rules) return;
    setBusy(true); setMessage('');
    try { setRules(await SaasApi.saveInspectionRules(rules)); setMessage('İş kuralları kaydedildi.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Kaydedilemedi.'); }
    finally { setBusy(false); }
  };
  return <Card>
    <h2 className="font-bold text-slate-900">Ölçüm iş kuralları</h2>
    <p className="mt-2 text-sm text-slate-500">Seçili kurallar çalışma alanındaki tüm kullanıcılar için zorunludur. Kapalı alanlar isteğe bağlıdır.</p>
    <p className="mt-2 text-xs text-slate-500">Aktif plan şartı kapalıyken taslak ve arşiv revizyonları da seçilebilir. Ölçüm noktaları için bir kontrol planı her zaman seçilmelidir.</p>
    {rules ? <div className="mt-4 space-y-4"><DataTable label="Ölçüm başlangıcı kuralları"><thead><tr><th>Kural</th><th>Koşul / sonuç</th><th>Durum</th></tr></thead><tbody>{([
      ['requireActivePlan', 'Aktif kontrol planı', 'Ölçüm başlangıcında yalnızca aktif revizyon kullanılabilir.'],
      ['requireLotNumber', 'Parti / şarj numarası', 'Parti / şarj (lot) numarası boş bırakılamaz.'],
      ['requireOrderNumber', 'İş emri numarası', 'İş emri numarası boş bırakılamaz.'],
    ] as const).map(([key, label, description]) => <tr key={key}><td><Switch label={label} checked={rules[key]} disabled={busy} onChange={event=>{setRules({...rules,[key]:event.target.checked});setMessage('');}}/></td><td>{description}</td><td><Badge tone={rules[key]?'success':'neutral'}>{rules[key]?'Zorunlu':'İsteğe bağlı'}</Badge></td></tr>)}</tbody></DataTable>
    <Button variant="primary" loading={busy} onClick={save}>İş kurallarını kaydet</Button></div> : !message && <div role="status" className="mt-4"><span className="rq-helper">Kurallar yükleniyor…</span><Skeleton className="h-24"/></div>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </Card>;
}
