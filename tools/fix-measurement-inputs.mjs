import {readFileSync as read,writeFileSync as write} from 'node:fs';
for(const prefix of ['', 'on-premise/']){
 const path=prefix+'src/components/OperatorStation.tsx';let s=read(path,'utf8');
 s=s.replace('              {/* Lot Number */}',`              <div><label htmlFor="inspection-work-order" className="mb-2 block text-xs font-bold text-slate-700">İş Emri No</label><input id="inspection-work-order" type="text" required maxLength={120} value={orderNumber} onChange={event=>setOrderNumber(event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm"/></div>
              {/* Lot Number */}`);
 s=s.replace('placeholder="Örn: LOT-2026-0815-B"','aria-label="Parti numarası" required maxLength={120} placeholder="Örn: LOT-2026-0815-B"');
 s=s.replace('Görsel teknik resim üzerinden scroll yapmadan, tablet ve telefonda hızlı ve hatasız ölçüm yapın.','Teknik resimdeki kontrol noktalarını izleyerek ölçüm yapın. Yarım kalan kontrolünüz bu cihazda saklanır.');
 write(path,s);
}
