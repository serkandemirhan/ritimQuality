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
  products: Product[];
  controlPlans: ControlPlan[];
  logs: InspectionLog[];
  currentUser: AppUser;
  onOpenCertificate: (log: InspectionLog) => void;
  onLogsChanged: () => void;
}

export const MeasurementLogs: React.FC<MeasurementLogsProps> = ({
  products,
  controlPlans,
  logs,
  currentUser,
  onOpenCertificate,
  onLogsChanged,
}) => {
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
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<InspectionLog | null>(null);

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
  const passedCount = filteredLogs.filter(l => l.overallStatus === 'pass').length;
  const passRate = filteredLogs.length > 0 ? (passedCount / filteredLogs.length) * 100 : 100;

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Oturum Kodu,Tarih Saat,Parça Kodu,Parça Adı,Ürün Revizyonu,Plan Revizyonu,Parti No,Seri No,İş Emri No,Kaynak,Operatör,Ekipman,Numune Sayısı,Genel Durum,Hatalı Nokta Sayısı\n';

    filteredLogs.forEach(l => {
      csvContent += `"${l.sessionCode}","${l.timestamp}","${l.productCode}","${l.productName}","${l.productRevision||''}","${l.controlPlanVersion}","${l.lotNumber}","${l.serialNumber||''}","${l.orderNumber}","${l.source||'manual'}","${l.operatorName}","${l.equipmentId||l.machineNo}",${l.sampleCount},"${l.overallStatus.toUpperCase()}",${l.failedPointsCount}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Kalite_Olcum_Kayitlari_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteLog = async (logId: string) => {
    try {
    if (confirm('Bu ölçüm kaydını kalıcı olarak silmek istediğinize emin misiniz?')) {
      await StorageService.deleteInspectionLog(logId);
      onLogsChanged();
    }
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner with Daily Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Kayıtlı Toplam Ölçüm
          </span>
          <div className="text-2xl font-black font-mono text-slate-900 mt-1">
            {logs.length} <span className="text-xs text-slate-400 font-normal">Oturum</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Veritabanında saklanan kayıtlar</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Bugün Yapılan Ölçümler
          </span>
          <div className="text-2xl font-black font-mono text-blue-600 mt-1">
            {todayLogs.length} <span className="text-xs text-slate-400 font-normal">Parti</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Günlük vardiya ölçüm temposu</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Genel Uygunluk (Kabul) Oranı
          </span>
          <div className="text-2xl font-black font-mono text-emerald-600 mt-1">
            %{passRate.toFixed(1)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Tolerans içi parça oranı</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Excel / CSV Raporu
          </span>
          <button
            type="button"
            onClick={handleExportCSV}
            className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Kayıtları CSV İndir</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs"><span className="font-bold text-slate-800">Kaynak Özeti:</span>{(['manual','gauge','import','cmm'] as const).map(source=><span key={source} className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono font-bold uppercase text-slate-700">{source}: {filteredLogs.filter(log=>(log.source||'manual')===source).reduce((total,log)=>total+log.samples.reduce((sum,sample)=>sum+Object.values(sample.statuses).filter(status=>status!=='empty').length,0),0)}</span>)}<span className="ml-auto font-bold text-emerald-700">Uygun: {filteredLogs.filter(log=>log.overallStatus==='pass').length} / {filteredLogs.length}</span></div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        {/* Filters Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Oturum no, parça adı, parti no veya operatör ara..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Product filter */}
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
            >
              <option value="all">Tüm Parçalar</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="pass">Kabul (Uygun)</option>
              <option value="warning">Şartlı Kabul</option>
              <option value="fail">Tolerans Dışı (Red)</option>
            </select>

            {/* Date filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
            >
              <option value="all">Tüm Zamanlar</option>
              <option value="today">Bugün</option>
              <option value="week">Son 7 Gün</option>
              <option value="month">Son 30 Gün</option>
            </select>
            <select value={customerFilter} onChange={e=>setCustomerFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Müşteriler</option>{[...new Set(products.map(p=>p.customer))].map(value=><option key={value}>{value}</option>)}</select>
            <select value={revisionFilter} onChange={e=>setRevisionFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Revizyonlar</option>{[...new Set(products.map(p=>p.revision||'').filter(Boolean))].map(value=><option key={value}>{value}</option>)}</select>
            <select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Kaynaklar</option><option value="manual">Manuel</option><option value="gauge">Gauge</option><option value="import">Import</option><option value="cmm">CMM</option></select>
            <select value={operatorFilter} onChange={e=>setOperatorFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Operatörler</option>{[...new Set(logs.map(l=>l.operatorName))].map(value=><option key={value}>{value}</option>)}</select>
            <select value={equipmentFilter} onChange={e=>setEquipmentFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Cihazlar</option>{[...new Set(logs.map(l=>l.equipmentId||l.machineNo).filter(Boolean))].map(value=><option key={value}>{value}</option>)}</select>
            <select value={characteristicFilter} onChange={e=>setCharacteristicFilter(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold"><option value="all">Tüm Karakteristikler</option>{controlPlans.flatMap(plan=>plan.characteristics).filter((char,index,array)=>array.findIndex(item=>item.id===char.id)===index).map(char=><option key={char.id} value={char.id}>#{char.pointNo} {char.name}</option>)}</select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
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
                  <tr key={log.id} className="hover:bg-slate-50 transition text-slate-700">
                    <td className="p-3.5">
                      <div className="font-bold text-blue-600 font-sans">{log.sessionCode}</div>
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
                      {log.overallStatus === 'pass' && (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          KABUL
                        </span>
                      )}
                      {log.overallStatus === 'warning' && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          ŞARTLI KABUL
                        </span>
                      )}
                      {log.overallStatus === 'fail' && (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          RED ({log.failedPointsCount} Hata)
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedLogForDetail(log)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"
                          title="Ölçüm Değerlerini Gör"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenCertificate(log)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition"
                          title="Kalite Raporu Yazdır"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {(currentUser.role === 'admin' || currentUser.role === 'quality_engineer') && <button
                          type="button"
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title="Kaydı geçersiz kıl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredLogs.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-xs">
              Arama kriterlerine uygun ölçüm kaydı bulunamadı.
            </div>
          )}
        </div>
      </div>

      {/* Measurement Detail Inspection Modal */}
      {selectedLogForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Ölçüm Oturumu Detayı: {selectedLogForDetail.sessionCode}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedLogForDetail.productName} ({selectedLogForDetail.productCode}) - Rev: {selectedLogForDetail.controlPlanVersion}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Parti / Şarj:</span>
                <span className="text-amber-700 font-bold">{selectedLogForDetail.lotNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">İş Emri No:</span>
                <span className="text-slate-800 font-semibold">{selectedLogForDetail.orderNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Operatör:</span>
                <span className="text-slate-800 font-semibold">{selectedLogForDetail.operatorName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Tezgah / İstasyon:</span>
                <span className="text-slate-800 font-semibold">{selectedLogForDetail.machineNo}</span>
              </div>
              <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Ürün / Plan Rev.:</span><span className="text-slate-800 font-semibold">{selectedLogForDetail.productRevision||'—'} / {selectedLogForDetail.controlPlanVersion}</span></div>
              <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Seri No:</span><span className="text-slate-800 font-semibold">{selectedLogForDetail.serialNumber||'—'}</span></div>
              <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Kaynak:</span><span className="text-slate-800 font-semibold uppercase">{selectedLogForDetail.source||'manual'}</span></div>
              <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Ekipman:</span><span className="text-slate-800 font-semibold">{selectedLogForDetail.equipmentId||selectedLogForDetail.machineNo}</span></div>
            </div>

            {/* Measured Values Matrix */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Numune Ölçüm Değerleri Matrisi
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-mono text-[11px] bg-slate-50">
                      <th className="p-2.5 font-bold">Numune No</th>
                      <th className="p-2.5 font-bold">Ölçüm Detayları</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {selectedLogForDetail.samples.map(s => (
                      <tr key={s.sampleIndex} className="text-slate-700">
                        <td className="p-2.5 font-bold text-blue-600">
                          Numune #{s.sampleIndex}
                        </td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(s.values).map(([charId, val]) => {
                              const st = s.statuses[charId];
                              return (
                                <span
                                  key={charId}
                                  className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                                    st === 'pass'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : st === 'warning'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-rose-50 text-rose-800 border-rose-200'
                                  }`}
                                >
                                  {val===null?'-':Array.isArray(val)?val.join(', '):val===true?'OK':val===false?'NOK':String(val)}
                                </span>
                              );
                            })}
                          </div>
                          {Object.entries(s.evidence||{}).map(([charId,items])=><div key={charId} className="mt-1 flex flex-wrap gap-1 text-[10px] text-blue-700">Kanıt: {(items as EvidenceAttachment[]).map(item=><button type="button" key={item.id} onClick={()=>void SaasApi.openEvidence(item.id)} className="rounded bg-blue-50 px-1.5 py-0.5 font-bold hover:bg-blue-100">{item.kind==='photo'?'📷':item.kind==='video'?'🎥':'📎'} {item.fileName}</button>)}</div>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            {selectedLogForDetail.notes && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500 font-bold block text-[10px] uppercase">Operatör & Kalite Notu:</span>
                <p className="text-slate-700 mt-1">{selectedLogForDetail.notes}</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  onOpenCertificate(selectedLogForDetail);
                  setSelectedLogForDetail(null);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Kalite Sertifikası Yazdır</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
