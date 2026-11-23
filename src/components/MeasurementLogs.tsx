import {CatalogPager,SortHead,usePreference,useListScroll} from './CatalogTools';
import {cellQuality,qualityLabels,revisionLabel,localDay,recordOperator} from '../services/presentation';
import './recordFilters.css';
import {orderedMeasurements} from '../services/measurementOrder';
import {InspectionTrace} from './InspectionTrace';
import {ApprovalSummary} from './ApprovalSummary';
import {controlLabel} from '../services/controlLabel';
import {Button, Input, Select, Card, MetricCard, SearchInput, DataTable, StatusBadge, Badge, DetailDrawer, Modal, Field, PageActions} from './ui';
import {SOURCE_LABELS} from '../services/terms';
import { exportInspectionRecords } from '../services/exportRecords';
import React, { useState, useMemo, useEffect } from 'react';
import type {PendingInspection} from '../services/pendingInspections';
import { Product, ControlPlan, InspectionLog, User as AppUser, EvidenceAttachment } from '../types';
import { StorageService } from '../services/storage';
import { SaasApi } from '../services/api';
import { 
  History, 
  Search, 
  Filter, 
  Printer, 
  Trash2, 
  Eye, 
  Download, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  FileSpreadsheet,
  Layers,
  User,
  Hash
} from 'lucide-react';
import {CloudCheck, CloudUpload, CloudAlert} from 'lucide-react';

function SyncIndicator({pending}:{pending?:PendingInspection}) {
  const label=pending?pending.error?'Gönderim başarısız':'Gönderim bekliyor':'Senkronlandı';
  const Icon=pending?pending.error?CloudAlert:CloudUpload:CloudCheck;
  return <span className={`rq-record-sync ${pending?'rq-record-sync-pending':''}`} role="img" aria-label={label} title={pending?.error?`${label}: ${pending.error}`:label}><Icon size={20} aria-hidden="true"/><span>{label}</span></span>;
}

interface MeasurementLogsProps {
  initialLogId?:string;
  onOpenPlan?:(id:string)=>void;
  onOpenSPC?:()=>void;
  products: Product[];
  controlPlans: ControlPlan[];
  logs: InspectionLog[];
  currentUser: AppUser;
  onOpenCertificate: (log: InspectionLog) => void;
  onLogsChanged: () => void;
}

