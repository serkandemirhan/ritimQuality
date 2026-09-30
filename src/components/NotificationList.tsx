import React from 'react';
import {Badge, Button, EmptyState} from './ui';

export type NotificationItem={id:number;title:string;kind:string;read_at:string|null};
const kinds:Record<string,string>={ncr:'Uygunsuzluk',task:'Görev',approval:'Onay',due_soon:'Yaklaşan termin',overdue:'Geciken görev'};
export function NotificationList({items,busy,onOpen,onRead}:{items:NotificationItem[];busy?:boolean;onOpen:(item:NotificationItem)=>void;onRead?:(item:NotificationItem)=>void}) {
  if(!items.length)return <EmptyState title="Yeni bildirim yok" description="Kalite aksiyonları ve görev bildirimleri burada listelenir."/>;
  return <ul className="rq-notification-list">{items.map(item=><li key={item.id} className={item.read_at?'':'rq-notification-unread'}><div><Badge tone={item.read_at?'neutral':'info'}>{item.read_at?'Okundu':'Okunmadı'}</Badge><span className="rq-helper">{kinds[item.kind]||'Bildirim'}</span></div><Button variant="ghost" disabled={busy} onClick={()=>onOpen(item)}>{item.title}</Button>{onRead&&!item.read_at&&<Button disabled={busy} onClick={()=>onRead(item)}>Okundu işaretle</Button>}</li>)}</ul>;
}
