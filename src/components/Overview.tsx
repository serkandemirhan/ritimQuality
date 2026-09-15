import React, {useEffect,useState} from 'react';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,Tooltip} from 'recharts';
import type {InspectionLog} from '../types';
import type {NavTab} from './Navbar';
import {SaasApi} from '../services/api';
import {qualityOverview} from '../services/overview';
import {EmptyState} from './EmptyState';

export function Overview({logs,onNavigate,onOpenLog,canInspect}:{canInspect:boolean;logs:InspectionLog[];onNavigate:(tab:NavTab)=>void;onOpenLog:(log:InspectionLog)=>void}) {
  const [work,setWork]=useState<{summary?:{open_cases:number;overdue_tasks:number;pending_approvals:number};cases:{state:string}[];tasks:{completed_at:string|null;due_at:string}[];approvals:{status:string}[]}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{let live=true;const refresh=async()=>{try{const data=await SaasApi.work() as NonNullable<typeof work>;if(live){setWork(data);setError('');}}catch{if(live)setError('Aksiyon özeti yüklenemedi. Yeniden deneniyor.');}};void refresh();const timer=setInterval(refresh,30000);return()=>{live=false;clearInterval(timer);};},[]);
  const metrics=qualityOverview(logs);
  const open=work?.summary?.open_cases??work?.cases.filter(c=>c.state!=='closed').length;
  const overdue=work?.summary?.overdue_tasks??work?.tasks.filter(t=>!t.completed_at&&Date.parse(t.due_at)<Date.now()).length;
  const pending=work?.summary?.pending_approvals??work?.approvals.filter(a=>a.status==='pending').length;
  return <div className="space-y-6">
    {error&&<p role="status" className="text-sm text-amber-700">{error}</p>}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">{[['Bugünkü kontroller',metrics.today.length],['Uygun',metrics.today.filter(l=>l.overallStatus!=='fail').length],['Uygunsuz',metrics.today.filter(l=>l.overallStatus==='fail').length],['Açık uygunsuzluk',open??'—'],['Geciken görev',overdue??'—']].map(([label,value])=><section key={label} className="quality-card"><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p></section>)}</div>
    <section className="quality-card"><h2 className="text-lg font-semibold">30 günlük kalite trendi</h2><p className="my-3 text-sm text-slate-500">Uygunluk: {metrics.rate===null?'Henüz veri yok':`%${metrics.rate.toFixed(1)}`} · Önceki 30 güne göre {metrics.change===null?'karşılaştırma verisi yok':`${metrics.change>=0?'+':''}${metrics.change.toFixed(1)} yüzde puan`} · Uyarılı, tolerans içindeki kontroller dahildir.</p><div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={metrics.trend}><XAxis dataKey="date" minTickGap={30}/><YAxis domain={[0,100]} unit="%"/><Tooltip/><Line name="Uygunluk (%)" dataKey="rate" stroke="#2563eb" strokeWidth={2} connectNulls={false}/></LineChart></ResponsiveContainer></div></section>
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]"><section className="quality-card"><h2 className="mb-4 text-lg font-semibold">Son Kontroller</h2>{!logs.length?<EmptyState title="İlk kontrolünüzü bekliyoruz" description="Aktif kontrol planıyla kaydettiğiniz ölçümler burada görünür." label="Kontrol başlat" action={canInspect?()=>onNavigate('operator'):undefined}/>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Ürün</th><th>Operatör</th><th>Zaman</th><th>Sonuç</th></tr></thead><tbody>{[...logs].sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)).slice(0,8).map(log=><tr key={log.id} className="border-t border-slate-100"><td className="py-3"><button className="text-blue-700" onClick={()=>onOpenLog(log)}>{log.productCode} · {log.productName}</button></td><td>{log.operatorName}</td><td>{new Date(log.timestamp).toLocaleString('tr-TR')}</td><td className={log.overallStatus==='fail'?'text-red-700':'text-emerald-700'}>{log.overallStatus==='fail'?'Uygunsuz':log.overallStatus==='warning'?'Uygun · Uyarı':'Uygun'}</td></tr>)}</tbody></table></div>}</section>
    <section className="quality-card"><h2 className="mb-4 text-lg font-semibold">Dikkat Gerektirenler</h2>{[['cases','Açık uygunsuzluk',open],['work','Geciken görev',overdue],['approvals','Bekleyen onay',pending]].map(([tab,label,count])=><button key={String(tab)} className="mb-2 flex w-full justify-between rounded-xl bg-amber-50 p-4 text-left text-sm" onClick={()=>onNavigate(tab as NavTab)}><span>{label}</span><strong>{count??'—'}</strong></button>)}{logs.filter(l=>l.overallStatus==='fail').slice(0,3).map(log=><button key={log.id} onClick={()=>onOpenLog(log)} className="mt-2 block text-left text-sm text-red-700">Tolerans dışı: {log.productCode} · {log.sessionCode}</button>)}</section></div>
  </div>;
}
