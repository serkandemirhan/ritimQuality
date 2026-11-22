import {useEffect,useState} from 'react';
import {Button,Card,Field,Input,Select,Textarea} from './ui';
import type {Characteristic,ControlPlan} from '../types';
import {applyBulkCharacteristicPatch,commonCharacteristicValue,type BulkCharacteristicPatch} from '../services/bulkPlan';

const MIXED='__mixed__';
const tools=['Dijital Kumpas 0.01','Mikrometre 0.001','CMM 3D Ölçüm Cihazı','Mihengir / Yükseklik Mastarı','Profil Projeksiyon / Optik','Yüzey Pürüzlülük (Surftest)','Geçer / Geçmez Tampon Mastar','Torkmetre','Sertlik Ölçüm Cihazı (HRC/HB)','Diğer Ölçüm Aleti'];
const typeNames={numeric:'Sayısal',ok_nok:'Uygun / Uygunsuz',visual:'Görsel',single_select:'Tekli seçim',multi_select:'Çoklu seçim',boolean:'Evet / Hayır',text:'Metin'};

function BulkEntry({label,value,mixed,onCommit,numeric=false,multiline=false,optional=false}:{label:string;value:unknown;mixed:boolean;onCommit:(value:string)=>boolean;numeric?:boolean;multiline?:boolean;optional?:boolean}){
 const current=mixed?'':String(value??'');const [text,setText]=useState(current),[dirty,setDirty]=useState(false);
 useEffect(()=>{setText(current);setDirty(false);},[current,mixed]);
 const commit=()=>{if(dirty&&onCommit(text))setDirty(false);};
 const props={value:text,'aria-label':label,placeholder:mixed?'Birden fazla değer':optional?'Belirtilmedi':undefined,onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>{setText(e.target.value);setDirty(true);},onBlur:commit,maxLength:multiline?2000:numeric?40:254};
 return <Field label={label} hint={mixed?'Birden fazla değer; değiştirirseniz seçilen tüm noktalara uygulanır.':undefined}>{multiline?<Textarea {...props} rows={3}/>:<Input {...props} inputMode={numeric?'decimal':undefined} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();}}}/>}</Field>;
}

