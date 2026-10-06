import {chartColors, chartAxis, chartTooltip} from './ui/chartTheme';
import { Card, DataTable, StatusBadge, Button, Badge } from './ui';
import { ArrowUpRight, AlertTriangle, Activity, CheckCircle2, Clock3, Gauge, ShieldCheck, Factory, Radar } from 'lucide-react';
import React, {useEffect,useMemo,useState} from 'react';
import {ResponsiveContainer,Line,XAxis,YAxis,Tooltip,Area,ComposedChart,Bar,ReferenceLine} from 'recharts';
import type {InspectionLog} from '../types';
import type {NavTab} from './Navbar';
import {SaasApi} from '../services/api';
import {qualityOverview} from '../services/overview';
import {EmptyState} from './EmptyState';

type WorkState={summary?:{open_cases:number;overdue_tasks:number;pending_approvals:number};cases:{state:string}[];tasks:{completed_at:string|null;due_at:string}[];approvals:{status:string}[]};

export function Overview({logs,onNavigate,onOpenLog,canInspect}:{canInspect:boolean;logs:InspectionLog[];onNavigate:(tab:NavTab)=>void;onOpenLog:(log:InspectionLog)=>void}) {
  const [work,setWork]=useState<WorkState|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{let live=true;const refresh=async()=>{try{const data=await SaasApi.work() as WorkState;if(live){setWork(data);setError('');}}catch{if(live)setError('Aksiyon özeti yüklenemedi. Yeniden deneniyor.');}};void refresh();const timer=setInterval(refresh,30000);return()=>{live=false;clearInterval(timer);};},[]);
  const metrics=qualityOverview(logs);
  const sorted=useMemo(()=>[...logs].sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)),[logs]);
  const open=work?.summary?.open_cases??work?.cases.filter(c=>c.state!=='closed').length;
  const overdue=work?.summary?.overdue_tasks??work?.tasks.filter(t=>!t.completed_at&&Date.parse(t.due_at)<Date.now()).length;
  const pending=work?.summary?.pending_approvals??work?.approvals.filter(a=>a.status==='pending').length;
  const failCount=logs.filter(log=>log.overallStatus==='fail').length;
  const warningCount=logs.filter(log=>log.overallStatus==='warning').length;
  const todayPass=metrics.today.filter(l=>l.overallStatus!=='fail').length;
  const todayFail=metrics.today.filter(l=>l.overallStatus==='fail').length;
  const lastLog=sorted[0];
  const healthTone=metrics.rate===null?'neutral':metrics.rate>=95?'success':metrics.rate>=85?'warning':'danger';
  const healthLabel=metrics.rate===null?'Veri bekleniyor':metrics.rate>=95?'Kontrol altında':metrics.rate>=85?'Yakın izleme':'Aksiyon gerekli';
  const activeRisks=Number(open||0)+Number(overdue||0)+Number(pending||0);
  const trendData=metrics.trend.map(item=>({...item,count:item.count||0}));
  const breakdown=(field:(log:InspectionLog)=>string)=>Object.entries(logs.reduce<Record<string,{total:number;fail:number}>>((acc,log)=>{
    const key=field(log)||'Belirtilmedi';const item=acc[key]||{total:0,fail:0};item.total+=1;if(log.overallStatus==='fail')item.fail+=1;acc[key]=item;return acc;
  },{})).map(([label,value])=>({label,...value,rate:value.total?Math.round((value.total-value.fail)/value.total*100):0})).sort((a,b)=>b.total-a.total).slice(0,4);
  const breakdownGroups=[['Ürün kırılımı',breakdown(log=>log.productCode)],['İstasyon kırılımı',breakdown(log=>log.machineNo)],['Operatör kırılımı',breakdown(log=>log.operatorName)]] as const;
  const statusStrip=[
    ['Bugünkü kontroller',metrics.today.length,'Kaydedilmiş oturumlar','neutral'],
    ['Uygun sonuç',todayPass,'Tolerans içinde','success'],
    ['Uygunsuz sonuç',todayFail,'İnceleme gerektirir','danger'],
    ['Açık uygunsuzluk',open??'--','Kapanış bekleyen',open?'danger':'neutral'],
    ['Geciken görev',overdue??'--','Termin aşımı',overdue?'warning':'neutral'],
  ] as const;
  return <div className="rq-overview rq-overview-creative">
    <section className="rq-overview-hero rq-overview-cockpit">
      <div className="rq-overview-brand-rail" aria-hidden="true"><span/><span/><span/></div>
      <div className="rq-cockpit-grid" aria-hidden="true"/>
      <div className="rq-overview-hero-copy">
        <div className="rq-cockpit-titlebar"><span className="rq-eyebrow">Ritim Quality / Genel Bakış</span><Badge tone={healthTone}>{healthLabel}</Badge></div>
        <h2>{healthLabel}</h2>
        <p>Kalite nabzı, risk kuyruğu ve son ölçüm hareketleri tek operasyon yüzeyinde izleniyor.</p>
        <div className="rq-overview-hero-actions">
          <Button variant="primary" onClick={()=>canInspect?onNavigate('operator'):onNavigate('logs')}><Gauge size={16}/>{canInspect?'Kontrol başlat':'Kayıtları aç'}</Button>
          <Button onClick={()=>onNavigate(activeRisks?'cases':'logs')}><ArrowUpRight size={15}/>{activeRisks?'Riskleri incele':'Son kayıtlar'}</Button>
        </div>
      </div>
      <div className={'rq-overview-score rq-overview-score-'+healthTone}>
        <span>30 günlük uygunluk</span>
        <strong>{metrics.rate===null?'--':`%${metrics.rate.toFixed(1)}`}</strong>
        <small>{metrics.change===null?'Karşılaştırma için önceki dönem verisi bekleniyor':`${metrics.change>=0?'+':''}${metrics.change.toFixed(1)} puan önceki döneme göre`}</small>
      </div>
      <div className="rq-overview-hero-stats">
        <div><CheckCircle2 size={16}/><span>Bugün uygun</span><strong>{todayPass}</strong><small>tolerans içinde</small></div>
        <div><AlertTriangle size={16}/><span>Aktif risk</span><strong>{activeRisks}</strong><small>takip bekliyor</small></div>
        <div><Clock3 size={16}/><span>Son ölçüm</span><strong>{lastLog?new Date(lastLog.timestamp).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}):'--'}</strong><small>{lastLog?.productCode||'kayıt yok'}</small></div>
      </div>
    </section>
    {error&&<p role="status" className="rq-overview-inline-alert">{error}</p>}
    <div className="rq-ops-strip" aria-label="Kalite metrikleri">
      {statusStrip.map(([label,value,detail,tone])=><div key={label} className={'rq-ops-metric rq-ops-metric-'+tone}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}
    </div>
    <div className="rq-overview-grid">
      <Card className="rq-premium-chart rq-chart-module"><div className="rq-chart-heading"><div><span className="rq-eyebrow">Trend modülü</span><h2 className="rq-section-title">Kalite nabzı</h2><p className="rq-helper">Son 30 gün · uygunluk oranı, kontrol hacmi ve hedef çizgisi</p></div><Badge tone={healthTone}>{healthLabel}</Badge></div><div className="rq-chart">
        {metrics.rate===null?<EmptyState title="Bu dönemde kontrol yok" description="Son 30 günde kaydedilen ölçümler kalite trendini oluşturur."/>:<ResponsiveContainer width="100%" height="100%"><ComposedChart data={trendData} margin={{top:16,right:20,left:0,bottom:8}}><XAxis {...chartAxis} dataKey="date" minTickGap={34}/><YAxis {...chartAxis} yAxisId="rate" domain={[0,100]} unit="%"/><YAxis {...chartAxis} yAxisId="count" orientation="right" allowDecimals={false}/><Tooltip {...chartTooltip}/><ReferenceLine yAxisId="rate" y={95} stroke="#be2846" strokeDasharray="6 6" label={{value:'Hedef %95',fill:'#7b8798',fontSize:11}}/><Bar yAxisId="count" name="Kontrol" dataKey="count" fill="#d8e2ee" radius={[3,3,0,0]}/><Area yAxisId="rate" name="Uygunluk (%)" dataKey="rate" fill="#dcecf7" stroke="none" connectNulls={false}/><Line yAxisId="rate" name="Uygunluk (%)" dataKey="rate" stroke={chartColors.measurement} strokeWidth={2.5} dot={{r:3,strokeWidth:2,fill:'white'}} connectNulls={false} isAnimationActive={false}/></ComposedChart></ResponsiveContainer>}
      </div></Card>
      <Card className="rq-command-card rq-radar-card">
        <div className="rq-command-card-head"><div><span className="rq-eyebrow">Risk radarı</span><h2 className="rq-section-title">Öncelik kuyruğu</h2><p className="rq-helper">Açık kalite koşulları ve bekleyen işler</p></div><Radar size={18}/></div>
        <div className="rq-command-list">{[['cases','Açık uygunsuzluk',open,'Kök neden ve aksiyon takibi'],['work','Geciken görev',overdue,'Termin geçmiş görevler'],['approvals','Bekleyen onay',pending,'Kalite kararı bekleyen ölçümler']].map(([tab,label,count,detail])=><button key={String(tab)} className="rq-command-item" onClick={()=>onNavigate(tab as NavTab)}><span><strong>{label}</strong><small>{detail}</small></span><Badge tone={Number(count)>0?'warning':'neutral'}>{count??'--'}</Badge></button>)}</div>
        <div className="rq-risk-stack">
          <div><ShieldCheck size={16}/><span>Toplam kayıt</span><strong>{logs.length}</strong></div>
          <div><AlertTriangle size={16}/><span>Uygunsuz</span><strong>{failCount}</strong></div>
          <div><Activity size={16}/><span>Uyarılı</span><strong>{warningCount}</strong></div>
        </div>
        <div className="rq-command-recent">{logs.filter(l=>l.overallStatus==='fail').slice(0,3).map(log=><button key={log.id} onClick={()=>onOpenLog(log)} className="rq-attention-link"><AlertTriangle size={14}/><span><strong>{log.productCode}</strong><small>{log.sessionCode}</small></span><ArrowUpRight size={14}/></button>)}</div>
      </Card>
    </div>
    <div className="rq-breakdown-grid">
      {breakdownGroups.map(([title,items])=><Card key={title} className="rq-breakdown-card rq-analytic-card"><div className="rq-breakdown-head"><Factory size={15}/><h2 className="rq-section-title">{title}</h2></div><div className="rq-breakdown-list">{items.length?items.map(item=><div key={item.label} className="rq-breakdown-item"><div><strong>{item.label}</strong><small>{item.total} kontrol · {item.fail} uygunsuz</small></div><span>{item.rate}%</span><progress value={item.rate} max={100} aria-label={item.label+' uygunluk'}/></div>):<p className="rq-helper">Kırılım için kayıt bekleniyor.</p>}</div></Card>)}
    </div>
    <Card className="rq-overview-records"><div className="mb-4 flex items-center justify-between gap-4"><div><span className="rq-eyebrow">Kayıt akışı</span><h2 className="rq-section-title">Son kontroller</h2><p className="rq-helper">En yeni ölçüm oturumları ve sonuç durumları</p></div><Button variant="ghost" onClick={()=>onNavigate('logs')}>Tüm kayıtlar <ArrowUpRight size={14}/></Button></div>
      {!logs.length?<EmptyState title="İlk kontrolünüzü bekliyoruz" description="Aktif kontrol planıyla kaydettiğiniz ölçümler burada görünür." label="Kontrol başlat" action={canInspect?()=>onNavigate('operator'):undefined}/>:<DataTable label="Son kontroller" className="rq-premium-record-table"><thead><tr><th>Durum</th><th>Ürün / parça</th><th>Operatör / istasyon</th><th>Zaman</th><th>Sonuç</th><th><span className="sr-only">İşlem</span></th></tr></thead><tbody>{sorted.slice(0,8).map(log=><tr key={log.id} className={'rq-record-row rq-record-row-'+log.overallStatus}><td><span className="rq-record-status-line" aria-hidden="true"/></td><td><button className="rq-row-link" onClick={()=>onOpenLog(log)}><span className="rq-technical">{log.productCode}</span><small>{log.productName}</small></button></td><td>{log.operatorName}<small>{log.machineNo}</small></td><td className="rq-technical">{new Date(log.timestamp).toLocaleString('tr-TR')}</td><td><StatusBadge status={log.overallStatus}/></td><td><Button variant="ghost" aria-label={log.sessionCode+' kaydını aç'} onClick={()=>onOpenLog(log)}><ArrowUpRight size={15}/></Button></td></tr>)}</tbody></DataTable>}
    </Card>
  </div>;
}
