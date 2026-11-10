'use client';

import {sitePath} from '@/lib/site-path';
import {useState} from 'react';

const screens=[
  {id:'plans',label:'Kontrol planı',title:'Her parça için yaşayan bir kontrol planı.',text:'Teknik resim, ölçüm karakteristikleri ve revizyonlar aynı çalışma alanında. Ekibinizin kullanacağı planı hazırlayın ve güncel tutun.'},
  {id:'measurement',label:'Ölçüm istasyonu',title:'Operatörün önünde, sıradaki doğru ölçüm.',text:'Parçayı ve kontrol planını seçin. Ölçüm noktalarını sırayla takip edin; girilen değerleri tolerans sınırlarıyla anında karşılaştırın.'},
  {id:'analysis',label:'Proses analizi',title:'Ölçüm kaydından, prosesin davranışına.',text:'Ölçüm geçmişini kontrol grafikleri ve Cp / Cpk değerleriyle inceleyin. Karakteristik bazında değişimi görün.'},
  {id:'records',label:'Ölçüm geçmişi',title:'Her sonucun arkasındaki kayıtlar.',text:'Ölçüm sonuçlarını parça, lot ve operatör bilgileriyle birlikte inceleyin. Geçmiş kontrolleri yeniden açın.'},
];

export function ProductShowcase(){
  const [selected,setSelected]=useState(0),screen=screens[selected];
  return <section id="ozellikler" className="premium-product"><div className="container">
    <div className="premium-heading"><div><span className="eyebrow">TEK ÇALIŞMA ALANI, TÜM KALİTE AKIŞI</span><h2>Planlayın. Ölçün.<br/>İzleyin ve raporlayın.</h2></div><p>Kontrol planı, ölçüm istasyonu, analiz ve geçmiş ayrı araçlar değil; aynı ürünün birbirine bağlı çalışma alanlarıdır.</p></div>
    <div className="product-tabs" role="tablist" aria-label="Uygulama ekranları">{screens.map((s,i)=><button key={s.id} id={`tab-${s.id}`} role="tab" aria-selected={selected===i} aria-controls={`panel-${s.id}`} tabIndex={selected===i?0:-1} onClick={()=>setSelected(i)} onKeyDown={e=>{let next=i;if(e.key==='ArrowRight')next=(i+1)%screens.length;else if(e.key==='ArrowLeft')next=(i+screens.length-1)%screens.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=screens.length-1;else return;e.preventDefault();setSelected(next);document.getElementById(`tab-${screens[next].id}`)?.focus();}}><span>0{i+1}</span>{s.label}</button>)}</div>
    <div role="tabpanel" id={`panel-${screen.id}`} aria-labelledby={`tab-${screen.id}`} className="product-panel"><div className="product-panel-copy"><h3>{screen.title}</h3><p>{screen.text}</p></div><a href={sitePath(`/product/${screen.id}.png`)} target="_blank" rel="noreferrer" aria-label={`${screen.label} ekranını tam boyutta aç`}><img src={sitePath(`/product/${screen.id}.png`)} alt={`Ritim Quality uygulaması: ${screen.label}`} width="1440" height="1000" loading="lazy"/></a></div>
    <p className="product-caption">Gerçek uygulama ekranları · Örnek atölye verileri · Görseli büyütmek için seçin.</p>
  </div></section>;
}