export function BulkCharacteristicProperties({plan,ids,onChange,onClear}:{plan:ControlPlan;ids:string[];onChange:(plan:ControlPlan)=>void;onClear:()=>void}){
 const points=plan.characteristics.filter(c=>ids.includes(c.id));
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const numericPoints=points.filter(c=>(c.type||'numeric')==='numeric');
 const type=points[0].type||'numeric',sameType=points.every(c=>(c.type||'numeric')===type),numeric=numericPoints.length>0;
 const apply=(patch:BulkCharacteristicPatch)=>{try{onChange(applyBulkCharacteristicPatch(plan,ids,patch));setError('');setMessage(`${points.length} noktaya uygulandı. Planı kaydederek değişiklikleri saklayın.`);return true;}catch(e){setError(e instanceof Error?e.message:'Değişiklik uygulanamadı.');setMessage('');return false;}};
 const common=<T,>(read:(c:Characteristic)=>T)=>commonCharacteristicValue(points,read);
 const select=(label:string,read:(c:Characteristic)=>string,options:[string,string][],commit:(value:string)=>boolean,numericOnly=false)=>{
  const state=commonCharacteristicValue(numericOnly&&numeric?numericPoints:points,read);return <Field label={label}><Select aria-label={label} value={state.mixed?MIXED:state.value} onChange={e=>commit(e.target.value)}>{state.mixed&&<option value={MIXED} disabled>Birden fazla değer</option>}{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</Select></Field>;
 };
 const entry=(label:string,key:'nominal'|'tolLower'|'tolUpper'|'precision'|'resolution'|'sampleSize'|'frequency'|'description',isNumeric=false,multiline=false,optional=false)=>{
  const state=isNumeric&&!numeric?{mixed:false,value:undefined}:commonCharacteristicValue(isNumeric?numericPoints:points,c=>key==='tolLower'?(c.extraction?c.tolLower:-Math.abs(c.tolLower)):c[key]);
  return <BulkEntry label={label} {...state} numeric={isNumeric} multiline={multiline} optional={optional} onCommit={text=>{
   if(isNumeric){const raw=text.trim().replace(',','.');if(!raw&&!optional){setError(`${label} boş bırakılamaz.`);return false;}const value=raw?Number(raw):undefined;if(raw&&!Number.isFinite(value)){setError(`${label} için geçerli bir sayı girin.`);return false;}return apply({[key]:value});}
   return apply({[key]:text});
  }}/>;
 };
 const optionsState=common(c=>c.options||[]);
 const choices=sameType?(type==='boolean'?['yes','no']:type==='ok_nok'?['OK','NOK']:type==='visual'?['OK','NOK','SUSPECT']:['single_select','multi_select'].includes(type)&&!optionsState.mixed?optionsState.value:[]):[];
 const policyNumber=(label:string,key:'minPhotos'|'maxPhotos')=>{const state=common(c=>c.policy?.[key]);return <BulkEntry label={label} {...state} numeric optional onCommit={raw=>{const value=raw.trim()===''?undefined:Number(raw.replace(',','.'));return apply({policy:{[key]:value}});}}/>;};
 return <Card className="rq-characteristic-properties rq-bulk-properties" aria-label="Seçilen karakteristikleri toplu düzenle">
  <div className="rq-bulk-heading"><h3>{points.length} karakteristik seçili</h3><Button onClick={onClear}>Seçimi temizle</Button></div>
  <p className="rq-helper">Seçim yaptığınızda veya alandan çıktığınızda değişiklik tüm seçili noktalara uygulanır. Diğer alanlar korunur.</p>
  <Field label="Seçili kontrol tipi"><Input disabled value={sameType?typeNames[type]:'Karışık kontrol tipleri'}/></Field>
  <div className="rq-property-fields">
   <section className="rq-property-group"><h4>Sayısal ölçüm ve tolerans</h4>
    <p className="rq-helper">{numeric?`Sayısal alanlar seçili ${numericPoints.length} sayısal noktaya uygulanır. Diğer kontrol tipleri korunur.`:'Seçimde sayısal kontrol noktası bulunmuyor.'}</p>
    <fieldset disabled={!numeric} className="rq-bulk-numeric">
     {entry('Nominal','nominal',true)}<div className="rq-bulk-two">{entry('Alt tolerans','tolLower',true)}{entry('Üst tolerans','tolUpper',true)}</div>
     {select('Birim',c=>c.unit,['mm','inch','µm','°','N','Ra','kg','bar','adet'].map(v=>[v,v]),value=>apply({unit:value as Characteristic['unit']}),true)}
     <details><summary>Hassasiyet ve çözünürlük</summary>{entry('Ondalık hassasiyet','precision',true,false,true)}{entry('Çözünürlük','resolution',true,false,true)}{select('Negatif değere izin ver',c=>String(c.allowNegative??true),[['true','İzin ver'],['false','İzin verme']],v=>apply({allowNegative:v==='true'}),true)}</details>
    </fieldset>
    {numeric&&<div className="rq-bulk-preview"><table aria-label="Seçili noktaların hesaplanan sınırları"><thead><tr><th>Nokta</th><th>Nominal</th><th>Alt sınır</th><th>Üst sınır</th></tr></thead><tbody>{numericPoints.map(c=><tr key={c.id}><td>#{c.pointNo}</td><td>{c.nominal}</td><td>{c.lsl}</td><td>{c.usl}</td></tr>)}</tbody></table></div>}
   </section>
   <section className="rq-property-group"><h4>Kalite ve kanıt kuralları</h4>
    {select('Önem seviyesi',c=>c.criticalClass,[['minor','Normal'],['major','Önemli'],['critical','Kritik']],v=>apply({criticalClass:v as Characteristic['criticalClass']}))}
    {select('Kanıt politikası',c=>c.evidencePolicy||'none',[['none','Kanıt yok'],['optional','İsteğe bağlı'],['required_on_fail','Uygunsuzlukta zorunlu'],['always_required','Her zaman zorunlu'],['photo_required','Fotoğraf zorunlu'],['media_required','Fotoğraf veya video'],['document_required','Dosya / belge gerekli']],v=>apply({evidencePolicy:v as Characteristic['evidencePolicy']}))}
    <details><summary>Gelişmiş kanıt kuralları</summary><div className="rq-property-fields">{policyNumber('En az fotoğraf','minPhotos')}{policyNumber('En fazla fotoğraf','maxPhotos')}
    {([['requireComment','Uygunsuzlukta açıklama'],['requireReason','Uygunsuzlukta kusur sebebi'],['requireReview','İnceleme'],['requireSupervisorApproval','Yetkili onayı'],['drawingRequired','Teknik resim'],['requireInstrument','Ölçüm aleti kimliği']] as const).map(([key,label])=><div key={key}>{select(label,c=>String(c.policy?.[key]??false),[['false','Zorunlu değil'],['true','Zorunlu']],v=>apply({policy:{[key]:v==='true'}}))}</div>)}
    <BulkEntry label="Kusur sebepleri" value={common(c=>c.policy?.reasons||[]).value.join('\n')} mixed={common(c=>c.policy?.reasons||[]).mixed} multiline onCommit={text=>apply({policy:{reasons:text.split('\n').map(v=>v.trim()).filter(Boolean)}})}/>
    </div></details>
   </section>
   {sameType&&['single_select','multi_select'].includes(type)&&<section className="rq-property-group"><h4>Seçenekler</h4><BulkEntry label="Ortak seçenekler" value={optionsState.value.join('\n')} mixed={optionsState.mixed} multiline onCommit={text=>apply({options:text.split('\n')})}/>
    <BulkEntry label="Uygunsuz seçenekler" value={common(c=>c.rejectedOptions||[]).value.join('\n')} mixed={common(c=>c.rejectedOptions||[]).mixed} multiline onCommit={text=>{const values=text.split('\n').map(v=>v.trim()).filter(Boolean);if(points.some(c=>values.some(v=>!c.options?.includes(v)))){setError('Uygunsuz seçenekler her seçili noktada tanımlı olmalı.');return false;}return apply({rejectedOptions:values});}}/>
    {optionsState.mixed&&<p className="rq-helper">Kalite kararlarını topluca düzenlemek için önce ortak seçenekleri belirleyin.</p>}
   </section>}
   {!!choices.length&&<section className="rq-property-group"><h4>Seçenek kalite kararları</h4>{choices.map(option=><div key={option}>{select(option==='yes'?'Evet':option==='no'?'Hayır':option,c=>c.optionResults?.[option]||'',[['','Varsayılan karar'],['pass','Uygun'],['fail','Uygunsuz'],['review','İnceleme gerekli']],v=>apply({optionResults:{[option]:v||undefined} as Characteristic['optionResults']}))}</div>)}</section>}
   <section className="rq-property-group"><h4>Kontrol bilgileri</h4>
    {select('Ölçüm aleti',c=>c.tool,tools.map(v=>[v,v]),v=>apply({tool:v as Characteristic['tool']}))}
    {entry('Örnekleme notu','sampleSize')}{entry('Kontrol sıklığı','frequency')}{entry('Kontrol açıklaması','description',false,true)}
   </section>
  </div>
  <p className="rq-helper">Ad, nokta numarası ve çizim konumu her nokta için ayrı korunur.</p>
  {error&&<p role="alert" className="rq-bulk-error">{error} Bu değişiklik uygulanmadı.</p>}{!error&&message&&<p role="status" className="rq-bulk-success">{message}</p>}
 </Card>;
}