export const MeasurementLogs: React.FC<MeasurementLogsProps> = ({
  initialLogId, onOpenPlan, onOpenSPC,
  products,
  controlPlans,
  logs,
  currentUser,
  onOpenCertificate,
  onLogsChanged,
}) => {
  const [pending,setPending]=useState(SaasApi.pendingInspections);
  useEffect(()=>{const refresh=()=>setPending(SaasApi.pendingInspections());window.addEventListener('quality-pending-changed',refresh);return()=>window.removeEventListener('quality-pending-changed',refresh);},[]);
  const [exportOpen,setExportOpen]=useState(false);
  const [exportFormat,setExportFormat]=useState<'csv'|'excel'>('csv');
  const [exportMessage,setExportMessage]=useState('');
  const [searchTerm, setSearchTerm] = usePreference('records:search','');
  const [productFilter, setProductFilter] = usePreference('records:product','all');
  const [statusFilter, setStatusFilter] = usePreference('records:status','all');
  const [dateFilter, setDateFilter] = usePreference('records:date','all'); // 'all' | 'today' | 'week' | 'month'
  const [customerFilter,setCustomerFilter]=usePreference('records:customer','all');
  const [revisionFilter,setRevisionFilter]=usePreference('records:revision','all');
  const [sourceFilter,setSourceFilter]=usePreference('records:source','all');
  const [operatorFilter,setOperatorFilter]=usePreference('records:operator','all');
  const [equipmentFilter,setEquipmentFilter]=usePreference('records:equipment','all');
  const [characteristicFilter,setCharacteristicFilter]=usePreference('records:characteristic','all');
  const [qualityFilter,setQualityFilter]=usePreference('records:quality','all');
  const [planRevisionFilter,setPlanRevisionFilter]=usePreference('records:planRevision','all');
  const [recordSort,setRecordSort]=usePreference('records:sort','timestamp'),[recordDirection,setRecordDirection]=usePreference('records:direction','desc'),[recordPage,setRecordPage]=usePreference('records:page',1),[recordSize,setRecordSize]=usePreference('records:size',50);
  const [remote,setRemote]=useState<{items:InspectionLog[];total:number}|null>(null),[catalogError,setCatalogError]=useState(''),[catalogLoading,setCatalogLoading]=useState(false),[reloadCatalog,setReloadCatalog]=useState(0),[voidLog,setVoidLog]=useState<InspectionLog|null>(null),[voidBusy,setVoidBusy]=useState(false),[recordError,setRecordError]=useState('');
  useListScroll('records',!catalogLoading);
  const params=()=>new URLSearchParams({search:searchTerm,product:productFilter,status:statusFilter,period:dateFilter,customer:customerFilter,revision:revisionFilter,planRevision:planRevisionFilter,source:sourceFilter,operator:operatorFilter,equipment:equipmentFilter,characteristic:characteristicFilter,quality:qualityFilter,sort:recordSort,direction:recordDirection,page:String(recordPage),pageSize:String(recordSize)});
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>{setCatalogLoading(true);void SaasApi.inspectionCatalog(params(),controller.signal).then(result=>{if(!result||!Array.isArray(result.items))throw new Error('Sunucu liste yanıtı alınamadı.');if(!controller.signal.aborted){setRemote(result);setCatalogError('');}}).catch(e=>{if(!controller.signal.aborted){setRemote(null);setCatalogError(e instanceof Error?e.message:'Liste yüklenemedi.');}}).finally(()=>{if(!controller.signal.aborted)setCatalogLoading(false);});},200);return()=>{clearTimeout(timer);controller.abort();};},[searchTerm,productFilter,statusFilter,dateFilter,customerFilter,revisionFilter,planRevisionFilter,sourceFilter,operatorFilter,equipmentFilter,characteristicFilter,qualityFilter,recordSort,recordDirection,recordPage,recordSize,logs,reloadCatalog]);
  const previousFilters=React.useRef('');
  useEffect(()=>{const signature=JSON.stringify([searchTerm,productFilter,statusFilter,dateFilter,customerFilter,revisionFilter,planRevisionFilter,sourceFilter,operatorFilter,equipmentFilter,characteristicFilter,planRevisionFilter,qualityFilter]);if(previousFilters.current&&previousFilters.current!==signature)setRecordPage(1);previousFilters.current=signature;},[searchTerm,productFilter,statusFilter,dateFilter,customerFilter,revisionFilter,planRevisionFilter,sourceFilter,operatorFilter,equipmentFilter,characteristicFilter,qualityFilter]);
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<InspectionLog | null>(()=>logs.find(l=>l.id===initialLogId)||null);
  useEffect(()=>{if(initialLogId)setSelectedLogForDetail(logs.find(l=>l.id===initialLogId)||null);},[initialLogId,logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search
      const term = searchTerm.toLowerCase();
      const matchSearch = 
        log.sessionCode.toLowerCase().includes(term) || (log.controlNumber||'').toLowerCase().includes(term) ||
        log.productName.toLowerCase().includes(term) ||
        log.productCode.toLowerCase().includes(term) ||
        log.lotNumber.toLowerCase().includes(term) ||
        log.orderNumber.toLowerCase().includes(term) ||
        (log.serialNumber||'').toLowerCase().includes(term) ||
        log.operatorName.toLowerCase().includes(term);

      if (!matchSearch) return false;

      // Product
      if (productFilter !== 'all' && log.productId !== productFilter) return false;

      // Status
      if (statusFilter !== 'all' && log.overallStatus !== statusFilter) return false;
      const product=products.find(item=>item.id===log.productId);
      if(customerFilter!=='all'&&(log.customerSnapshot??'__unknown__')!==customerFilter)return false;
      if(revisionFilter!=='all'&&(log.productRevision||'')!==revisionFilter)return false;
      if(planRevisionFilter!=='all'&&log.controlPlanVersion!==planRevisionFilter)return false;
      if(qualityFilter!=='all'&&!log.samples.some(sample=>Object.keys(sample.values).some(id=>cellQuality(sample,id,log)===qualityFilter)))return false;
      if(sourceFilter!=='all'&&(log.source||'manual')!==sourceFilter)return false;
      if(operatorFilter!=='all'&&recordOperator(log)!==operatorFilter)return false;
      if(equipmentFilter!=='all'&&(log.equipmentId||log.machineNo)!==equipmentFilter)return false;
      if(characteristicFilter!=='all'&&!log.samples.some(sample=>sample.values[characteristicFilter]!==null&&sample.values[characteristicFilter]!==undefined))return false;

      // Date
      if (dateFilter === 'today') {
        return localDay(log.timestamp)===localDay(new Date());
      }
      if (dateFilter === 'week') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        return log.timestamp >= weekAgo;
      }
      if (dateFilter === 'month') {
        const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        return log.timestamp >= monthAgo;
      }

      return true;
    });
  }, [logs, products, searchTerm, productFilter, statusFilter, dateFilter,customerFilter,revisionFilter,sourceFilter,operatorFilter,equipmentFilter,characteristicFilter,qualityFilter]);

  const sortedLogs=[...filteredLogs].sort((a,b)=>{const key=recordSort as keyof InspectionLog;const av=key==='controlNumber'?controlLabel(a):a[key],bv=key==='controlNumber'?controlLabel(b):b[key];return (typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''),'tr',{numeric:true}))*(recordDirection==='asc'?1:-1);});
  const pendingLocal=filteredLogs.filter(log=>pending.some(p=>p.log.id===log.id)&&!remote?.items.some(r=>r.id===log.id));
  const tableLogs=remote?[...(recordPage===1?pendingLocal:[]),...remote.items]:sortedLogs.slice((recordPage-1)*recordSize,recordPage*recordSize);
  const recordTotal=remote?remote.total+pendingLocal.length:filteredLogs.length;
  useEffect(()=>{const max=Math.max(1,Math.ceil(recordTotal/recordSize));if(recordPage>max)setRecordPage(max);},[recordTotal,recordSize,recordPage]);
  const sortRecords=(key:string)=>{setRecordDirection(recordSort===key&&recordDirection==='asc'?'desc':'asc');setRecordSort(key);setRecordPage(1);};
  const exportRecords=async()=>{try{setExportMessage('Dosya hazırlanıyor…');let records=filteredLogs;if(remote){const collected:InspectionLog[]=[];for(let page=1;;page++){const query=params();query.set('page',String(page));query.set('pageSize','100');const response=await SaasApi.inspectionCatalog(query);if(!Array.isArray(response.items))throw new Error('Dışa aktarım verisi alınamadı.');collected.push(...response.items);if(collected.length>=response.total||!response.items.length)break;}records=[...pendingLocal,...collected];}exportInspectionRecords(records,exportFormat);setExportMessage('Dosya hazırlandı; indirme başlatıldı.');}catch(e){setExportMessage(e instanceof Error?e.message:'Dosya hazırlanamadı.');}};
  const filters=[
    {label:'Arama',value:searchTerm,set:setSearchTerm,empty:'',text:searchTerm},
    {label:'Parça',value:productFilter,set:setProductFilter,empty:'all',text:products.find(p=>p.id===productFilter)?.name||productFilter},
    {label:'Sonuç',value:statusFilter,set:setStatusFilter,empty:'all',text:({pass:'Uygun',warning:'Şartlı kabul',fail:'Uygunsuz'} as Record<string,string>)[statusFilter]},
    {label:'Tarih',value:dateFilter,set:setDateFilter,empty:'all',text:({today:'Bugün',week:'Son 7 gün',month:'Son 30 gün'} as Record<string,string>)[dateFilter]},
    ...[{label:'Müşteri',value:customerFilter,set:setCustomerFilter},{label:'Parça revizyonu',value:revisionFilter,set:setRevisionFilter},{label:'Plan revizyonu',value:planRevisionFilter,set:setPlanRevisionFilter},{label:'Nokta sonucu',value:qualityFilter,set:setQualityFilter},{label:'Kaynak',value:sourceFilter,set:setSourceFilter},{label:'Operatör',value:operatorFilter,set:setOperatorFilter},{label:'Cihaz',value:equipmentFilter,set:setEquipmentFilter},{label:'Karakteristik',value:characteristicFilter,set:setCharacteristicFilter}].map(f=>({...f,empty:'all',text:f.label==='Nokta sonucu'?qualityLabels[f.value]:f.label==='Kaynak'?SOURCE_LABELS[f.value as keyof typeof SOURCE_LABELS]:f.label==='Operatör'?logs.find(l=>recordOperator(l)===f.value)?.operatorName:f.label==='Müşteri'&&f.value==='__unknown__'?'Geçmiş müşteri bilgisi yok':f.label==='Karakteristik'?controlPlans.flatMap(p=>p.characteristics).find(c=>c.id===f.value)?.name:f.value}))
  ];
  const activeFilters=filters.filter(f=>f.value!==f.empty);
  const advancedCount=filters.slice(4).filter(f=>f.value!==f.empty).length;

  const handleDeleteLog=async()=>{if(!voidLog||voidBusy)return;setVoidBusy(true);setRecordError('');try{await StorageService.deleteInspectionLog(voidLog.id);setVoidLog(null);setReloadCatalog(n=>n+1);onLogsChanged();}catch(e){setRecordError(e instanceof Error?e.message:'İşlem tamamlanamadı. Tekrar deneyin.');}finally{setVoidBusy(false);}};

  return (
    <div className="rq-records-workspace space-y-5">
      <Modal open={exportOpen} title="Kontrol kayıtlarını dışa aktar" onClose={()=>setExportOpen(false)}><div className="space-y-5"><Card><h3 className="rq-section-title">Geçerli filtrelerin sonucu</h3><p className="rq-helper">{recordTotal} kontrol oturumu dışa aktarılacak. Arama, parça, sonuç, tarih ve gelişmiş filtreler uygulanır.</p><div className="rq-summary"><Badge>{exportFormat==='csv'?'CSV · UTF-8':'Excel · XML'}</Badge><span>{filteredLogs.reduce((sum,log)=>sum+log.sampleCount,0)} numune</span></div></Card><Field label="Dosya biçimi"><Select value={exportFormat} onChange={event=>setExportFormat(event.target.value as 'csv'|'excel')}><option value="csv">CSV (.csv)</option><option value="excel">Excel çalışma sayfası (.xml)</option></Select></Field><p className="rq-helper">Sütunlar: oturum, tarih, parça ve revizyonlar, parti, seri, iş emri, operatör, istasyon, numune sayısı, sonuç ve hatalı nokta sayısı.</p>{exportMessage&&<p role="status" className="rq-feedback rq-tone-info">{exportMessage}</p>}<PageActions><Button onClick={()=>setExportOpen(false)}>Kapat</Button><Button variant="primary" disabled={!filteredLogs.length} onClick={()=>void exportRecords()}><Download size={16}/>Dosyayı indir</Button></PageActions></div></Modal>

      {/* Main Table Card */}
      <div className="rq-records-list">
        <div className="rq-record-filters"><SearchInput value={searchTerm} onChange={event=>setSearchTerm(event.target.value)} placeholder="Oturum, parça, parti veya operatör ara…" aria-label="Kontrol kaydı ara"/>
          <div className="rq-record-filter-fields">
            {/* Product filter */}
            <Select
              aria-label="Parça filtresi" value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
            >
              <option value="all">Tüm Parçalar</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>

            {/* Status filter */}
            <Select
              aria-label="Sonuç filtresi" value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="pass">Kabul (Uygun)</option>
              <option value="warning">Şartlı Kabul</option>
              <option value="fail">Tolerans Dışı (Red)</option>
            </Select>

            {/* Date filter */}
            <Select
              aria-label="Tarih filtresi" value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
            >
              <option value="all">Tüm Zamanlar</option>
              <option value="today">Bugün</option>
              <option value="week">Son 7 Gün</option>
              <option value="month">Son 30 Gün</option>
            </Select>
            </div><details className="rq-record-advanced"><summary className="rq-button cursor-pointer">Diğer filtreler{advancedCount>0?` (${advancedCount})`:''}</summary><div className="rq-record-advanced-grid">
            <Select aria-label="Müşteri filtresi" value={customerFilter} onChange={e=>setCustomerFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Müşteriler</option>{[...new Set(logs.map(l=>l.customerSnapshot??'__unknown__'))].map(value=><option key={value}>{value==='__unknown__'?'Geçmiş müşteri bilgisi yok':value||'Müşteri belirtilmedi'}</option>)}</Select>
            <Select aria-label="Parça revizyonu filtresi" value={revisionFilter} onChange={e=>setRevisionFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm parça revizyonları</option>{[...new Set(logs.map(l=>l.productRevision||'').filter(Boolean))].map(value=><option key={value}>{value}</option>)}</Select>
            <Select aria-label="Plan revizyonu filtresi" value={planRevisionFilter} onChange={e=>setPlanRevisionFilter(e.target.value)}><option value="all">Tüm plan revizyonları</option>{[...new Set(logs.map(l=>l.controlPlanVersion))].map(v=><option value={v} key={v}>{revisionLabel(v)}</option>)}</Select>
            <Select aria-label="Nokta sonucu filtresi" value={qualityFilter} onChange={e=>setQualityFilter(e.target.value)}><option value="all">Tüm nokta sonuçları</option>{Object.entries(qualityLabels).filter(([key])=>key!=='empty').map(([key,label])=><option key={key} value={key}>{label}</option>)}</Select>
            <Select aria-label="Kaynak filtresi" value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Kaynaklar</option><option value="manual">Manuel</option><option value="gauge">Ölçüm cihazı</option><option value="import">Dosyadan aktarım</option><option value="cmm">CMM</option></Select>
            <Select aria-label="Operatör filtresi" value={operatorFilter} onChange={e=>setOperatorFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Operatörler</option>{[...new Map(logs.map(l=>[recordOperator(l),l.operatorName])).entries()].map(([id,name])=><option value={id} key={id}>{name}</option>)}</Select>
            <Select aria-label="Ekipman filtresi" value={equipmentFilter} onChange={e=>setEquipmentFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Cihazlar</option>{[...new Set(logs.map(l=>l.equipmentId||l.machineNo).filter(Boolean))].map(value=><option key={value}>{value}</option>)}</Select>
            <Select aria-label="Karakteristik filtresi" value={characteristicFilter} onChange={e=>setCharacteristicFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Karakteristikler</option>{controlPlans.flatMap(plan=>plan.characteristics).filter((char,index,array)=>array.findIndex(item=>item.id===char.id)===index).map(char=><option key={char.id} value={char.id}>#{char.pointNo} {char.name}</option>)}</Select>
            </div></details>
          <div className="rq-record-toolbar-end"><span role="status">{recordTotal} kayıt</span><Button onClick={()=>{setExportMessage('');setExportOpen(true);}}><Download size={14}/>Dışa aktar</Button></div>
          {activeFilters.length>0&&<div className="rq-record-active-filters" aria-label="Seçili filtreler">{activeFilters.map(f=><button key={f.label} type="button" onClick={()=>f.set(f.empty)} aria-label={f.label+' filtresini kaldır'} title={f.label+': '+f.text}>{f.label}: {f.text}<span aria-hidden="true">×</span></button>)}<button type="button" className="rq-record-clear" onClick={()=>filters.forEach(f=>f.set(f.empty))}>Tümünü temizle</button></div>}
        </div>

        {/* Logs Table */}
        <div className="mt-4">
          <DataTable label="Kontrol kayıtları" className="rq-record-table rq-mobile-cards">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 font-mono uppercase text-[11px] bg-slate-50">
{[['timestamp','Kayıt no / tarih'],['productName','Parça bilgisi'],['controlPlanVersion','Plan revizyonu'],['lotNumber','Parti / iş emri'],['operatorName','Operatör / istasyon'],['sampleCount','Numune'],['overallStatus','Sonuç']].map(([column,label])=><SortHead key={column} column={column} label={label} sort={recordSort} direction={recordDirection} onSort={sortRecords}/>)}<th>Senkronizasyon</th>
                <th className="p-3.5 font-bold text-right font-sans">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {tableLogs.map((log) => {
                const dateFormatted = new Date(log.timestamp).toLocaleString('tr-TR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={log.id} className={log.overallStatus==='fail'?'rq-row-alert':undefined}>
                    <td className="p-3.5">
                      <Button variant="ghost" className="rq-technical" onClick={()=>setSelectedLogForDetail(log)}>{controlLabel(log)}</Button>
                      <div className="text-[11px] text-slate-400 font-medium">{dateFormatted}</div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 font-sans" title={log.productName}>{log.productName}</div>
                      <div className="text-[11px] text-slate-500">{log.productCode}</div>
                    </td>

                    <td className="p-3.5">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-[11px] text-slate-700 font-bold border border-slate-200">
                        {revisionLabel(log.controlPlanVersion)}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <div className="text-amber-700 font-bold">{log.lotNumber}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{log.orderNumber}</div>
                    </td>

                    <td className="p-3.5 font-sans">
                      <div className="text-slate-900 font-medium">{log.operatorName}</div>
                      <div className="text-[11px] text-slate-500">{log.machineNo}</div>
                    </td>

                    <td className="p-3.5">
                      <span className="text-slate-900 font-bold">{log.sampleCount} Adet</span>
                      <div className="text-[10px] text-slate-500">{log.totalPointsChecked} Nokta</div>
                    </td>

                    <td className="p-3.5 font-sans">
                      <StatusBadge status={log.overallStatus}/>{log.failedPointsCount>0&&<small>{log.failedPointsCount} uygunsuz nokta</small>}
                    </td>

                    <td className="p-3.5"><SyncIndicator pending={pending.find(item=>item.log.id===log.id)}/></td>

                    <td className="p-3.5 text-right">
                      <div className="rq-record-actions flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          onClick={() => setSelectedLogForDetail(log)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"
                          title="Ölçüm Değerlerini Gör"
                          aria-label="Ölçüm değerlerini gör"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        <Button
                          type="button"
                          onClick={() => onOpenCertificate(log)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition"
                          title="Kalite Raporu Yazdır"
                          aria-label="Kalite raporu yazdır"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>

                        {(currentUser.role === 'admin' || currentUser.role === 'quality_engineer') && <Button
                          type="button"
                          onClick={() => {setRecordError('');setVoidLog(log);}}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title="Kaydı geçersiz kıl"
                          aria-label="Kaydı geçersiz kıl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>

          {filteredLogs.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-xs">
              {catalogError?'Güncel liste yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.':catalogLoading?'Kayıtlar yükleniyor…':activeFilters.length?'Arama kriterlerine uygun ölçüm kaydı bulunamadı.':'Henüz ölçüm kaydı bulunmuyor.'}
            </div>
          )}
        </div>
      </div>

      <CatalogPager page={recordPage} size={recordSize} total={recordTotal} onPage={setRecordPage} onSize={v=>{setRecordSize(v);setRecordPage(1);}} loading={catalogLoading}/>
      {catalogError&&<p role="alert" className="rq-feedback rq-tone-warning">Güncel liste alınamadı. {catalogError} Önbellekteki kayıtlar gösteriliyor. <Button onClick={()=>setReloadCatalog(n=>n+1)}>Yeniden dene</Button></p>}
      <Modal open={!!voidLog} title="Ölçüm kaydı geçersiz kılınsın mı?" busy={voidBusy} onClose={()=>setVoidLog(null)}><p>{voidLog?controlLabel(voidLog):''} · {voidLog?.productName}</p><p>Bu kayıt aktif listeden kaldırılır; denetim geçmişinde korunur.</p>{recordError&&<p role="alert">{recordError}</p>}<PageActions><Button disabled={voidBusy} onClick={()=>setVoidLog(null)}>Vazgeç</Button><Button variant="danger" disabled={voidBusy} onClick={()=>void handleDeleteLog()}>Geçersiz kıl</Button></PageActions></Modal>
      <DetailDrawer open={!!selectedLogForDetail} title={'Kontrol detayı · '+(selectedLogForDetail?controlLabel(selectedLogForDetail):'')} className="rq-wide-drawer" onClose={()=>setSelectedLogForDetail(null)}>{selectedLogForDetail&&<div className="space-y-5">
        <div><h3 className="rq-section-title">{selectedLogForDetail.productName}</h3><p className="rq-helper rq-technical">{selectedLogForDetail.productCode} · Plan {selectedLogForDetail.controlPlanVersion}</p><div className="rq-actions"><StatusBadge status={selectedLogForDetail.overallStatus}/><SyncIndicator pending={pending.find(item=>item.log.id===selectedLogForDetail.id)}/></div></div>
        <ApprovalSummary log={selectedLogForDetail}/>
        <DataTable className="rq-mobile-cards rq-record-detail-table" label="Numune ölçümleri ve spesifikasyon"><thead><tr><th>Numune</th><th>Karakteristik / cihaz</th><th>Hedef / sınırlar</th><th>Ölçülen</th><th>Sonuç</th><th>Not / kanıt</th></tr></thead><tbody>{selectedLogForDetail.samples.flatMap(sample=>orderedMeasurements(sample,selectedLogForDetail.controlPlanSnapshot||controlPlans.find(plan=>plan.id===selectedLogForDetail.controlPlanId)).map(([charId,value])=>{const point=(selectedLogForDetail.controlPlanSnapshot||controlPlans.find(plan=>plan.id===selectedLogForDetail.controlPlanId))?.characteristics.find(c=>c.id===charId);const status=sample.statuses[charId]||'empty';const quality=cellQuality(sample,charId,selectedLogForDetail);return <tr key={sample.sampleIndex+':'+charId} className={status==='fail'?'rq-row-alert':undefined}><td className="rq-technical">#{sample.sampleIndex}</td><td><strong>{point?'#'+point.pointNo+' '+point.name:charId}</strong><small>{point?.tool||'—'}</small></td><td className="rq-technical">{point?(point.type||'numeric')==='numeric'?<>{point.nominal} {point.unit}<small>{point.lsl} – {point.usl} {point.unit}</small></>:<>{point.type}<small>{point.rejectedOptions?.length?'Uygunsuz: '+point.rejectedOptions.join(', '):'Uygun / Uygunsuz'}</small></>:'Spesifikasyon bulunamadı'}</td><td className="rq-technical font-semibold">{value==null?'—':Array.isArray(value)?value.join(', '):value===true?'Uygun':value===false?'Uygunsuz':String(value)}{typeof value==='number'&&point?' '+point.unit:''}</td><td><StatusBadge status={status} label={qualityLabels[quality]}/></td><td><p className="whitespace-pre-wrap">{sample.pointNotes?.[charId]}</p>{(sample.evidence?.[charId]||[]).map(item=><Button key={item.id} variant="ghost" onClick={()=>void SaasApi.openEvidence(item.id)}>{item.fileName}</Button>)}</td></tr>;}))}</tbody></DataTable>
        <details className="rq-card"><summary>İzlenebilirlik</summary>        <dl className="rq-detail-grid">{[['Kontrol zamanı',new Date(selectedLogForDetail.timestamp).toLocaleString('tr-TR')],['İş emri',selectedLogForDetail.orderNumber],['Parti / şarj',selectedLogForDetail.lotNumber],['Seri numarası',selectedLogForDetail.serialNumber],['İstasyon',selectedLogForDetail.machineNo],['Operatör',selectedLogForDetail.operatorName],['Parça revizyonu',selectedLogForDetail.productRevision],['Ölçüm kaynağı',SOURCE_LABELS[selectedLogForDetail.source||'manual']],['Ekipman',selectedLogForDetail.equipmentId||selectedLogForDetail.machineNo],['Numune',selectedLogForDetail.sampleCount]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'—'}</dd></div>)}</dl><p className="rq-helper break-all">Teknik kimlik: {selectedLogForDetail.id}</p><Button variant="ghost" onClick={()=>void navigator.clipboard.writeText(selectedLogForDetail.id).catch(()=>setRecordError('Kimlik kopyalanamadı. Metni seçerek kopyalayabilirsiniz.'))}>Teknik kimliği kopyala</Button></details>
        {selectedLogForDetail.notes&&<Card><h3 className="rq-section-title">Operatör / kalite notu</h3><p className="rq-helper whitespace-pre-wrap">{selectedLogForDetail.notes}</p></Card>}
        <InspectionTrace log={selectedLogForDetail}/>
        <PageActions>{onOpenPlan&&<Button onClick={()=>onOpenPlan(selectedLogForDetail.productId)}>İlgili kontrol planını aç</Button>}<Button variant="primary" onClick={()=>{onOpenCertificate(selectedLogForDetail);setSelectedLogForDetail(null);}}><Printer size={16}/>Kalite raporunu yazdır</Button></PageActions>
      </div>}</DetailDrawer>
    </div>
  );
};
