import {useEffect,useState} from 'react';
import {SaasApi} from '../services/api';
import {Button,Badge} from './ui';
import './caseCatalog.css';
type Approval={inspection_id:string;session_code:string;product_code:string;product_name:string;revision:string;operator_name:string;measured_at:string;status:string;reason:string;reviewer_name:string;reviewed_at:string};
type Catalog={items:Approval[];total:number;products:string[];revisions:string[];operators:string[]};
const empty:Catalog={items:[],total:0,products:[],revisions:[],operators:[]};
const states:Record<string,string>={pending:'Onay bekliyor',approved:'Onaylandı',rejected:'Reddedildi'};
const columns=[['session_code','Ölçüm'],['product_code','Ürün kodu'],['product_name','Ürün / parça'],['revision','Plan revizyonu'],['operator_name','Operatör'],['measured_at','Ölçüm zamanı'],['status','Durum'],['reason','Gerekçe'],['reviewer_name','Karar veren'],['reviewed_at','Karar zamanı']];
const date=(v:string)=>v?new Date(v).toLocaleString('tr-TR'):'—';
export function ApprovalCatalog({refreshToken,manager,busy,onOpenRecord,onDecision}:{refreshToken:unknown;manager:boolean;busy:boolean;onOpenRecord?:(id:string)=>void;onDecision:(kind:'approved'|'rejected',id:string)=>void}){
 const [data,setData]=useState<Catalog>(empty),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState(''),[product,setProduct]=useState(''),[revision,setRevision]=useState(''),[operator,setOperator]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [sort,setSort]=useState('measured_at'),[direction,setDirection]=useState('desc'),[page,setPage]=useState(1),[size,setSize]=useState(50),[reload,setReload]=useState(0);
 useEffect(()=>{const timer=setTimeout(()=>{if(search.trim()!==query){setQuery(search.trim());setPage(1);}},250);return()=>clearTimeout(timer);},[search]);
 useEffect(()=>{
  if(from&&to&&from>to){setError('Başlangıç tarihi bitiş tarihinden sonra olamaz.');setData(empty);setLoading(false);return;}
  const controller=new AbortController();setLoading(true);setError('');
  const params=new URLSearchParams({search:query,status,product,revision,operator,sort,direction,page:String(page),pageSize:String(size)});
  if(from)params.set('from',new Date(from+'T00:00:00').toISOString());
  if(to){const end=new Date(to+'T00:00:00');end.setDate(end.getDate()+1);params.set('to',end.toISOString());}
  void SaasApi.approvalCatalog(params,controller.signal).then(result=>{if(!controller.signal.aborted)setData(result as Catalog);}).catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Liste yüklenemedi.');setData(empty);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[query,status,product,revision,operator,from,to,sort,direction,page,size,refreshToken,reload]);
 const pages=Math.max(1,Math.ceil(data.total/size));
 useEffect(()=>{if(!loading&&page>pages)setPage(pages);},[loading,page,pages]);
 const change=(set:(v:string)=>void,v:string)=>{set(v);setPage(1);};
 const clear=()=>{setSearch('');setQuery('');setStatus('');setProduct('');setRevision('');setOperator('');setFrom('');setTo('');setPage(1);};
 return <section className="rq-case-catalog rq-approval-catalog" aria-label="Onay listesi">
 <div className="rq-case-filters">
 <label className="rq-case-search">Ara<input type="search" placeholder="Ölçüm, ürün, kişi veya gerekçe" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 <label>Durum<select aria-label="Onay durumu" value={status} onChange={e=>change(setStatus,e.target.value)}><option value="">Tüm durumlar</option>{Object.entries(states).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
 {([['Ürün',product,setProduct,data.products],['Revizyon',revision,setRevision,data.revisions],['Operatör',operator,setOperator,data.operators]] as const).map(([label,value,set,options])=><label key={label}>{label}<select aria-label={label} value={value} onChange={e=>change(set,e.target.value)}><option value="">Tümü</option>{options.map(v=><option key={v} value={v}>{v}</option>)}</select></label>)}
 <label>Ölçüm başlangıcı<input type="date" value={from} onChange={e=>change(setFrom,e.target.value)}/></label>
 <label>Ölçüm bitişi<input type="date" value={to} onChange={e=>change(setTo,e.target.value)}/></label>
 <button onClick={clear}>Temizle</button><button onClick={()=>setReload(n=>n+1)}>Yenile</button>
 </div>
 {error&&<p role="alert">{error}</p>}
 <div className="rq-case-table-scroll" tabIndex={0} aria-label="Yatay kaydırılabilir onay tablosu">
 <table aria-label="Ölçüm onay kuyruğu" aria-busy={loading}><thead><tr>{columns.map(([key,label])=><th key={key} scope="col" aria-sort={sort===key?(direction==='asc'?'ascending':'descending'):'none'}><button onClick={()=>{setSort(key);setDirection(sort===key&&direction==='asc'?'desc':'asc');setPage(1);}}>{label}<span aria-hidden="true">{sort===key?(direction==='asc'?' ↑':' ↓'):' ↕'}</span></button></th>)}<th scope="col">İşlem</th></tr></thead>
 <tbody>{data.items.map(item=><tr key={item.inspection_id}>{columns.map(([key])=><td key={key} title={item[key as keyof Approval]||undefined}>{key==='status'?<Badge tone={item.status==='approved'?'success':item.status==='rejected'?'danger':'warning'}>{states[item.status]}</Badge>:key==='measured_at'||key==='reviewed_at'?date(item[key]):<span className="rq-approval-cell">{item[key as keyof Approval]||'—'}</span>}</td>)}<td><div className="rq-actions">{onOpenRecord&&<Button onClick={()=>onOpenRecord(item.inspection_id)}>İncele</Button>}{manager&&item.status==='pending'&&<><Button disabled={busy} variant="primary" onClick={()=>onDecision('approved',item.inspection_id)}>Onayla</Button><Button disabled={busy} variant="danger" onClick={()=>onDecision('rejected',item.inspection_id)}>Reddet</Button></>}</div></td></tr>)}
 {!data.items.length&&<tr><td colSpan={11} className="rq-case-empty" role="status">{loading?'Onaylar yükleniyor…':error?'Liste yüklenemedi.':'Filtrelere uygun onay bulunamadı.'}</td></tr>}</tbody></table></div>
 <footer><span role="status">{loading?'Yükleniyor…':`${data.total?((page-1)*size+1):0}–${Math.min(page*size,data.total)} / ${data.total} kayıt`}</span><label>Sayfa başına<select aria-label="Sayfa başına kayıt" value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}><option value={50}>50</option><option value={100}>100</option></select></label><div><button disabled={page<=1||loading} onClick={()=>setPage(1)} aria-label="İlk sayfa">«</button><button disabled={page<=1||loading} onClick={()=>setPage(n=>n-1)}>Önceki</button><span>{page} / {pages}</span><button disabled={page>=pages||loading} onClick={()=>setPage(n=>n+1)}>Sonraki</button><button disabled={page>=pages||loading} onClick={()=>setPage(pages)} aria-label="Son sayfa">»</button></div></footer>
 </section>;
}
