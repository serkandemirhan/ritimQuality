import {useCallback,useEffect,useMemo,useState} from 'react';
import {Download,Printer} from 'lucide-react';
import {controlLabel} from '../services/controlLabel';
import {analyzeInspectionReport,reportRowStatusLabel,reportStatusLabel,type ReportMeasurementRow} from '../services/reportAnalysis';
import {orderedCharacteristics} from '../services/measurementOrder';
import {Modal,Button} from './ui';
import {ApprovalSummary} from './ApprovalSummary';
import {MediaImage} from './MediaImage';
import type {ControlPlan,InspectionLog,Product,TenantCompany} from '../types';

interface InspectionCertificateModalProps {log:InspectionLog|null;isExample?:boolean;company?:TenantCompany;product?:Product;controlPlan?:ControlPlan;onClose:()=>void;}
type Mode='standard'|'detailed';

const format=(value:number|null,unit='')=>value===null?'—':`${new Intl.NumberFormat('tr-TR',{maximumFractionDigits:6}).format(value)}${unit?` ${unit}`:''}`;
const displayValue=(row:ReportMeasurementRow)=>row.measuredValue===null||row.measuredValue===undefined?'—':Array.isArray(row.measuredValue)?row.measuredValue.join(', '):typeof row.measuredValue==='boolean'?(row.measuredValue?'Uygun':'Uygunsuz'):`${row.measuredValue}${row.unit&&row.measuredNumeric!==null?` ${row.unit}`:''}`;
const tone=(status:string)=>status==='pass'||status==='conforming'?'pass':status==='fail'||status==='nonconforming'?'fail':status==='incomplete'?'incomplete':'neutral';

function ToleranceIndicator({row}:{row:ReportMeasurementRow}){
  if(row.measuredNumeric===null||row.lowerLimit===null||row.upperLimit===null)return <span className="rq-tolerance-unavailable">Sınır yok</span>;
  const range=row.upperLimit-row.lowerLimit;
  const raw=range>0?((row.measuredNumeric-row.lowerLimit)/range)*100:50;
  const position=Math.max(-15,Math.min(115,raw));
  const offScale=raw<0?'Alt sınırın altında':raw>100?'Üst sınırın üstünde':'';
  return <div className="rq-tolerance-indicator" aria-label={`Tolerans aralığı ${format(row.lowerLimit,row.unit)} ile ${format(row.upperLimit,row.unit)}, ölçülen ${displayValue(row)}`}><div className="rq-tolerance-track"><i style={{left:`${position}%`}} className={row.status==='fail'?'fail':''}/></div><small>{offScale||`${format(row.lowerLimit)} — ${format(row.upperLimit)} ${row.unit}`}</small></div>;
}

