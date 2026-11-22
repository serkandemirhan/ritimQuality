import {useEffect,useRef} from 'react';
import './measurementCompletion.css';
export type CompletionStage='review'|'discard'|'saved'|null;
export function MeasurementCompletion({stage,busy,error,samples,total,failed,warnings,onClose,onReview,onSave,onDiscard,onRequestDiscard,onReport}:{stage:CompletionStage;busy:boolean;error:string;samples:number;total:number;failed:number;warnings:number;onClose:()=>void;onReview:()=>void;onSave:()=>void;onDiscard:()=>void;onRequestDiscard:()=>void;onReport:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(stage&&!ref.current?.open)ref.current?.showModal();else if(!stage&&ref.current?.open)ref.current.close();},[stage]);
 return <dialog ref={ref} className="rq-completion" aria-labelledby="rq-completion-title" aria-busy={busy} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
 <h2 id="rq-completion-title">{stage==='saved'?'Ölçüm kaydedildi':stage==='discard'?'Kaydetmeden vazgeçilsin mi?':'Ölçümler tamamlandı'}</h2>
 {stage==='review'&&<><p>Sonuçları inceleyebilir veya kontrolü kaydederek bitirebilirsiniz.</p><div className="rq-completion-summary"><span><strong>{samples}</strong> numune</span><span><strong>{total}</strong> ölçüm</span><span><strong>{failed}</strong> uygunsuz</span>{warnings>0&&<span><strong>{warnings}</strong> inceleme</span>}</div></>}
 {stage==='discard'&&<p>Bu kontrolün kaydedilmemiş ölçümleri ve taslağı kaldırılacak. Bu işlem geri alınamaz.</p>}
 {stage==='saved'&&<p>Kontrol kaydı oluşturuldu. Raporu açabilir veya bu pencereyi kapatabilirsiniz. Kayıt, ölçüm geçmişinden tekrar açılabilir.</p>}
 {error&&<p role="alert" className="rq-completion-error">{error}</p>}
 <div className="rq-completion-actions">
 {stage==='review'&&<><button autoFocus disabled={busy} onClick={onClose}>Ölçüme dön</button><button disabled={busy} onClick={onReview}>Ölçümleri incele</button><button className="is-primary" disabled={busy} onClick={onSave}>{busy?'Kaydediliyor…':'Kaydet ve bitir'}</button><button className="is-discard" disabled={busy} onClick={onRequestDiscard}>Kaydetmeden vazgeç</button></>}
 {stage==='discard'&&<><button autoFocus disabled={busy} onClick={onClose}>Ölçüme dön</button><button className="is-discard" disabled={busy} onClick={onDiscard}>{busy?'İptal ediliyor…':'Evet, kaydetmeden vazgeç'}</button></>}
 {stage==='saved'&&<><button autoFocus onClick={onClose}>Kapat</button><button className="is-primary" onClick={onReport}>Raporu aç</button></>}
 </div></dialog>;
}