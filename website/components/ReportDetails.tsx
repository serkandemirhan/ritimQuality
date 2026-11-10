import {reportFields,type ReportMetadata} from '@/lib/report-metadata';

export function ReportDetails({value,onChange,defaultOpen=true}:{value:ReportMetadata;onChange:(value:ReportMetadata)=>void;defaultOpen?:boolean}){
  return <details className="rq-report-editor" open={defaultOpen||undefined}><summary>Parça, müşteri ve rapor bilgileri</summary><p>PDF’den okunabilen bilgiler korundu. Boş alanlar temsili demo verileriyle dolduruldu ve (Demo) olarak işaretlendi. Bilgileri değiştirebilirsiniz; boş bırakılan alanlar raporda yine demo verisiyle tamamlanır.</p><div>{reportFields.map(([key,label])=><label key={key}>{label}{key==='customer'&&<small> · isteğe bağlı</small>}<input type={key==='reportDate'?'date':'text'} aria-label={label} value={value[key]} maxLength={200} placeholder={key==='customer'?'Varsa müşteri adı':'Belirtilmedi'} onChange={e=>onChange({...value,[key]:e.target.value})}/></label>)}</div></details>;
}
