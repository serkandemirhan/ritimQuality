import React, {useEffect, useState} from 'react';
import type {InspectionLog} from '../types';
import {SaasApi} from '../services/api';
import {Card, TraceTimeline, Skeleton} from './ui';

type Relations = {
  cases: {id:string; inspection_id:string; title:string; state:string}[];
  approvals: {inspection_id:string; status:string; reason:string}[];
};
const states:Record<string,string> = {open:'Açık', action:'Aksiyon', verification:'Doğrulama', closed:'Kapalı', pending:'Bekliyor', approved:'Onaylandı', rejected:'Reddedildi'};

export function InspectionTrace({log}:{log:InspectionLog}) {
  const [relations,setRelations]=useState<Relations|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let live=true; setRelations(null); setError('');
    SaasApi.work().then(data=>{if(live)setRelations(data as Relations);}).catch(()=>{if(live)setError('İlişkili aksiyonlar yüklenemedi. Ölçüm kimlik bilgileri aşağıdadır.');});
    return()=>{live=false;};
  },[log.id]);
  const items = [
    {id:'product',title:'Ürün',detail:[log.productCode,log.productName,log.productRevision].filter(Boolean).join(' · ')},
    {id:'plan',title:'Kontrol planı',detail:[log.controlPlanId,log.controlPlanVersion].filter(Boolean).join(' · ')},
    {id:'order',title:'İş emri',detail:log.orderNumber},
    {id:'lot',title:'Parti / seri',detail:[log.lotNumber,log.serialNumber].filter(Boolean).join(' · ')},
    {id:'station',title:'İstasyon / operatör',detail:[log.machineNo,log.operatorName].filter(Boolean).join(' · ')},
    {id:'inspection',title:'Kontrol oturumu',detail:log.sessionCode,time:new Date(log.timestamp).toLocaleString('tr-TR')},
    ...(relations?.cases||[]).filter(item=>item.inspection_id===log.id).map(item=>({id:'case:'+item.id,title:'Uygunsuzluk · '+(states[item.state]||item.state),detail:item.title})),
    ...(relations?.approvals||[]).filter(item=>item.inspection_id===log.id).map((item,index)=>({id:'approval:'+index,title:'Onay · '+(states[item.status]||item.status),detail:item.reason||'Gerekçe belirtilmedi'})),
  ].filter(item=>!!item.detail);
  return <Card><h3 className="rq-section-title">İzlenebilirlik</h3><p className="rq-helper">Bu kontrol kaydına bağlı kimlikler ve kalite aksiyonları.</p><TraceTimeline items={items}/>{!relations&&!error&&<Skeleton className="h-10"/>}{error&&<p role="status" className="rq-helper">{error}</p>}</Card>;
}
