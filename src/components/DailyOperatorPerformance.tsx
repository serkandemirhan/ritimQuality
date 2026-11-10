import {Clock3,RotateCcw,WifiOff} from 'lucide-react';
import {dailyOperatorPerformance,durationLabel} from '../services/operatorPerformance';
import {Card,DataTable} from './ui';
import type {InspectionLog} from '../types';

export function DailyOperatorPerformance({logs}:{logs:InspectionLog[]}){
  const rows=dailyOperatorPerformance(logs);
  const controls=rows.reduce((sum,row)=>sum+row.controls,0);
  const timed=rows.reduce((sum,row)=>sum+row.timedControls,0);
  return <section aria-labelledby="daily-performance-title" className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 id="daily-performance-title" className="text-base font-bold">Günlük operatör performansı</h3><p className="rq-helper">Bugün tamamlanan kontroller · Operasyon takibi içindir, tek başına çalışan değerlendirmesi değildir.</p></div><strong>{controls} kontrol</strong></div>
    {!rows.length?<Card><p>Bugün tamamlanan kontrol bulunmuyor.</p></Card>:<DataTable label="Bugünkü operatör performansı"><thead><tr><th>Operatör</th><th>Kontrol</th><th>Kontrol noktası</th><th>Ort. aktif süre</th><th>Uygunsuz</th><th>Tekrar ölçüm</th><th>Çevrimdışı</th></tr></thead><tbody>{rows.map(row=><tr key={row.operatorId}><td><strong>{row.operatorName}</strong></td><td>{row.controls}</td><td>{row.points}</td><td><span className="inline-flex items-center gap-1"><Clock3 size={14}/>{durationLabel(row.averageActiveSeconds)}</span></td><td>{row.failedControls}</td><td><span className="inline-flex items-center gap-1"><RotateCcw size={14}/>{row.retryCount}</span></td><td><span className="inline-flex items-center gap-1"><WifiOff size={14}/>{row.offlineControls}</span></td></tr>)}</tbody></DataTable>}
    {controls>timed&&<p className="rq-feedback rq-tone-info">{controls-timed} eski kayıtta başlangıç/bitiş telemetrisi bulunmadığı için süre hesabına katılmadı.</p>}
  </section>;
}
