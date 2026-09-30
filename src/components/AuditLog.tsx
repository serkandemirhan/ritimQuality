import React, {useState} from 'react';
import {Badge, Button, DataTable, DetailDrawer, EmptyState} from './ui';

export function AuditLog({items}:{items:Record<string,unknown>[]}) {
  const [selected,setSelected]=useState<Record<string,unknown>|null>(null);
  return <div className="space-y-4"><p className="rq-helper">Son 500 olay · Salt okunur denetim kayıtları</p>
    {!items.length?<EmptyState title="Denetim kaydı yok" description="Kaydedilen değişiklikler burada listelenir."/>:<DataTable label="Değiştirilemez denetim kayıtları"><thead><tr><th>Zaman</th><th>Kullanıcı</th><th>İşlem</th><th>Kayıt türü / kimliği</th><th>Kaynak IP</th><th>Değişiklik</th></tr></thead><tbody>{items.map(item=><tr key={String(item.id)}><td className="rq-technical">{new Date(String(item.created_at)).toLocaleString('tr-TR')}</td><td>{String(item.actor_name||'Sistem')}</td><td><Badge>{String(item.action||'—')}</Badge></td><td>{String(item.entity_type||'—')}<small className="rq-technical">{String(item.entity_id||'—')}</small></td><td className="rq-technical">{String(item.ip_address||'—')}</td><td><Button onClick={()=>setSelected(item)}>Önce / sonra</Button></td></tr>)}</tbody></DataTable>}
    <DetailDrawer open={!!selected} title="Denetim kaydı" onClose={()=>setSelected(null)}>{selected&&<><dl className="rq-detail-grid">{[['İşlem',selected.action],['Kullanıcı',selected.actor_name||'Sistem'],['Kayıt',selected.entity_id],['Zaman',selected.created_at]].map(([label,value])=><div key={String(label)}><dt>{String(label)}</dt><dd>{String(value||'—')}</dd></div>)}</dl><div className="rq-form-grid mt-5">{[['Önce',selected.before_data],['Sonra',selected.after_data]].map(([label,value])=><section key={String(label)}><h3 className="rq-section-title">{String(label)}</h3><pre className="rq-code-block">{value==null?'Kayıt yok':JSON.stringify(value,null,2)}</pre></section>)}</div></>}</DetailDrawer>
  </div>;
}
