import {SaasApi} from '../services/api';
import React,{useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
import {DetailDrawer, IconButton, Badge, Tabs} from './ui';
import {NotificationList} from './NotificationList';
export function NotificationPanel({onNavigate,onOpenRecord,role}:{role?:string;onOpenRecord?:(id:string)=>void;onNavigate:(tab:'work'|'cases'|'approvals')=>void}) {
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(true);const [filter,setFilter]=useState('unread');
  const [items,setItems]=useState<{id:number;title:string;kind:string;entity_id:string;read_at:string|null}[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{let live=true;const refresh=async()=>{try{const data=await SaasApi.work() as {notifications:typeof items};if(live){setItems(data.notifications);setError('');setLoading(false);}}catch{if(live){setError('Bildirimler yüklenemedi.');setLoading(false);}}};void refresh();const timer=setInterval(refresh,30000);return()=>{live=false;clearInterval(timer);};},[open]);
  return <div className="rq-actions"><IconButton label="Bildirimler" aria-expanded={open} onClick={()=>setOpen(!open)}><Bell size={20}/></IconButton>{items.some(i=>!i.read_at)&&<Badge tone="info">{items.filter(i=>!i.read_at).length}</Badge>}<DetailDrawer open={open} title="Bildirimler" onClose={()=>setOpen(false)} busy={busy}>{error&&<p role="alert" className="rq-feedback rq-tone-danger">{error}</p>}<Tabs label="Bildirim durumu" value={filter} onChange={setFilter} items={[{id:'unread',label:'Okunmamış'},{id:'read',label:'Geçmiş'}]}/>{loading?<p role="status">Bildirimler yükleniyor…</p>:<NotificationList emptyTitle={filter==='read'?'Okunan bildirim bulunmuyor':'Okunmamış bildirim yok'} items={items.filter(i=>filter==='read'?!!i.read_at:!i.read_at)} busy={busy} onOpen={async item=>{setBusy(true);setError('');try{await SaasApi.readNotification(item.id);setItems(prev=>prev.map(i=>i.id===item.id?{...i,read_at:new Date().toISOString()}:i));setOpen(false);if(item.entity_id&&onOpenRecord&&(item.kind==='inspection'||item.kind==='approval'&&role==='operator'))onOpenRecord(item.entity_id);else onNavigate(item.kind==='ncr'?'cases':item.kind==='approval'?'approvals':'work');}catch{setError('Bildirim güncellenemedi.');}finally{setBusy(false);}}}/>}</DetailDrawer></div>;
}
