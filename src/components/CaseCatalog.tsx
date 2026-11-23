import {usePreference,useListScroll} from './CatalogTools';
import {useEffect,useState} from 'react';
import {SaasApi} from '../services/api';
import './caseCatalog.css';
export type QualityCase={inspection_id:string;severity:string;id:string;title:string;owner_id:string;due_at:string;state:string;containment:string;root_cause:string;action:string;verification:string;version:number;created_at?:string;created_by?:string;created_by_name?:string;owner_name?:string;product_code?:string;lot_number?:string;machine_no?:string};
type Catalog={items:QualityCase[];total:number;owners:{id:string;name:string}[];creators:{id:string;name:string}[]};
const empty:Catalog={items:[],total:0,owners:[],creators:[]};
const states:Record<string,string>={open:'Açık',action:'Aksiyon',verification:'Doğrulama',closed:'Kapalı'};
const severity:Record<string,string>={critical:'Kritik',major:'Önemli',minor:'Düşük'};
const columns=[['title','Uygunsuzluk'],['product_code','Ürün / parça'],['lot_number','Parti / lot'],['machine_no','İstasyon'],['severity','Önem'],['state','Aşama'],['owner_name','Sorumlu'],['created_at','Oluşturulma tarihi'],['created_by_name','Oluşturan'],['due_at','Termin']];
const date=(value?:string)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
export function CaseCatalog({onSelect,refreshToken}:{onSelect:(item:QualityCase)=>void;refreshToken:unknown}){
 const [data,setData]=useState<Catalog>(empty),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [search,setSearch]=usePreference('cases:search',''),[query,setQuery]=useState(search.trim()),[state,setState]=usePreference('cases:state',''),[importance,setImportance]=usePreference('cases:importance',''),[owner,setOwner]=usePreference('cases:owner',''),[creator,setCreator]=usePreference('cases:creator',''),[from,setFrom]=usePreference('cases:from',''),[to,setTo]=usePreference('cases:to','');
 const [sort,setSort]=usePreference('cases:sort','created_at'),[direction,setDirection]=usePreference('cases:direction','desc'),[page,setPage]=usePreference('cases:page',1),[size,setSize]=usePreference('cases:size',50),[reload,setReload]=useState(0);
 useEffect(()=>{const timer=setTimeout(()=>{if(search.trim()!==query){setQuery(search.trim());setPage(1);}},250);return()=>clearTimeout(timer);},[search]);
 useEffect(()=>{
  if(from&&to&&from>to){setError('Başlangıç tarihi bitiş tarihinden sonra olamaz.');setData(empty);setLoading(false);return;}
  const controller=new AbortController();setLoading(true);setError('');
  const params=new URLSearchParams({search:query,state,severity:importance,owner,creator,sort,direction,page:String(page),pageSize:String(size)});
  if(from)params.set('from',new Date(from+'T00:00:00').toISOString());
  if(to){const end=new Date(to+'T00:00:00');end.setDate(end.getDate()+1);params.set('to',end.toISOString());}
  void SaasApi.caseCatalog(params,controller.signal).then(result=>{if(!controller.signal.aborted)setData(result as Catalog);}).catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Liste yüklenemedi.');setData(empty);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[query,state,importance,owner,creator,from,to,sort,direction,page,size,refreshToken,reload]);
 useListScroll('CaseCatalog',!loading);
 const pages=Math.max(1,Math.ceil(data.total/size));
 useEffect(()=>{if(!loading&&page>pages)setPage(pages);},[loading,page,pages]);
 const change=(set:(value:string)=>void,value:string)=>{set(value);setPage(1);};
 const clear=()=>{setSearch('');setQuery('');setState('');setImportance('');setOwner('');setCreator('');setFrom('');setTo('');setPage(1);};
 return <section className="rq-case-catalog" aria-label="Uygunsuzluk listesi">
 <div className="rq-case-filters">
 <label className="rq-case-search">Ara<input type="search" placeholder="Uygunsuzluk, ürün, lot, istasyon veya kişi" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 <label>Aşama<select aria-label="Aşama" value={state} onChange={e=>change(setState,e.target.value)}><option value="">Tüm aşamalar</option>{Object.entries(states).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label>Önem<select aria-label="Önem" value={importance} onChange={e=>change(setImportance,e.target.value)}><option value="">Tüm seviyeler</option>{Object.entries(severity).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label>Sorumlu<select aria-label="Sorumlu" value={owner} onChange={e=>change(setOwner,e.target.value)}><option value="">Tüm sorumlular</option><option value="unassigned">Atanmamış</option>{data.owners.map(u=><option key={u.id} value={u.id}>{u.name||u.id}</option>)}</select></label>
 <label>Oluşturan<select aria-label="Oluşturan" value={creator} onChange={e=>change(setCreator,e.target.value)}><option value="">Tüm kişiler</option>{data.creators.map(u=><option key={u.id} value={u.id}>{u.name||u.id}</option>)}</select></label>
 <label>Oluşturulma başlangıcı<input type="date" value={from} onChange={e=>change(setFrom,e.target.value)}/></label>
 <label>Oluşturulma bitişi<input type="date" value={to} onChange={e=>change(setTo,e.target.value)}/></label>
 <button type="button" onClick={clear}>Temizle</button><button type="button" onClick={()=>setReload(n=>n+1)}>Yenile</button>
 </div>
 {error&&<p role="alert">{error}</p>}
 <div className="rq-case-table-scroll" tabIndex={0} aria-label="Yatay kaydırılabilir uygunsuzluk tablosu">
 <table aria-label="Uygunsuzluk kayıtları" aria-busy={loading}><thead><tr>{columns.map(([key,label])=><th key={key} scope="col" aria-sort={sort===key?(direction==='asc'?'ascending':'descending'):'none'}><button onClick={()=>{setSort(key);setDirection(sort===key&&direction==='asc'?'desc':'asc');setPage(1);}}>{label}<span aria-hidden="true">{sort===key?(direction==='asc'?' ↑':' ↓'):' ↕'}</span></button></th>)}<th scope="col">İşlem</th></tr></thead>
 <tbody>{data.items.map(item=><tr key={item.id}>
 <td title={item.title}><button className="rq-case-title" onClick={()=>onSelect(item)}>{item.title}</button></td>
 <td>{item.product_code||'—'}</td><td>{item.lot_number||'—'}</td><td>{item.machine_no||'—'}</td>
 <td><span className={'rq-case-badge severity-'+item.severity}>{severity[item.severity]||item.severity}</span></td>
 <td><span className={'rq-case-badge state-'+item.state}>{states[item.state]||item.state}</span></td>
 <td>{item.owner_name||'Atanmamış'}</td><td><time dateTime={item.created_at}>{date(item.created_at)}</time></td><td>{item.created_by_name||'—'}</td><td><time dateTime={item.due_at||undefined}>{date(item.due_at)}</time></td>
 <td><button onClick={()=>onSelect(item)} aria-label={item.title+' incele'}>İncele</button></td></tr>)}
 {!data.items.length&&<tr><td colSpan={11} className="rq-case-empty" role="status">{loading?'Uygunsuzluklar yükleniyor…':error?'Liste yüklenemedi.':'Filtrelere uygun uygunsuzluk bulunamadı.'}</td></tr>}</tbody></table></div>
 <footer><span role="status">{loading?'Yükleniyor…':`${data.total?((page-1)*size+1):0}–${Math.min(page*size,data.total)} / ${data.total} kayıt`}</span><label>Sayfa başına<select aria-label="Sayfa başına kayıt" value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}><option value={50}>50</option><option value={100}>100</option></select></label><div><button disabled={page<=1||loading} onClick={()=>setPage(1)} aria-label="İlk sayfa">«</button><button disabled={page<=1||loading} onClick={()=>setPage(n=>n-1)}>Önceki</button><span>{page} / {pages}</span><button disabled={page>=pages||loading} onClick={()=>setPage(n=>n+1)}>Sonraki</button><button disabled={page>=pages||loading} onClick={()=>setPage(pages)} aria-label="Son sayfa">»</button></div></footer>
 </section>;
}
