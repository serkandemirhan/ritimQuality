import {ArrowRight,Check,FileText} from 'lucide-react';
import type {Product,ControlPlan} from '../types';
import type {NavTab} from './Navbar';

export function Onboarding({products,plans,canManage,canInspect,onNavigate,onTrySample}:{products:Product[];plans:ControlPlan[];canManage:boolean;canInspect:boolean;onNavigate:(tab:NavTab)=>void;onTrySample:()=>void}) {
  const hasProduct=products.length>0;
  const ready=plans.some(p=>p.isActive&&p.status==='active'&&products.some(product=>product.id===p.productId));
  const step=ready?2:hasProduct?1:0;
  const available=ready?canInspect:canManage;
  const actions=['İlk parçayı ekle','Kontrol planını hazırla','Kontrol başlat'];
  const tabs:NavTab[]=['products','control-plans','operator'];
  return <section className="ov-start" aria-labelledby="ov-start-title">
    <div className="ov-start-copy"><span className="ov-kicker">ÇİZİMDEN İLK RAPORUNUZA</span>
      <h2 id="ov-start-title">{step===0?'İlk kontrolünüzü hazırlayalım.':step===1?'Parçanız hazır. Sırada kontrol planı.':'İlk ölçümünüz için hazırsınız.'}</h2>
      <p>{step===0?'Önce parçanızı ekleyin. Ardından teknik resminizden kontrol planı hazırlayın ve ölçümünüzü kaydedin.':step===1?'Teknik resminizden ölçüleri ve toleransları çıkarın, taslağı inceleyip planınızı etkinleştirin.':'Aktif kontrol planınızı seçin, ölçüm değerlerini girin. Sonuçlarınız ve raporunuz burada birikmeye başlayacak.'}</p>
      {available?<button className="ov-primary" onClick={()=>onNavigate(tabs[step])}>{actions[step]}<ArrowRight size={17}/></button>:<p className="ov-access">{canInspect?'Başlamak için firma yöneticinizin bir kontrol planını etkinleştirmesi gerekiyor.':'İlk kontrol kaydedildiğinde sonuçları bu ekrandan inceleyebilirsiniz.'}</p>}
      {step===1&&canManage&&<small>PDF’den taslak çıkarabilir veya planı elle oluşturabilirsiniz.</small>}
      {canInspect&&<button className="ov-text-button ov-try-sample" onClick={onTrySample}>Örnek parçayla dene <ArrowRight size={15}/></button>}
    </div>
    <div className="ov-start-guide"><FileText size={26} strokeWidth={1.5}/><p>Bir kez hazırlayın.<br/><strong>Her kontrolde aynı düzenle ilerleyin.</strong></p><ol>{['Parça','Kontrol planı','Ölçüm ve rapor'].map((label,i)=><li key={label} aria-current={i===step?'step':undefined} className={i<step?'is-done':''}><span>{i<step?<Check size={14}/>:i+1}</span><div>{label}<small>{i<step?'Tamamlandı':i===step?'Sıradaki adım':'Sonraki adım'}</small></div></li>)}</ol></div>
  </section>;
}
