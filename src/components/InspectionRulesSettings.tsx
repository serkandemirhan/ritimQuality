import React, { useEffect, useState } from 'react';
import { SaasApi, type InspectionRules } from '../services/api';

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
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
    <h2 className="font-bold text-slate-900">Ölçüm iş kuralları</h2>
    <p className="mt-2 text-sm text-slate-500">Seçili kurallar çalışma alanındaki tüm kullanıcılar için zorunludur. Kapalı alanlar isteğe bağlıdır.</p>
    <p className="mt-2 text-xs text-slate-500">Aktif plan şartı kapalıyken taslak ve arşiv revizyonları da seçilebilir. Ölçüm noktaları için bir kontrol planı her zaman seçilmelidir.</p>
    {rules ? <div className="mt-4 space-y-3">{([
      ['requireActivePlan', 'Yalnızca aktif kontrol planıyla ölçüm yap'],
      ['requireLotNumber', 'Parti / şarj (lot) numarası zorunlu'],
      ['requireOrderNumber', 'İş emri numarası zorunlu'],
    ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={rules[key]} disabled={busy} onChange={event => { setRules({...rules, [key]: event.target.checked}); setMessage(''); }} className="h-4 w-4 accent-blue-600"/>{label}</label>)}
    <button type="button" disabled={busy} onClick={save} className="quality-primary">{busy ? 'Kaydediliyor…' : 'İş kurallarını kaydet'}</button></div> : !message && <p className="mt-4 text-sm">Kurallar yükleniyor…</p>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