export function InspectionCertificateModal({log,company,isExample=false,product,controlPlan,onClose}:InspectionCertificateModalProps){
  const [drawingReady,setDrawingReady]=useState(false);
  const [mode,setMode]=useState<Mode>('standard');
  useEffect(()=>{setDrawingReady(false);setMode('standard');},[log?.id,controlPlan?.drawingImageUrl]);
  const close=useCallback(()=>onClose(),[onClose]);
  const characteristics=useMemo(()=>orderedCharacteristics(log?.controlPlanSnapshot||controlPlan),[log,controlPlan]);
  const analysis=useMemo(()=>log?analyzeInspectionReport(log,characteristics,isExample):null,[log,characteristics,isExample]);
  if(!log||!analysis)return null;
  const generatedAt=new Date(log.timestamp).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const reportNumber=controlLabel(log);
  const handlePrint=()=>{if(controlPlan?.drawingImageUrl&&!drawingReady)return;window.print();};
  const rowStatusByPoint=new Map<number,string>();
  analysis.rows.forEach(row=>{const previous=rowStatusByPoint.get(row.pointNo);if(row.status==='fail'||!previous)rowStatusByPoint.set(row.pointNo,row.status);});
  return <Modal open title="Kalite kontrol raporu" onClose={close} className="rq-report-modal">
    <style>{`@page { size: A4 portrait; margin: 10mm 10mm 14mm; } @media print { .rq-report-paper { counter-reset: page; } }`}</style>
    <div className="rq-report-actions rq-actions"><span className="rq-helper">{reportNumber} · yazdırma önizlemesi</span><div className="rq-report-mode" role="group" aria-label="Rapor görünümü"><Button aria-pressed={mode==='standard'} onClick={()=>setMode('standard')}>Standart</Button><Button aria-pressed={mode==='detailed'} onClick={()=>setMode('detailed')}>Detaylı</Button></div><Button id="btn-trigger-print" disabled={!!controlPlan?.drawingImageUrl&&!drawingReady} variant="primary" onClick={handlePrint}><Printer size={16}/>Yazdır / PDF Kaydet</Button></div>
    <article className={`rq-report-paper rq-premium-report rq-report-${mode}`}>
      {isExample&&<aside className="rq-report-demo-notice"><strong>DEMO RAPORU</strong><span>Bu rapor gösterim amaçlıdır. Üretim onayı veya resmi kalite kabul belgesi değildir.</span></aside>}
      {!isExample&&log.clientSyncStatus==='pending'&&<aside className="rq-report-demo-notice"><strong>Yerel rapor</strong><span>Bu ölçüm cihazda kaydedildi; sunucu senkronizasyonu henüz tamamlanmadı.</span></aside>}
      <header className="rq-report-header"><div><strong className="rq-report-brand">ritim<span>quality</span></strong><p>ÖLÇÜM VE KALİTE KONTROL RAPORU</p></div><dl><div><dt>Rapor no</dt><dd>{reportNumber}</dd></div><div><dt>Oluşturulma</dt><dd>{generatedAt}</dd></div><div><dt>Plan revizyonu</dt><dd>{log.controlPlanVersion||'—'}</dd></div><div><dt>Rapor durumu</dt><dd>{controlPlan?.status==='draft'?'Taslak':'Oluşturuldu'}</dd></div></dl></header>
      <section className="rq-report-identification" aria-label="Parça ve izlenebilirlik bilgileri"><h2>Parça ve izlenebilirlik</h2><dl><div><dt>Parça</dt><dd>{log.productCode} · {log.productName}</dd></div>{product?.customer&&<div><dt>Müşteri</dt><dd>{product.customer}</dd></div>}<div><dt>Çizim / revizyon</dt><dd>{product?.code||log.productCode}{log.productRevision?` / ${log.productRevision}`:''}</dd></div>{product?.material&&<div><dt>Malzeme</dt><dd>{product.material}</dd></div>}<div><dt>Lot / iş emri</dt><dd>{log.lotNumber||'—'} / {log.orderNumber||'—'}</dd></div>{log.serialNumber&&<div><dt>Seri no</dt><dd>{log.serialNumber}</dd></div>}<div><dt>Muayene eden</dt><dd>{log.operatorName||'—'}</dd></div><div><dt>Muayene zamanı</dt><dd>{generatedAt}</dd></div><div><dt>Ölçüm ekipmanı</dt><dd>{log.equipmentId||'Belirtilmedi'}</dd></div>{log.machineNo&&<div><dt>İstasyon</dt><dd>{log.machineNo}</dd></div>}</dl></section>
      <section className={`rq-overall-result rq-result-${tone(analysis.status)}`}><div><span>TEKNİK MUAYENE SONUCU</span><strong>{reportStatusLabel(analysis.status)}</strong><p>{analysis.status==='nonconforming'?'En az bir gerçek ölçüm tolerans dışında.':analysis.status==='incomplete'?'Zorunlu ölçümler tamamlanmadı.':analysis.status==='not_evaluated'?'Karar için kullanılabilir gerçek ölçüm yok.':'Tüm değerlendirilmiş gerçek ölçümler uygundur.'}</p></div><div className="rq-summary-cards"><div><span>Kontrol noktası</span><strong>{analysis.totalCharacteristics}</strong></div><div><span>Ölçülen</span><strong>{analysis.measuredCharacteristics}</strong></div><div><span>Uygun</span><strong>{analysis.conformingCharacteristics}</strong></div><div><span>Uygunsuz</span><strong>{analysis.nonconformingCharacteristics}</strong></div><div><span>Ölçülmedi</span><strong>{analysis.incompleteCharacteristics}</strong></div>{analysis.demoMeasurements>0&&<div><span>Demo kaydı</span><strong>{analysis.demoMeasurements}</strong></div>}</div></section>
      <ApprovalSummary log={log}/>
      {controlPlan?.drawingImageUrl&&<section className="rq-report-drawing"><div><h2>Teknik resim ve kontrol noktaları</h2><p>Çizim revizyonu: {log.productRevision||log.controlPlanVersion||'—'}</p></div><div className="rq-report-balloon-drawing"><MediaImage onLoad={()=>setDrawingReady(true)} src={controlPlan.drawingImageUrl} alt="Teknik resim ve numaralandırılmış kontrol noktaları" referrerPolicy="no-referrer"/>{!isExample&&controlPlan.balloonMode!=='embedded'&&characteristics.map(characteristic=><span key={characteristic.id} className={`rq-report-balloon ${tone(rowStatusByPoint.get(characteristic.pointNo)||'neutral')}`} style={{left:`${characteristic.pin.x}%`,top:`${characteristic.pin.y}%`}}>{characteristic.pointNo}</span>)}</div><div className="rq-drawing-legend"><span className="pass">Uygun</span><span className="fail">Uygunsuz</span><span className="neutral">Ölçülmedi / değerlendirilmedi</span></div></section>}
      <section className="rq-report-results"><div className="rq-section-title"><div><h2>Ölçüm sonuçları</h2><p>{isExample?'Demo kayıtları teknik karara dahil edilmez.':'Yalnızca gerçek ölçümler teknik sonuca dahil edilir.'}</p></div><span>{analysis.rows.length} kayıt</span></div><div className="rq-report-table"><table><thead><tr><th>No</th><th>Karakteristik</th><th>Nominal</th><th>Alt sınır</th><th>Üst sınır</th><th>Ölçülen</th><th>Nominal sapma</th><th>Tolerans dışı sapma</th><th>Sonuç</th></tr></thead><tbody>{analysis.rows.map(row=><tr key={row.id} className={`rq-row-${tone(row.status)}${row.isDemo?' rq-row-demo':''}`}><td>#{row.pointNo}<small>N{row.sampleIndex}</small></td><td><strong>{row.characteristic}</strong>{row.note&&<small>{row.note}</small>}{row.isDemo&&<small>Demo kaydı</small>}</td><td>{format(row.nominal,row.unit)}</td><td>{format(row.lowerLimit,row.unit)}</td><td>{format(row.upperLimit,row.unit)}</td><td>{displayValue(row)}</td><td>{row.deviation===null?'—':format(row.deviation,row.unit)}</td><td>{row.outOfToleranceDeviation===null?'—':format(row.outOfToleranceDeviation,row.unit)}</td><td><span className={`rq-result-pill ${tone(row.status)}`}>{reportRowStatusLabel(row.status)}</span>{mode==='detailed'&&<ToleranceIndicator row={row}/>}</td></tr>)}</tbody></table></div></section>
      {mode==='detailed'&&analysis.nonconformities.length>0&&<section className="rq-nonconformity-summary"><h2>Uygunsuzluk özeti</h2><div>{analysis.nonconformities.map(row=><article key={row.id}><strong>#{row.pointNo} · {row.characteristic}</strong><p>{format(row.nominal,row.unit)} nominal · {displayValue(row)} ölçülen</p><p>Sınırlar: {format(row.lowerLimit,row.unit)} — {format(row.upperLimit,row.unit)} · İhlal: +{format(row.outOfToleranceDeviation,row.unit)}</p>{row.note&&<p>Not: {row.note}</p>}</article>)}</div></section>}
      {mode==='detailed'&&<section className="rq-report-traceability"><h2>Rapor durumu ve izlenebilirlik</h2><dl><div><dt>Teknik sonuç</dt><dd>{reportStatusLabel(analysis.status)}</dd></div><div><dt>Yönetici onayı</dt><dd>{log.approval?.status==='approved'?'Onaylandı':log.approval?.status==='rejected'?'Reddedildi':log.approval?.status==='pending'?'Onay bekliyor':'Onay gerekmiyor'}</dd></div>{log.approval?.reviewedBy&&<div><dt>İnceleyen</dt><dd>{log.approval.reviewedBy}</dd></div>}{log.approval?.reviewedAt&&<div><dt>İnceleme zamanı</dt><dd>{new Date(log.approval.reviewedAt).toLocaleString('tr-TR')}</dd></div>}<div><dt>Ölçüm kaynağı</dt><dd>{log.source||'manual'}</dd></div>{log.programName&&<div><dt>Program</dt><dd>{log.programName}</dd></div>}</dl></section>}
      <footer className="rq-report-footer"><span>Ritim Quality · {company?.legalName||company?.name||'Kalite yönetim sistemi'}</span><span>Rapor no: {reportNumber} · Sayfa <span className="rq-page-number"/></span></footer>
    </article>
  </Modal>;
}
