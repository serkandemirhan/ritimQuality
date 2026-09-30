import {chartColors, chartAxis, chartTooltip} from './ui/chartTheme';
import { Card, MetricCard, ChartCard, DataTable, StatusBadge, Button, Badge } from './ui';
import { ArrowUpRight, AlertTriangle, Activity } from 'lucide-react';
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
    {error&&<p role="status" className="rq-helper">{error}</p>}
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
      <MetricCard label="Bugünkü kontroller" value={metrics.today.length} detail="Kaydedilmiş kontrol oturumları"/>
      <MetricCard label="Bugün uygun" value={metrics.today.filter(l=>l.overallStatus!=='fail').length} detail="Tolerans içindeki sonuçlar" tone="success"/>
      <MetricCard label="Bugün uygunsuz" value={metrics.today.filter(l=>l.overallStatus==='fail').length} detail="İnceleme gerektiren kontroller" tone="danger"/>
      <MetricCard label="Açık uygunsuzluk" value={open??'—'} detail="Kapanışı bekleyen aksiyonlar" tone={open?'danger':'neutral'}/>
      <MetricCard label="Geciken görev" value={overdue??'—'} detail="Termini geçmiş açık görevler" tone={overdue?'warning':'neutral'}/>
    </div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <ChartCard title="Kalite nabzı" description="Son 30 gün · Tolerans içindeki kontrollerin günlük oranı">
        {metrics.rate===null?<EmptyState title="Bu dönemde kontrol yok" description="Son 30 günde kaydedilen ölçümler kalite trendini oluşturur."/>:<ResponsiveContainer width="100%" height="100%"><LineChart data={metrics.trend} margin={{top:16,right:20,left:0,bottom:8}}><XAxis {...chartAxis} dataKey="date" minTickGap={36}/><YAxis {...chartAxis} domain={[0,100]} unit="%"/><Tooltip {...chartTooltip}/><Line name="Uygunluk (%)" dataKey="rate" stroke={chartColors.measurement} strokeWidth={2} dot={{r:3,strokeWidth:2,fill:'white'}} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer>}
      </ChartCard>
      <Card><div className="flex items-center justify-between"><h2 className="rq-section-title">Dikkat gerektirenler</h2><AlertTriangle size={17} className="text-amber-600"/></div><p className="rq-helper">Açık kalite koşulları ve bekleyen işler</p>
        <div className="space-y-2">{[['cases','Açık uygunsuzluk',open],['work','Geciken görev',overdue],['approvals','Bekleyen onay',pending]].map(([tab,label,count])=><Button key={String(tab)} className="w-full justify-between" onClick={()=>onNavigate(tab as NavTab)}><span>{label}</span><Badge tone={Number(count)>0?'warning':'neutral'}>{count??'—'}</Badge></Button>)}</div>
        <div className="mt-4 border-t border-slate-100 pt-3 space-y-2">{logs.filter(l=>l.overallStatus==='fail').slice(0,3).map(log=><button key={log.id} onClick={()=>onOpenLog(log)} className="rq-attention-link"><AlertTriangle size={14}/><span><strong>{log.productCode}</strong><small>{log.sessionCode}</small></span><ArrowUpRight size={14}/></button>)}</div>
      </Card>
    </div>
    <div className="rq-summary"><span>30 günlük uygunluk <strong>{metrics.rate===null?'Henüz veri yok':`%${metrics.rate.toFixed(1)}`}</strong></span><span>Önceki döneme göre <strong>{metrics.change===null?'Karşılaştırma verisi yok':`${metrics.change>=0?'+':''}${metrics.change.toFixed(1)} yüzde puan`}</strong></span><span>Uyarılı, tolerans içindeki kontroller dahildir.</span></div>
    <Card><div className="mb-4 flex items-center justify-between"><h2 className="rq-section-title">Son kontroller</h2><Button variant="ghost" onClick={()=>onNavigate('logs')}>Tüm kayıtlar <ArrowUpRight size={14}/></Button></div>
      {!logs.length?<EmptyState title="İlk kontrolünüzü bekliyoruz" description="Aktif kontrol planıyla kaydettiğiniz ölçümler burada görünür." label="Kontrol başlat" action={canInspect?()=>onNavigate('operator'):undefined}/>:<DataTable label="Son kontroller"><thead><tr><th>Ürün / parça</th><th>Operatör</th><th>Zaman</th><th>Sonuç</th><th><span className="sr-only">İşlem</span></th></tr></thead><tbody>{[...logs].sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)).slice(0,8).map(log=><tr key={log.id}><td><button className="rq-row-link" onClick={()=>onOpenLog(log)}><span className="rq-technical">{log.productCode}</span><small>{log.productName}</small></button></td><td>{log.operatorName}</td><td className="rq-technical">{new Date(log.timestamp).toLocaleString('tr-TR')}</td><td><StatusBadge status={log.overallStatus}/></td><td><Button variant="ghost" aria-label={log.sessionCode+' kaydını aç'} onClick={()=>onOpenLog(log)}><ArrowUpRight size={15}/></Button></td></tr>)}</tbody></DataTable>}
    </Card>
  </div>;
}
