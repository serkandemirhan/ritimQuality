import Link from 'next/link';
import {ArrowRight,FileUp,Focus,FileCheck2,Layers3,NotebookTabs,ScanLine,ShieldCheck} from 'lucide-react';
import {Demo} from '@/components/Demo';
import {Tracking} from '@/components/Tracking';
import {ProductShowcase} from '@/components/ProductShowcase';
import {PremiumSections} from '@/components/PremiumSections';
import {DrawingJourney} from '@/components/DrawingJourney';
import './landing.css';
import './premium.css';

const workflow=[
  {icon:FileUp,title:'Planı hazırlayın.',text:'Teknik resimden kontrol noktalarını ve toleransları oluşturun. Revizyonu tek yerden takip edin.'},
  {icon:Focus,title:'Ekibiniz ölçsün.',text:'Operatöre sıradaki doğru ölçümü gösterin. Sonucu sınırlarla anında karşılaştırın.'},
  {icon:FileCheck2,title:'Kayıtları izleyin.',text:'Parça, lot ve operatör bilgileriyle ölçüm geçmişini inceleyin; raporu hazır alın.'},
];

export default function Home(){return <><Tracking event="landing_viewed"/>
  <section className="upload-hero container">
    <div className="upload-hero-copy">
      <span className="eyebrow"><span className="live-dot"/> 60 SANİYELİK CANLI ÜRÜN DENEYİMİ</span>
      <h1>Bir çizimden fazlası.<br/><em>Ölçülebilir kalite.</em></h1>
      <p>Bir ölçü noktası seçin. Değerinizi girin. Sonucu anında görün.</p>
      <div className="hero-actions"><a className="button button-primary" href="#demo-workbench">İlk ölçümümü yap <ArrowRight size={18}/></a><Link className="hero-secondary" href="/demo">Kendi teknik resmimle başla <ArrowRight size={16}/></Link></div>
      <div className="hero-assurance"><ShieldCheck size={15}/> Üyelik yok. Kurulum yok. Örnek ölçümü hemen deneyin.</div>
      <div className="hero-workflow" aria-label="Kalite yönetim akışı"><span><NotebookTabs size={15}/> Noktayı seç</span><ArrowRight size={14}/><span><ScanLine size={15}/> Değeri gir</span><ArrowRight size={14}/><span><Layers3 size={15}/> Sonucu ve raporu gör</span></div>
    </div>
    <div className="hero-product hero-drawing"><span className="hero-product-label">DOĞRULANMIŞ ÖRNEK · CNC MONTAJ PLAKASI</span><DrawingJourney/></div>
  </section>
  <ProductShowcase/>
  <section id="nasil-calisir" className="flow-section"><div className="container"><div className="flow-intro"><span className="eyebrow">GÜNLÜK KALİTE İŞİ İÇİN TEK AKIŞ.</span><h2>İşiniz ölçmek.<br/>Gerisi düzenli bir akış.</h2></div><div className="steps">{workflow.map((step,i)=><article key={step.title}><div className="step-top"><span>0{i+1}</span><step.icon size={25} strokeWidth={1.5}/></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></div></section>
  <Demo initialSample/>
  <PremiumSections/>
  <section className="cta-band"><div className="container"><h2>Kendi parçalarınız.<br/>Kendi kalite ritminiz.</h2><Link className="button button-white" href="/signup">Ücretsiz hesabınızı oluşturun <ArrowRight size={18}/></Link></div></section>
  <div className="container landing-account"><span>Hesap açmaya hazır mısınız?</span><Link href="/signup">Ücretsiz başlayın <ArrowRight size={15}/></Link></div>
</>;}
