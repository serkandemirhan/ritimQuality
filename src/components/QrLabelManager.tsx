import {useEffect,useMemo,useState} from 'react';
import QRCode from 'qrcode';
import {Button,Card,Field,PageActions,PageHeader,Select} from './ui';
import type {ControlPlan,Product} from '../types';

interface LabelRow {product:Product;plan:ControlPlan;url:string;qr?:string;}

export function QrLabelManager({products,controlPlans,onBack}:{products:Product[];controlPlans:ControlPlan[];onBack?:()=>void}){
  const [customer,setCustomer]=useState('all');
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [codes,setCodes]=useState<Record<string,string>>({});
  const customers=useMemo(()=>[...new Set(products.map(product=>product.customer?.trim()).filter(Boolean) as string[])].sort((a,b)=>a.localeCompare(b,'tr')),[products]);
  const rows=useMemo<LabelRow[]>(()=>products.flatMap(product=>{
    const plan=controlPlans.find(item=>item.productId===product.id&&item.isActive&&item.status==='active');
    if(!plan||customer!=='all'&&product.customer!==customer)return [];
    const url=new URL(window.location.origin+window.location.pathname);url.searchParams.set('product',product.id);url.searchParams.set('source','qr');
    return [{product,plan,url:url.toString(),qr:codes[product.id]}];
  }),[products,controlPlans,customer,codes]);
  useEffect(()=>{
    let live=true;
    void Promise.all(rows.filter(row=>!codes[row.product.id]).map(async row=>[row.product.id,await QRCode.toDataURL(row.url,{width:420,margin:2,errorCorrectionLevel:'M'})] as const)).then(entries=>{if(live&&entries.length)setCodes(previous=>({...previous,...Object.fromEntries(entries)}));});
    return()=>{live=false;};
  },[rows,codes]);
  const visibleIds=rows.map(row=>row.product.id);
  const printable=rows.filter(row=>selected.has(row.product.id));
  const toggleAll=()=>setSelected(previous=>visibleIds.every(id=>previous.has(id))?new Set([...previous].filter(id=>!visibleIds.includes(id))):new Set([...previous,...visibleIds]));
  return <div className="rq-qr-manager">
    <style>{`@media print{body *{visibility:hidden!important}.rq-qr-print-area,.rq-qr-print-area *{visibility:visible!important}.rq-qr-print-area{position:absolute!important;inset:0!important;display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:8mm!important;padding:8mm!important}.rq-qr-label:not(.is-selected){display:none!important}.rq-qr-label{break-inside:avoid;border:1px solid #111!important;box-shadow:none!important}}`}</style>
    <PageHeader title="QR Etiketleri" description="Aktif kontrol planı bulunan parçalar için operatör ölçüm etiketleri oluşturun." actions={<PageActions>{onBack&&<Button onClick={onBack}>Kontrol planlarına dön</Button>}<Button onClick={toggleAll}>{visibleIds.length&&visibleIds.every(id=>selected.has(id))?'Görünen seçimi kaldır':'Görünenlerin tümünü seç'}</Button><Button variant="primary" disabled={!printable.length||printable.some(row=>!row.qr)} onClick={()=>window.print()}>{printable.length} etiketi yazdır</Button></PageActions>}/>
    <Card className="mb-5"><div className="rq-form-grid"><Field label="Müşteri"><Select value={customer} onChange={event=>setCustomer(event.target.value)}><option value="all">Tüm müşteriler</option>{customers.map(value=><option key={value} value={value}>{value}</option>)}</Select></Field><div><strong>{rows.length}</strong><p className="rq-helper">Aktif planı bulunan parça</p></div></div></Card>
    {!rows.length?<Card><p>Bu filtreye uygun aktif kontrol planı bulunamadı.</p></Card>:<section className="rq-qr-print-area grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Yazdırılabilir QR etiketleri">{rows.map(row=>{
      const checked=selected.has(row.product.id);
      return <article key={row.product.id} className={`rq-qr-label rounded-xl border bg-white p-4 shadow-sm${checked?' is-selected ring-2 ring-blue-600':''}`}><label className="flex items-start gap-3"><input type="checkbox" checked={checked} onChange={()=>setSelected(previous=>{const next=new Set(previous);checked?next.delete(row.product.id):next.add(row.product.id);return next;})}/><span><strong>{row.product.code} · {row.product.name}</strong><small className="mt-1 block text-slate-600">{row.product.customer||'Müşteri belirtilmedi'} · Plan {row.plan.version}</small></span></label>{row.qr?<img className="mx-auto my-3 aspect-square w-full max-w-52" src={row.qr} alt={`${row.product.code} ölçüm QR kodu`}/>:<div className="m-3 h-52 animate-pulse bg-slate-100"/>}<p className="text-center text-xs font-semibold">QR okutulduğunda aktif kontrol planı otomatik açılır.</p></article>;
    })}</section>}
  </div>;
}
