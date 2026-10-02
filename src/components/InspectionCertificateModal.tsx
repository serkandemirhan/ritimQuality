import {Modal, Button, StatusBadge} from './ui';
import { MediaImage } from './MediaImage';
import React, { useCallback, useEffect } from 'react';
import { InspectionLog, ControlPlan, Product, TenantCompany } from '../types';
import { Printer, Download, X, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface InspectionCertificateModalProps {
  log: InspectionLog | null;
  company?: TenantCompany;
  product?: Product;
  controlPlan?: ControlPlan;
  onClose: () => void;
}

export const InspectionCertificateModal: React.FC<InspectionCertificateModalProps> = ({
  log, company,
  product,
  controlPlan,
  onClose,
}) => {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!log) return null;

  const characteristics = controlPlan?.characteristics || [];

  const handlePrint = () => {
    window.print();
  };

  const dateFormatted = new Date(log.timestamp).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal open={!!log} title="Kalite kontrol raporu" onClose={handleClose} className="rq-report-modal">
        <div className="rq-report-actions rq-actions"><span className="rq-helper m-0">Yazdırma önizlemesi · {log.sessionCode}</span><Button id="btn-trigger-print" variant="primary" onClick={handlePrint}><Printer size={16}/>Yazdır / PDF Kaydet</Button><Button id="btn-close-certificate" onClick={handleClose}>Kapat</Button></div>
        {/* Printable A4 Certificate Body */}
        <div className="rq-report-paper">
          {log.clientSyncStatus==='pending'&&<p className="rq-feedback rq-tone-warning" role="status">Yerel rapor · Gönderim bekliyor. Ölçümler cihazda kayıtlı; fotoğraf ve ölçüm gönderimi arka planda sürüyor.</p>}
          {/* Certificate Header Block */}
          <div className="border-2 border-slate-950 p-4 mb-4">
            <div className="flex items-center justify-between border-b-2 border-slate-950 pb-3 mb-3">
              <div>
                <h1 className="text-xl font-black tracking-wider uppercase">
                  {company?.legalName||company?.name||'Kalite Kontrol Raporu'}
                </h1>
                <p className="text-[11px] text-slate-600 font-semibold uppercase tracking-wide">
                  {company?.facilityLocation||'Kalite kontrol kayıtları'}
                </p>
              </div>

              <div className="text-right">
                <div className="text-sm font-black uppercase text-slate-900 border border-slate-950 px-3 py-1 bg-slate-100 inline-block font-mono">
                  RAPOR NO: {log.sessionCode}
                </div>
                <div className="text-[11px] text-slate-600 mt-1 font-mono">
                  Tarih: {dateFormatted}
                </div>
              </div>
            </div>

            <div className="text-center py-1 bg-slate-900 text-white font-bold uppercase tracking-widest text-xs mb-3">
              SON MUAYENE & BOYUTSAL KALİTE KONTROL SERTİFİKASI (INSPECTION CERTIFICATE)
            </div>

            {/* Metadata Table */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="border border-slate-300 p-2 bg-slate-50">
                <span className="text-[10px] text-slate-500 font-mono block uppercase">Parça Kodu / Adı:</span>
                <strong className="text-slate-950 font-bold">{log.productCode}</strong>
                <div className="text-[11px] text-slate-700">{log.productName}</div>
              </div>

              <div className="border border-slate-300 p-2 bg-slate-50">
                <span className="text-[10px] text-slate-500 font-mono block uppercase">Kontrol Planı Rev:</span>
                <strong className="text-slate-950 font-bold">{log.controlPlanVersion}</strong>
                <div className="text-[11px] text-slate-600">Plan: {controlPlan?.status==='active'?'Aktif':controlPlan?.status==='archived'?'Arşiv':controlPlan?.status==='draft'?'Taslak':'Belirtilmedi'}</div>
              </div>

              <div className="border border-slate-300 p-2 bg-slate-50">
                <span className="text-[10px] text-slate-500 font-mono block uppercase">Parti / Şarj / İş Emri:</span>
                <strong className="text-slate-950 font-bold font-mono">{log.lotNumber}</strong>
                <div className="text-[11px] text-slate-600 font-mono">{log.orderNumber}</div>
              </div>

              <div className="border border-slate-300 p-2 bg-slate-50">
                <span className="text-[10px] text-slate-500 font-mono block uppercase">Operatör / İstasyon:</span>
                <strong className="text-slate-950 font-bold">{log.operatorName}</strong>
                <div className="text-[11px] text-slate-600">{log.machineNo}</div>
              </div>
              <div className="border border-slate-300 p-2 bg-slate-50"><span className="text-[10px] text-slate-500 font-mono block uppercase">Ürün Rev. / Seri:</span><strong>{log.productRevision||'—'}</strong><div className="font-mono text-[11px]">{log.serialNumber||'—'}</div></div>
              <div className="border border-slate-300 p-2 bg-slate-50"><span className="text-[10px] text-slate-500 font-mono block uppercase">Kaynak / Ekipman:</span><strong className="uppercase">{log.source||'manual'}</strong><div className="font-mono text-[11px]">{log.equipmentId||log.machineNo}</div></div>
            </div>
          </div>

          {/* Technical Drawing Thumbnail with Pin Callouts */}
          {controlPlan?.drawingImageUrl && (
            <div className="border border-slate-300 p-3 mb-4 rounded bg-slate-50 flex flex-col items-center">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-600 mb-2">
                Kontrol Planı Referans Teknik Resmi & Ölçüm Noktaları
              </span>
              <MediaImage src={controlPlan.drawingImageUrl} alt="Teknik Resim" className="max-h-48 object-contain border border-slate-400 bg-slate-950 rounded" referrerPolicy="no-referrer"/>
            </div>
          )}

          {/* Detailed Measurement Matrix Table */}
          {Array.from({length:Math.max(1,Math.ceil(log.samples.length/5))},(_,index)=>log.samples.slice(index*5,index*5+5)).map((reportSamples,batch)=><div key={batch} className="rq-report-table border border-slate-300 mb-4"><p className="rq-eyebrow p-2">Numuneler {reportSamples[0]?.sampleIndex||'—'} – {reportSamples.at(-1)?.sampleIndex||'—'}</p>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-mono text-[11px] uppercase">
                  <th className="p-2 border-r border-slate-800">No</th>
                  <th className="p-2 border-r border-slate-800">Karakteristik</th>
                  <th className="p-2 border-r border-slate-800">Nominal</th>
                  <th className="p-2 border-r border-slate-800">Tolerans [LSL~USL]</th>
                  <th className="p-2 border-r border-slate-800">Ölçüm Cihazı</th>
                  {reportSamples.map(s => (
                    <th key={s.sampleIndex} className="p-2 text-center border-r border-slate-800">
                      N#{s.sampleIndex}
                    </th>
                  ))}
                  <th className="p-2 text-center">Sonuç</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 font-mono text-[11px]">
                {characteristics.map(char => {
                  let hasCharFail = false;
                  return (
                    <tr key={char.id} className="hover:bg-slate-50">
                      <td className="p-2 font-bold border-r border-slate-300 text-center">
                        #{char.pointNo}
                      </td>
                      <td className="p-2 font-sans font-bold border-r border-slate-300">
                        {char.name}
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        {(char.type||'numeric')==='numeric'?`${char.nominal} ${char.unit}`:'Nitel Kontrol'}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-slate-600">
                        {(char.type||'numeric')==='numeric'?`[${char.lsl} ~ ${char.usl}]`:(char.rejectedOptions||[]).length?`NOK: ${(char.rejectedOptions||[]).join(', ')}`:'OK/NOK'}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-[10px] text-slate-700">
                        {char.tool}
                      </td>

                      {/* Sample values */}
                      {reportSamples.map(s => {
                        const val = s.values[char.id];
                        const st = s.statuses[char.id];
                        if (st === 'fail') hasCharFail = true;

                        return (
                          <td
                            key={s.sampleIndex}
                            className={`p-2 text-center font-bold border-r border-slate-300 ${
                              st === 'pass'
                                ? 'text-emerald-700'
                                : st === 'warning'
                                ? 'text-amber-700'
                                : st === 'fail'
                                ? 'bg-rose-100 text-rose-800 font-black'
                                : 'text-slate-400'
                            }`}
                          >
                            {val===null||val===undefined?'-':Array.isArray(val)?val.join(', '):val===true?'OK':val===false?'NOK':String(val)}
                          </td>
                        );
                      })}

                      <td className="p-2 text-center font-sans font-bold text-[10px]">
                        {hasCharFail ? (
                          <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-300">
                            UYGUNSUZ
                          </span>
                        ) : (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                            UYGUN
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>)}

          {/* Certificate Conclusion & Approval Signatures */}
          <div className="border-2 border-slate-950 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Overall Decision Stamp */}
            <div className="flex flex-col items-center justify-center p-3 border-2 border-slate-950 bg-slate-50 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-mono mb-1">PARTİ KALİTE KARARI:</span>
              <div className={`text-base font-black uppercase px-4 py-1.5 rounded border-2 ${
                log.overallStatus === 'pass'
                  ? 'border-emerald-700 text-emerald-800 bg-emerald-100'
                  : log.overallStatus === 'warning'
                  ? 'border-amber-700 text-amber-800 bg-amber-100'
                  : 'border-rose-700 text-rose-800 bg-rose-100'
              }`}>
                {log.overallStatus === 'pass' ? '✔ UYGUN' : log.overallStatus === 'warning' ? '⚠ ŞARTLI KABUL' : '✖ UYGUNSUZ'}
              </div>
            </div>

            {/* Inspector Signature Box */}
            <div className="border border-slate-400 p-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Muayene Eden Kalite Kontrolör:</span>
                <strong className="text-slate-950 text-xs mt-1 block">{log.operatorName}</strong>
              </div>
              <div className="pt-4 border-t border-slate-300 flex justify-between text-[10px] text-slate-500">
                <span>İmza: ______________</span>
                <span>Tarih: {log.timestamp.slice(0, 10)}</span>
              </div>
            </div>

            {/* QA Supervisor Signature Box */}
            <div className="border border-slate-400 p-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Kalite Güvence Müdürü / Onay:</span>
                <strong className="text-slate-950 text-xs mt-1 block">__________________</strong>
              </div>
              <div className="pt-4 border-t border-slate-300 flex justify-between text-[10px] text-slate-500">
                <span>İmza: ______________</span>
                <span>Kaşe / Mühür</span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-slate-500 text-center font-mono">
            Bu belge elektronik ortamda Ritim Quality KOBİ Kalite Yönetim Sistemi tarafından üretilmiştir.
          </div>
        </div>
    </Modal>
  );
};
