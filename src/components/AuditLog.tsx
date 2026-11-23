import {CatalogControls,CatalogPager,SortHead,useRemoteCatalog,useListScroll} from './CatalogTools';
import {StorageService} from '../services/storage';
import React, {useState} from 'react';
import {Badge, Button, DataTable, DetailDrawer, EmptyState} from './ui';

export function AuditLog({items}:{items:Record<string,unknown>[]}) {
  const [selected,setSelected]=useState<Record<string,unknown>|null>(null);
  const catalog=useRemoteCatalog<Record<string,unknown>>('audit',items,items);
  useListScroll('audit',!catalog.loading);
  return <div className="space-y-4"><p className="rq-helper">Salt okunur denetim geçmişi</p><CatalogControls catalog={catalog} users={StorageService.getUsers()}/>
    {!catalog.rows.length?<EmptyState title={catalog.error?'Denetim kaydı yüklenemedi':catalog.search||catalog.owner!=='all'||catalog.from||catalog.to?'Filtreye uygun kayıt yok':'Denetim kaydı yok'} description={catalog.error?'Yenile düğmesiyle tekrar deneyin.':'Aramayı veya tarih aralığını değiştirebilirsiniz.'}/>:<DataTable label="Değiştirilemez denetim kayıtları"><thead><tr>{[['created_at','Zaman'],['actor_name','Kullanıcı'],['action','İşlem'],['entity_id','Kayıt türü / kimliği'],['ip_address','Kaynak IP']].map(([column,label])=><SortHead key={column} column={column} label={label} sort={catalog.sort} direction={catalog.direction} onSort={catalog.setSort}/>)}<th>Değişiklik</th></tr></thead><tbody>{catalog.rows.map(item=><tr key={String(item.id)}><td className="rq-technical">{new Date(String(item.created_at)).toLocaleString('tr-TR')}</td><td>{String(item.actor_name||'Sistem')}</td><td><Badge>{String(item.action||'—')}</Badge></td><td>{String(item.entity_type||'—')}<small className="rq-technical">{String(item.entity_id||'—')}</small></td><td className="rq-technical">{String(item.ip_address||'—')}</td><td><Button onClick={()=>setSelected(item)}>Önce / sonra</Button></td></tr>)}</tbody></DataTable>}
    <CatalogPager page={catalog.page} size={catalog.size} total={catalog.total} onPage={catalog.setPage} onSize={catalog.setSize} loading={catalog.loading}/>
    <DetailDrawer open={!!selected} title="Denetim kaydı" onClose={()=>setSelected(null)}>{selected&&<><dl className="rq-detail-grid">{[['İşlem',selected.action],['Kullanıcı',selected.actor_name||'Sistem'],['Kayıt',selected.entity_id],['Zaman',selected.created_at]].map(([label,value])=><div key={String(label)}><dt>{String(label)}</dt><dd>{String(value||'—')}</dd></div>)}</dl><div className="rq-form-grid mt-5">{[['Önce',selected.before_data],['Sonra',selected.after_data]].map(([label,value])=><section key={String(label)}><h3 className="rq-section-title">{String(label)}</h3><pre className="rq-code-block">{value==null?'Kayıt yok':JSON.stringify(value,null,2)}</pre></section>)}</div></>}</DetailDrawer>
  </div>;
}
