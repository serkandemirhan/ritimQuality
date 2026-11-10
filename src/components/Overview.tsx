import {controlLabel} from '../services/controlLabel';
import {Fragment,useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,AlertCircle,CheckCircle2,RefreshCw,Clock3} from 'lucide-react';
import {ResponsiveContainer,Line,XAxis,YAxis,Tooltip,ComposedChart,Bar,LabelList,ReferenceArea,ReferenceLine} from 'recharts';
import {chartColors,chartAxis,chartTooltip} from './ui/chartTheme';
import {StatusBadge} from './ui';
import {Onboarding} from './Onboarding';
import {SampleControl} from './SampleControl';
import type {InspectionLog,Product,ControlPlan} from '../types';
import type {NavTab} from './Navbar';
import {SaasApi} from '../services/api';
import {qualityOverview} from '../services/overview';
import './overview.css';
import './overview-refinement.css';
import './overview-validation.css';
import {DailyOperatorPerformance} from './DailyOperatorPerformance';

type WorkState={summary?:{open_cases:number;overdue_tasks:number;pending_approvals:number};cases:{state:string}[];tasks:{completed_at:string|null;due_at:string}[];approvals:{status:string}[]};
const dateLabel=(timestamp:string)=>new Date(timestamp).toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',year:'numeric'});
export function Overview({logs,products,plans,onNavigate,onOpenLog,onOpenReport,canInspect,canManage}:{logs:InspectionLog[];products:Product[];plans:ControlPlan[];canInspect:boolean;canManage:boolean;onNavigate:(tab:NavTab)=>void;onOpenLog:(log:InspectionLog)=>void;onOpenReport:(log:InspectionLog)=>void}) {
  const [work,setWork]=useState<WorkState|null>(null);
  const [error,setError]=useState(false),[busy,setBusy]=useState(false);
  const [refreshKey,setRefreshKey]=useState(0);
  useEffect(()=>{let live=true;const refresh=async()=>{if(live)setBusy(true);try{const value=await SaasApi.work() as WorkState;if(live){setWork(value);setError(false);}}catch{if(live)setError(true);}finally{if(live)setBusy(false);}};void refresh();const timer=setInterval(refresh,30000);return()=>{live=false;clearInterval(timer);};},[refreshKey]);
  const [days,setDays]=useState<7|30|90>(30);
  const [sampleOpen,setSampleOpen]=useState(false);
  const [compact,setCompact]=useState(()=>window.matchMedia('(max-width:760px)').matches);
  const [chartMode,setChartMode]=useState<'rate'|'volume'>('rate');
  useEffect(()=>{const media=window.matchMedia('(max-width:760px)');const update=()=>setCompact(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const [chartWidth,setChartWidth]=useState(0);
  const metrics=qualityOverview(logs,new Date(),days);
  const sorted=useMemo(()=>[...logs].sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)),[logs]);
  const currentCount=metrics.count;
  const open=work?.summary?.open_cases??work?.cases.filter(c=>c.state!=='closed').length??0;
  const overdue=work?.summary?.overdue_tasks??work?.tasks.filter(t=>!t.completed_at&&Date.parse(t.due_at)<Date.now()).length??0;
  const pending=work?.summary?.pending_approvals??work?.approvals.filter(a=>a.status==='pending').length??0;
  const ready=plans.some(p=>p.isActive&&p.status==='active');
  const newInspection=()=>onNavigate(ready?'operator':canManage?'control-plans':'logs');
  const nextLabel=ready?'Kontrol başlat':canManage?'Kontrol planlarını aç':'Kontrol kayıtları';
  const hasPrior=logs.length>0;
  const priorities=[{count:overdue,label:'Geciken görev',detail:'Hedef tarihi geçen işleri gözden geçirin.',tab:'work'},{count:pending,label:'Bekleyen onay',detail:'Kontrol sonuçları kararınızı bekliyor.',tab:'approvals'},{count:open,label:'Açık uygunsuzluk',detail:'İnceleme ve düzeltici aksiyonları takip edin.',tab:'cases'}].filter(item=>item.count>0);
  const last=sorted[0];
  const measuredDays=metrics.trend.filter(day=>day.count>0);
  const chartData=compact&&measuredDays.length?metrics.trend.slice(metrics.trend.indexOf(measuredDays[0]),metrics.trend.indexOf(measuredDays[measuredDays.length-1])+1):metrics.trend;
  const missingDays=metrics.trend.filter(day=>day.count===0).length;
  const gaps:{start:string;end:string}[]=[];
  for(let i=0;i<chartData.length;i++){if(chartData[i].count)continue;const start=chartData[i].date;while(i+1<chartData.length&&!chartData[i+1].count)i++;gaps.push({start,end:chartData[i].date});}
  const gapMarks=gaps.map(gap=><Fragment key={gap.start}>{gap.start===gap.end?<ReferenceLine x={gap.start} stroke="#adb9b3" strokeDasharray="3 3"/>:<ReferenceArea x1={gap.start} x2={gap.end} className="ov-data-gap"/>}</Fragment>);
  const lowestDay=measuredDays.reduce<(typeof measuredDays)[number]|undefined>((lowest,day)=>!lowest||day.rate!<lowest.rate!?day:lowest,undefined);
  const labeledDates=new Set([measuredDays[0]?.date,lowestDay?.date,measuredDays.at(-1)?.date]);
  const breakdown=(field:(log:InspectionLog)=>string)=>Object.entries(logs.reduce<Record<string,number>>((acc,log)=>{const key=field(log)||'Belirtilmedi';acc[key]=(acc[key]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).slice(0,4);
  return <div className="rq-overview ov-page">
    {sampleOpen&&<SampleControl onClose={()=>setSampleOpen(false)}/>}
    {!hasPrior?<Onboarding products={products} plans={plans} canManage={canManage} canInspect={canInspect} onNavigate={onNavigate} onTrySample={()=>setSampleOpen(true)}/>:<>
      <header className="ov-heading"><div><h2>Kaliteye genel bakış</h2><p>Son {days} gün · {currentCount} kontrol</p></div>{canInspect&&<button className="ov-primary" onClick={newInspection}>{nextLabel}<ArrowRight size={16}/></button>}</header>
      <div className="ov-period" role="group" aria-label="Analiz dönemi">{([7,30,90] as const).map(value=><button key={value} aria-pressed={days===value} onClick={()=>setDays(value)}>{value} gün</button>)}<span>Oran ve grafik dönemi</span></div>
      {metrics.rate===null?<section className="ov-inactive"><Clock3 size={24}/><div><h3>Bu dönemde kontrol kaydı yok.</h3><p>Geçmiş ölçümleriniz korunuyor. Son kontrol: {dateLabel(last.timestamp)}.</p></div><button className="ov-text-button" onClick={()=>onNavigate('logs')}>Geçmiş kayıtları aç <ArrowRight size={15}/></button></section>:<section className="rq-overview-summary ov-summary" aria-label="Kalite özeti">
        <div><span>Uygunluk oranı</span><strong>%{metrics.rate.toLocaleString('tr-TR',{maximumFractionDigits:1})}</strong><small>{metrics.passCount} uygun{metrics.warningCount>0?` + ${metrics.warningCount} uyarılı`:""} / {currentCount} kontrol</small><details className="ov-rate-info"><summary>Nasıl hesaplanır?</summary><p>{metrics.passCount} uygun + {metrics.warningCount} uyarılı + {metrics.failCount} uygunsuz = {currentCount} kontrol. Uyarılı sonuçlar, tolerans içinde oldukları için hem paydaki uygun sayısına hem paydadaki toplam kontrol sayısına dahildir. Oran = (uygun + uyarılı) / toplam kontrol × 100. Numune veya ölçüm noktası değil, kontrol oturumu sayılır.</p></details>{metrics.change!==null&&<small className="ov-change">{metrics.change>=0?'+':''}{metrics.change.toLocaleString('tr-TR',{maximumFractionDigits:1})} puan önceki {days} güne göre</small>}</div>
        <div><span>Açık uygunsuzluklar</span><strong>{error?'Alınamadı':!work?'Yükleniyor…':open}</strong><small>{error?'İş özeti yeniden yüklenmeli.':!work?'İş özeti alınıyor.':''}</small></div>
        <div className="ov-latest"><span>Son kontrol</span><strong className="ov-last-product">{controlLabel(last)}</strong><small>{last.productName} · {dateLabel(last.timestamp)}</small><button className="ov-text-button" onClick={()=>onOpenReport(last)}>Raporu aç <ArrowUpRight size={14}/></button></div>
      </section>}
    </>}
    {(hasPrior||priorities.length>0)&&<section className="ov-priorities" aria-label="Bekleyen işler">
      {error?<div className="ov-work-error" role="status"><AlertCircle size={18}/><div><strong>İş özeti alınamadı.</strong><p>Bekleyen iş sayısını şu anda doğrulayamıyoruz.</p></div><button className="ov-text-button" disabled={busy} onClick={()=>setRefreshKey(key=>key+1)}><RefreshCw size={15}/>{busy?'Deneniyor…':'Yeniden dene'}</button></div>:!work?<p className="ov-quiet" role="status">Bekleyen işler kontrol ediliyor…</p>:priorities.length?<><div className="ov-section-heading"><h3>Öncelikli işler</h3><span>Tüm açık işler</span></div><div className="ov-priority-list">{priorities.map(item=><button key={item.tab} onClick={()=>onNavigate(item.tab as NavTab)}><span className="ov-count">{item.count}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span><ArrowUpRight size={18}/></button>)}</div></>:<p className="ov-quiet"><CheckCircle2 size={16}/> Bekleyen aksiyon yok{hasPrior?' · Sonuçları aşağıdan inceleyebilirsiniz.':'.'}</p>}
    </section>}
    {logs.length===1&&<section className="ov-first-report"><CheckCircle2 size={20}/><div><h3>İlk kontrol raporunuz hazır.</h3><p>Sonuçları inceleyin; yazdırma ekranından PDF olarak kaydedin.</p></div><button className="ov-text-button" onClick={()=>onOpenReport(last)}>İlk raporumu aç <ArrowUpRight size={15}/></button></section>}
    {canManage&&<DailyOperatorPerformance logs={logs}/>} 
    {hasPrior&&<section className="ov-records" aria-labelledby="ov-records-title"><div className="ov-section-heading"><div><h3 id="ov-records-title">Son kontrol kayıtları</h3><span className="ov-scope">En yeniden eskiye</span></div><button className="ov-text-button" onClick={()=>onNavigate('logs')}>Tüm kayıtlar <ArrowRight size={15}/></button></div><div className="ov-record-list">{sorted.slice(0,5).map((log,index)=><button className={'ov-record'+(index>=3?' ov-record-desktop':'')} key={log.id} onClick={()=>onOpenLog(log)} aria-label={`${log.productCode} · ${controlLabel(log)} kaydını aç`}><span className="ov-record-part"><strong>{controlLabel(log)}</strong><span>{log.productName} · {log.productCode}</span>{(log.lotNumber||log.orderNumber)&&<small>{[log.lotNumber&&`Parti: ${log.lotNumber}`,log.orderNumber&&`İş emri: ${log.orderNumber}`].filter(Boolean).join(' · ')}</small>}</span><span className="ov-record-meta">{log.operatorName}<small>{dateLabel(log.timestamp)}</small></span><StatusBadge status={log.overallStatus}/><ArrowUpRight size={16}/></button>)}</div></section>}
    {metrics.trend.filter(item=>item.count>0).length>=2&&<section className="ov-trend"><div className="ov-section-heading"><h3>Kalitenin seyri</h3><span>Son {days} gün</span></div>
      <p className="ov-no-data">{missingDays>0?`${missingDays} gün veri yok · Veri yokluğu %0 uygunluk anlamına gelmez.`:'Her gün kontrol kaydı var.'}</p>
      {compact&&<div className="ov-chart-tabs" role="group" aria-label="Grafik görünümü"><button aria-pressed={chartMode==='rate'} onClick={()=>setChartMode('rate')}>Uygunluk oranı</button><button aria-pressed={chartMode==='volume'} onClick={()=>setChartMode('volume')}>Kontrol sayısı</button></div>}
      <div hidden={compact&&chartMode!=='rate'}><h4 className="ov-chart-title">Günlük uygunluk oranı <span>% · n = kontrol sayısı</span></h4>
      <div className="ov-chart"><ResponsiveContainer width="100%" height="100%" onResize={width=>setChartWidth(width)}><ComposedChart data={chartData} syncId="quality-period" margin={{top:28,right:16,left:-12,bottom:0}}><XAxis {...chartAxis} dataKey="date" minTickGap={45}/><YAxis {...chartAxis} domain={[0,100]} unit="%"/><Tooltip filterNull={false} content={({active,payload})=>{const point=payload?.[0]?.payload;return active&&point?<div className="ov-chart-tooltip"><strong>{point.date}</strong><p>{point.count} kontrol · {point.rate===null?'Veri yok':`%${point.rate.toLocaleString('tr-TR',{maximumFractionDigits:1})} uygunluk`}</p></div>:null;}}/>{gapMarks}<Line name="Uygunluk (%)" dataKey="rate" stroke={chartColors.measurement} strokeWidth={2} dot={{r:4}} connectNulls={false} isAnimationActive={false}>{metrics.trend.filter(d=>d.count>0).length<=12&&<LabelList dataKey={(day:{date:string;count:number})=>day.count>0&&(chartWidth>600||labeledDates.has(day.date))?`n=${day.count}`:''} position="top" fill="#405e54" fontSize={12}/>}</Line></ComposedChart></ResponsiveContainer></div>
      </div><div hidden={compact&&chartMode!=='volume'}><h4 className="ov-chart-title">Günlük kontrol sayısı <span>Kontrol oturumu</span></h4>
      <div className="ov-chart ov-volume-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} syncId="quality-period" margin={{top:20,right:16,left:-12,bottom:0}}><XAxis {...chartAxis} dataKey="date" minTickGap={45}/><YAxis {...chartAxis} allowDecimals={false} domain={[0,(max:number)=>Math.max(1,max)]}/><Tooltip {...chartTooltip}/>{gapMarks}<Bar name="Kontrol sayısı" dataKey="count" fill="#46786a" radius={[3,3,0,0]} maxBarSize={32} isAnimationActive={false}>{metrics.trend.filter(d=>d.count>0).length<=12&&<LabelList dataKey={(day:{date:string;count:number})=>day.count>0&&(chartWidth>600||labeledDates.has(day.date))?String(day.count):''} position="top" fill="#405e54" fontSize={12}/>}</Bar></ComposedChart></ResponsiveContainer></div>
      </div>{metrics.trend.some(day=>day.count>0&&day.count<5)&&<details className="ov-volume-info"><summary>ⓘ Az kontrol oranı nasıl etkiler?</summary><p>Bazı günlerde 5’ten az kontrol var. Tek bir uygunsuz sonuç günlük oranı belirgin değiştirebilir; oranı kontrol sayısıyla birlikte değerlendirin.</p></details>}
      <details className="ov-daily-data"><summary>Günlük değerleri göster</summary><table><caption>Son {days} gündeki günlük döküm</caption><thead><tr><th>Gün</th><th>Kontrol sayısı</th><th>Uygunluk</th></tr></thead><tbody>{metrics.trend.map(day=><tr key={day.date}><td>{day.date}</td><td>{day.count}</td><td>{day.rate===null?'Veri yok':`%${day.rate.toLocaleString('tr-TR',{maximumFractionDigits:1})}`}</td></tr>)}</tbody></table></details>
    </section>}
    {hasPrior&&<details className="ov-details"><summary>Parça, istasyon ve operatör dağılımı <span>Tüm kayıtlar</span></summary><div className="ov-breakdowns">{[['Parça',breakdown(log=>log.productCode)],['İstasyon',breakdown(log=>log.machineNo)],['Operatör',breakdown(log=>log.operatorName)]].map(([label,items])=><div key={String(label)}><h4>{String(label)}</h4>{(items as [string,number][]).map(([name,count])=><p key={name}><span>{name}</span><strong>{count} kontrol</strong></p>)}</div>)}</div></details>}
  </div>;
}
