import {Brand} from './Header';
import {reportFields,type ReportMetadata} from '@/lib/report-metadata';
import {placeMarkers} from '@/lib/drawing-markers';
import {displayNumber as fmt,verdict,type DemoDocument,type DemoReading} from '@/lib/drawing-demo';

export function DemoReportSheet({doc,metadata,readings}:{doc:DemoDocument;metadata:ReportMetadata;readings:Record<string,DemoReading>}){
  const markers=placeMarkers(doc.points,doc.sources,doc.width/doc.height);
  const manual=doc.points.filter(p=>readings[p.id]?.kind==='manual');
  const passed=manual.filter(p=>verdict(readings[p.id].value,p)==='pass').length;
  const failed=manual.filter(p=>verdict(readings[p.id].value,p)==='fail').length;
  const simulated=doc.points.filter(p=>readings[p.id]?.kind==='simulated').length;
  const status=(id:string)=>{const p=doc.points.find(p=>p.id===id)!,r=readings[id];return r?.kind==='simulated'?'simulated':r?verdict(r.value,p):'unknown';};
  return <div className="rq-report-sheet">
    <header className="rq-report-brand"><Brand/><div><span>ÖLÇÜM VE KONTROL RAPORU</span><h2>{metadata.partName||'Parça ölçüm raporu'}</h2><small>DEMO · İlk sayfa incelemesi</small></div></header>
    <dl className="rq-report-metadata">{reportFields.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{key==='reportDate'&&/^\d{4}-\d{2}-\d{2}$/.test(metadata[key])?metadata[key].split('-').reverse().join('.'):metadata[key]||'—'}</dd></div>)}</dl>
    <div className="rq-report-summary"><span><b>{manual.length}</b> Kullanıcı ölçümü</span><span><b>{passed}</b> Uygun</span><span><b>{failed}</b> Uygunsuz</span><span><b>{simulated}</b> Otomatik örnek</span></div>
    <figure className="rq-report-figure"><figcaption><strong>Balonlanmış teknik resim</strong><span>Kaynak: {doc.name} · İlk sayfa / {doc.pages}</span></figcaption>
      <svg className="rq-report-drawing" viewBox={`0 0 1000 ${1000*doc.height/doc.width}`} role="img" aria-label="Rapor için balonlanmış teknik resim">
        <image href={doc.preview} width="1000" height={1000*doc.height/doc.width}/>
        {doc.points.map((p,i)=>{const m=markers[i];if(!m||p.x===null||p.y===null)return null;const h=1000*doc.height/doc.width;return <g key={p.id} className={`rq-report-marker ${status(p.id)}`}><title>{i+1}. {p.name}</title><line x1={p.x*10} y1={p.y*h/100} x2={m.x*10} y2={m.y*h/100}/><circle cx={m.x*10} cy={m.y*h/100} r="13"/><text x={m.x*10} y={m.y*h/100} textAnchor="middle" dominantBaseline="central">{i+1}</text></g>;})}
      </svg><p className="rq-report-legend">Yeşil: uygun · Kırmızı: uygunsuz · Gri: otomatik örnek / ölçülmedi. Balon numaraları aşağıdaki satırlarla eşleşir.</p>
    </figure>
    <div className="dd-report-table"><table><caption>Kontrol planı ve ölçüm sonuçları</caption><thead><tr className="rq-table-context"><th colSpan={6}><div><Brand/><span>{metadata.partName||'Parça ölçüm raporu'}<br/>{metadata.reportNumber} · {metadata.customer||'Müşteri belirtilmedi'}</span></div></th></tr><tr><th>Nokta</th><th>Kontrol / çizimdeki ifade</th><th>Nominal</th><th>Alt / üst sınır</th><th>Ölçülen</th><th>Sonuç / veri türü</th></tr></thead><tbody>{doc.points.map((p,i)=>{const r=readings[p.id],s=status(p.id);return <tr key={p.id}><td>{String(i+1).padStart(2,'0')}</td><td><strong>{p.name}</strong><small>{p.original}</small>{r?.note&&<small>{r.note}</small>}</td><td>{fmt(p.nominal)} {p.unit}</td><td>{fmt(p.lower)} – {fmt(p.upper)} {p.unit}<small>{p.toleranceSource}</small></td><td>{r?fmt(r.value):'—'} {p.unit}</td><td><span className={`dd-report-badge ${s}`}>{s==='simulated'?'Otomatik örnek · ölçülmedi':s==='pass'?'Uygun':s==='fail'?'Uygunsuz':r?'Tolerans eksik':'Ölçülmedi'}</span></td></tr>;})}</tbody></table></div>
    <footer className="rq-report-disclaimer"><strong>Ritim Quality · Demo ölçüm raporu</strong><span>Otomatik örnekler gerçek ölçüm değildir ve uygunluk toplamlarına katılmaz. Bu rapor üretim onayı değildir.</span></footer>
  </div>;
}
