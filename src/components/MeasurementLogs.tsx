import {InspectionTrace} from './InspectionTrace';
import {Button, Input, Select, Card, MetricCard, SearchInput, DataTable, StatusBadge, Badge, DetailDrawer, Modal, Field, PageActions} from './ui';
import {SOURCE_LABELS} from '../services/terms';
import { exportInspectionRecords } from '../services/exportRecords';
import React, { useState, useMemo } from 'react';
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
  const [exportOpen,setExportOpen]=useState(false);
  const [exportFormat,setExportFormat]=useState<'csv'|'excel'>('csv');
  const [exportMessage,setExportMessage]=useState('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all'); // 'all' | 'today' | 'week' | 'month'
  const [customerFilter,setCustomerFilter]=useState('all');
  const [revisionFilter,setRevisionFilter]=useState('all');
  const [sourceFilter,setSourceFilter]=useState('all');
  const [operatorFilter,setOperatorFilter]=useState('all');
  const [equipmentFilter,setEquipmentFilter]=useState('all');
  const [characteristicFilter,setCharacteristicFilter]=useState('all');
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<InspectionLog | null>(()=>logs.find(l=>l.id===initialLogId)||null);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search
      const term = searchTerm.toLowerCase();
      const matchSearch = 
        log.sessionCode.toLowerCase().includes(term) ||
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
      if(customerFilter!=='all'&&product?.customer!==customerFilter)return false;
      if(revisionFilter!=='all'&&(log.productRevision||product?.revision||'')!==revisionFilter)return false;
      if(sourceFilter!=='all'&&(log.source||'manual')!==sourceFilter)return false;
      if(operatorFilter!=='all'&&log.operatorName!==operatorFilter)return false;
      if(equipmentFilter!=='all'&&(log.equipmentId||log.machineNo)!==equipmentFilter)return false;
      if(characteristicFilter!=='all'&&!log.samples.some(sample=>sample.values[characteristicFilter]!==null&&sample.values[characteristicFilter]!==undefined))return false;

      // Date
      if (dateFilter === 'today') {
        const todayStr = new Date().toISOString().slice(0, 10);
        return log.timestamp.slice(0, 10) === todayStr;
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
  }, [logs, products, searchTerm, productFilter, statusFilter, dateFilter,customerFilter,revisionFilter,sourceFilter,operatorFilter,equipmentFilter,characteristicFilter]);

  // Daily statistics
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter(l => l.timestamp.slice(0, 10) === todayStr);
  const passedCount = filteredLogs.filter(l => l.overallStatus !== 'fail').length;
  const passRate = filteredLogs.length > 0 ? (passedCount / filteredLogs.length) * 100 : null;

  const handleDeleteLog = async (logId: string) => {
    try {
    if (confirm('Bu ölçüm kaydı geçersiz kılınacak ve denetim izinde korunacak. Devam edilsin mi?')) {
      await StorageService.deleteInspectionLog(logId);
      onLogsChanged();
    }
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); }
  };

  return (
    <div className="space-y-5">
      {onOpenSPC&&<Button className="quality-secondary" onClick={onOpenSPC}>SPC Analizine Git</Button>}
      <div className="rq-metrics-row"><MetricCard label="Kayıtlı kontrol oturumları" value={logs.length} detail={'Bugün: '+todayLogs.length}/><MetricCard label="Uygun / uyarılı" value={passedCount} detail="Geçerli filtrelerdeki oturumlar" tone="success"/><MetricCard label="Uygunsuz" value={filteredLogs.filter(log=>log.overallStatus==='fail').length} detail="Geçerli filtrelerdeki oturumlar" tone="danger"/><MetricCard label="Uygunluk oranı" value={passRate===null?'—':'%'+passRate.toFixed(1)} detail="Uyarılı sonuçlar dahil"/></div>
      <div className="rq-actions"><Button onClick={()=>{setExportMessage('');setExportOpen(true);}}><Download size={16}/>Dışa Aktar</Button><span className="rq-helper m-0">{filteredLogs.length} / {logs.length} kontrol oturumu</span></div>
      <Modal open={exportOpen} title="Ölçüm kayıtlarını dışa aktar" onClose={()=>setExportOpen(false)}><div className="space-y-5"><Card><h3 className="rq-section-title">Geçerli filtrelerin sonucu</h3><p className="rq-helper">{filteredLogs.length} kontrol oturumu dışa aktarılacak. Arama, ürün, sonuç, tarih ve gelişmiş filtreler uygulanır.</p><div className="rq-summary"><Badge>{exportFormat==='csv'?'CSV · UTF-8':'Excel · XML'}</Badge><span>{filteredLogs.reduce((sum,log)=>sum+log.sampleCount,0)} numune</span></div></Card><Field label="Dosya biçimi"><Select value={exportFormat} onChange={event=>setExportFormat(event.target.value as 'csv'|'excel')}><option value="csv">CSV (.csv)</option><option value="excel">Excel çalışma sayfası (.xml)</option></Select></Field><p className="rq-helper">Sütunlar: oturum, tarih, ürün ve revizyonlar, parti, seri, iş emri, operatör, istasyon, numune sayısı, sonuç ve hatalı nokta sayısı.</p>{exportMessage&&<p role="status" className="rq-feedback rq-tone-info">{exportMessage}</p>}<PageActions><Button onClick={()=>setExportOpen(false)}>Kapat</Button><Button variant="primary" disabled={!filteredLogs.length} onClick={()=>{try{exportInspectionRecords(filteredLogs,exportFormat);setExportMessage('Dosya hazırlandı; tarayıcı indirmesi başlatıldı.');}catch{setExportMessage('Dosya hazırlanamadı. Lütfen yeniden deneyin.');}}}><Download size={16}/>Dosyayı indir</Button></PageActions></div></Modal>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs"><span className="font-bold text-slate-800">Kaynak Özeti:</span>{(['manual','gauge','import','cmm'] as const).map(source=><span key={source} className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono font-bold uppercase text-slate-700">{SOURCE_LABELS[source]}: {filteredLogs.filter(log=>(log.source||'manual')===source).reduce((total,log)=>total+log.samples.reduce((sum,sample)=>sum+Object.values(sample.statuses).filter(status=>status!=='empty').length,0),0)}</span>)}<span className="ml-auto font-bold text-emerald-700">Uygun: {filteredLogs.filter(log=>log.overallStatus==='pass').length} / {filteredLogs.length}</span></div>
      </div>

      {/* Main Table Card */}
      <div className="rq-card">
        <div className="rq-record-filters"><SearchInput value={searchTerm} onChange={event=>setSearchTerm(event.target.value)} placeholder="Oturum, ürün, parti veya operatör ara…" aria-label="Ölçüm kaydı ara"/>
          <div className="rq-record-filter-fields">
            {/* Product filter */}
            <Select
              aria-label="Ürün filtresi" value={productFilter}
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
            <details><summary className="rq-button cursor-pointer">Gelişmiş Filtreler</summary><div className="rq-form-grid mt-3">
            <Select aria-label="Müşteri filtresi" value={customerFilter} onChange={e=>setCustomerFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Müşteriler</option>{[...new Set(products.map(p=>p.customer))].map(value=><option key={value}>{value}</option>)}</Select>
            <Select aria-label="Revizyon filtresi" value={revisionFilter} onChange={e=>setRevisionFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Revizyonlar</option>{[...new Set(products.map(p=>p.revision||'').filter(Boolean))].map(value=><option key={value}>{value}</option>)}</Select>
            <Select aria-label="Kaynak filtresi" value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Kaynaklar</option><option value="manual">Manuel</option><option value="gauge">Ölçüm cihazı</option><option value="import">Dosyadan aktarım</option><option value="cmm">CMM</option></Select>
            <Select aria-label="Operatör filtresi" value={operatorFilter} onChange={e=>setOperatorFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Operatörler</option>{[...new Set(logs.map(l=>l.operatorName))].map(value=><option key={value}>{value}</option>)}</Select>
            <Select aria-label="Ekipman filtresi" value={equipmentFilter} onChange={e=>setEquipmentFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Cihazlar</option>{[...new Set(logs.map(l=>l.equipmentId||l.machineNo).filter(Boolean))].map(value=><option key={value}>{value}</option>)}</Select>
            <Select aria-label="Karakteristik filtresi" value={characteristicFilter} onChange={e=>setCharacteristicFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Karakteristikler</option>{controlPlans.flatMap(plan=>plan.characteristics).filter((char,index,array)=>array.findIndex(item=>item.id===char.id)===index).map(char=><option key={char.id} value={char.id}>#{char.pointNo} {char.name}</option>)}</Select>
            </div></details>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto mt-4">
          <DataTable label="Ölçüm kayıtları" className="rq-record-table">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 font-mono uppercase text-[11px] bg-slate-50">
                <th className="p-3.5 font-bold">Kayıt No & Tarih</th>
                <th className="p-3.5 font-bold font-sans">Parça Bilgisi</th>
                <th className="p-3.5 font-bold">Plan Rev.</th>
                <th className="p-3.5 font-bold">Parti / İş Emri</th>
                <th className="p-3.5 font-bold font-sans">Operatör / Tezgah</th>
                <th className="p-3.5 font-bold">Numune</th>
                <th className="p-3.5 font-bold font-sans">Sonuç</th>
                <th className="p-3.5 font-bold text-right font-sans">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLogs.map((log) => {
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
                      <Button variant="ghost" className="rq-technical" onClick={()=>setSelectedLogForDetail(log)}>{log.sessionCode}</Button>
                      <div className="text-[11px] text-slate-400 font-medium">{dateFormatted}</div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 font-sans">{log.productName}</div>
                      <div className="text-[11px] text-slate-500">{log.productCode}</div>
                    </td>

                    <td className="p-3.5">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-[11px] text-slate-700 font-bold border border-slate-200">
                        {log.controlPlanVersion}
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

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          onClick={() => setSelectedLogForDetail(log)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"
                          title="Ölçüm Değerlerini Gör"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        <Button
                          type="button"
                          onClick={() => onOpenCertificate(log)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition"
                          title="Kalite Raporu Yazdır"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>

                        {(currentUser.role === 'admin' || currentUser.role === 'quality_engineer') && <Button
                          type="button"
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title="Kaydı geçersiz kıl"
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
              Arama kriterlerine uygun ölçüm kaydı bulunamadı.
            </div>
          )}
        </div>
      </div>

      <DetailDrawer open={!!selectedLogForDetail} title={'Kontrol detayı · '+(selectedLogForDetail?.sessionCode||'')} className="rq-wide-drawer" onClose={()=>setSelectedLogForDetail(null)}>{selectedLogForDetail&&<div className="space-y-5">
        <div><h3 className="rq-section-title">{selectedLogForDetail.productName}</h3><p className="rq-helper rq-technical">{selectedLogForDetail.productCode} · Plan {selectedLogForDetail.controlPlanVersion}</p><StatusBadge status={selectedLogForDetail.overallStatus}/></div>
        <dl className="rq-detail-grid">{[['Kontrol zamanı',new Date(selectedLogForDetail.timestamp).toLocaleString('tr-TR')],['İş emri',selectedLogForDetail.orderNumber],['Parti / şarj',selectedLogForDetail.lotNumber],['Seri numarası',selectedLogForDetail.serialNumber],['İstasyon',selectedLogForDetail.machineNo],['Operatör',selectedLogForDetail.operatorName],['Ürün revizyonu',selectedLogForDetail.productRevision],['Ölçüm kaynağı',SOURCE_LABELS[selectedLogForDetail.source||'manual']],['Ekipman',selectedLogForDetail.equipmentId||selectedLogForDetail.machineNo],['Numune',selectedLogForDetail.sampleCount]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'—'}</dd></div>)}</dl>
        <DataTable label="Numune ölçümleri ve spesifikasyon"><thead><tr><th>Numune</th><th>Karakteristik / cihaz</th><th>Hedef / sınırlar</th><th>Ölçülen</th><th>Sonuç</th><th>Not / kanıt</th></tr></thead><tbody>{selectedLogForDetail.samples.flatMap(sample=>Object.entries(sample.values).map(([charId,value])=>{const point=(selectedLogForDetail.controlPlanSnapshot||controlPlans.find(plan=>plan.id===selectedLogForDetail.controlPlanId))?.characteristics.find(c=>c.id===charId);const status=sample.statuses[charId]||'empty';return <tr key={sample.sampleIndex+':'+charId} className={status==='fail'?'rq-row-alert':undefined}><td className="rq-technical">#{sample.sampleIndex}</td><td><strong>{point?'#'+point.pointNo+' '+point.name:charId}</strong><small>{point?.tool||'—'}</small></td><td className="rq-technical">{point?(point.type||'numeric')==='numeric'?<>{point.nominal} {point.unit}<small>{point.lsl} – {point.usl} {point.unit}</small></>:<>{point.type}<small>{point.rejectedOptions?.length?'NOK: '+point.rejectedOptions.join(', '):'OK / NOK'}</small></>:'Spesifikasyon bulunamadı'}</td><td className="rq-technical font-semibold">{value==null?'—':Array.isArray(value)?value.join(', '):value===true?'OK':value===false?'NOK':String(value)}{typeof value==='number'&&point?' '+point.unit:''}</td><td><StatusBadge status={status} label={status==='empty'?'Ölçülmedi':undefined}/></td><td><p className="whitespace-pre-wrap">{sample.pointNotes?.[charId]}</p>{(sample.evidence?.[charId]||[]).map(item=><Button key={item.id} variant="ghost" onClick={()=>void SaasApi.openEvidence(item.id)}>{item.fileName}</Button>)}</td></tr>;}))}</tbody></DataTable>
        {selectedLogForDetail.notes&&<Card><h3 className="rq-section-title">Operatör / kalite notu</h3><p className="rq-helper whitespace-pre-wrap">{selectedLogForDetail.notes}</p></Card>}
        <InspectionTrace log={selectedLogForDetail}/>
        <PageActions>{onOpenPlan&&<Button onClick={()=>onOpenPlan(selectedLogForDetail.productId)}>İlgili kontrol planını aç</Button>}<Button variant="primary" onClick={()=>{onOpenCertificate(selectedLogForDetail);setSelectedLogForDetail(null);}}><Printer size={16}/>Kalite Sertifikası Yazdır</Button></PageActions>
      </div>}</DetailDrawer>
    </div>
  );
};
