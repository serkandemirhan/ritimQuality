import {useEffect,useRef} from 'react';
import {Download,X} from 'lucide-react';
import type {Characteristic,SampleMeasurement} from '../types';
import {exportMeasurementMatrix} from '../services/exportRecords';
import './measurementMatrix.css';

export const measurementDisplay=(value:unknown):string=>value==null?'—':Array.isArray(value)?value.join(', '):value===true?'Uygun':value===false?'Uygunsuz':value==='yes'?'Evet':value==='no'?'Hayır':typeof value==='number'?value.toLocaleString('tr-TR',{useGrouping:false,maximumFractionDigits:12}):String(value);
export function MeasurementMatrix({open,onClose,samples,characteristics,onSelect,saved}:{open:boolean;onClose:()=>void;samples:SampleMeasurement[];characteristics:Characteristic[];onSelect:(sample:number,point:number)=>void;saved:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open&&!ref.current?.open)ref.current?.showModal();else if(!open&&ref.current?.open)ref.current.close();},[open]);
 const statuses=samples.flatMap(s=>characteristics.map(c=>s.statuses[c.id]||'empty'));
 const entered=statuses.filter(s=>s!=='empty').length;
 return <dialog ref={ref} className="rq-measurement-matrix" aria-labelledby="measurement-matrix-title" onCancel={onClose} onClose={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
  <header><h2 id="measurement-matrix-title">Tüm ölçümler</h2><div className="rq-matrix-counters"><span>{entered} / {statuses.length} {saved?'kaydedildi':'girildi'}</span><span className="is-pass">Uygun: {statuses.filter(s=>s==='pass'||s==='warning').length}</span><span className="is-fail">Uygunsuz: {statuses.filter(s=>s==='fail').length}</span><span>Bekleyen: {statuses.length-entered}</span></div><button type="button" className="rq-matrix-csv" onClick={()=>exportMeasurementMatrix(samples,characteristics)}><Download size={14}/>CSV İndir</button><button type="button" aria-label="Tüm ölçümleri kapat" onClick={onClose}><X size={18}/></button></header>
  <div className="rq-measurement-matrix-scroll"><table style={{minWidth:Math.max(480,260+samples.length*90)}} aria-label="Tüm numunelerin ölçüm sonuçları"><thead><tr><th scope="col">Ölçüm noktası</th>{samples.map(s=><th scope="col" key={s.sampleIndex}>Numune {s.sampleIndex}<small>{s.serialNumber||'Seri belirtilmedi'}</small></th>)}</tr></thead><tbody>{characteristics.map(c=><tr key={c.id}><th scope="row"><span>#{c.pointNo}</span> {c.name}{(c.type||'numeric')==='numeric'&&<small>Hedef {measurementDisplay(c.nominal)} · {measurementDisplay(c.lsl)}–{measurementDisplay(c.usl)} {c.unit}</small>}</th>{samples.map(s=>{const status=s.statuses[c.id]||'empty';return <td key={s.sampleIndex}><button type="button" data-status={status} aria-label={`N${s.sampleIndex}, ${c.name}: ${measurementDisplay(s.values[c.id])}, ${status==='fail'?'Uygunsuz':status==='empty'?'Bekleyen':status==='warning'?'Uygun, uyarı':'Uygun'}`} onClick={()=>{if(!saved)onSelect(s.sampleIndex,c.pointNo);onClose();}}>{measurementDisplay(s.values[c.id])}<small className="rq-matrix-cell-status">{status==='empty'?'Bekliyor':status==='fail'?'! Uygunsuz':status==='warning'?'✓ Uygun · Uyarı':'✓ Uygun'}</small></button></td>;})}</tr>)}</tbody></table></div>
 </dialog>;
}
