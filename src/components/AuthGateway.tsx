import React, {useEffect,useState} from 'react';
import {ArrowRight,Factory,Loader2,ShieldCheck,LockKeyhole,Check} from 'lucide-react';
import {SaasApi} from '../services/api';
import './auth.css';
type Mode='login'|'register'|'forgot'|'reset'|'verify';
export const AuthGateway:React.FC<React.PropsWithChildren>=({children})=>{
  const platformLogin=location.pathname==='/platform'||location.pathname.startsWith('/platform/');
  const [mode,setMode]=useState<Mode>(()=>{
    const value=new URLSearchParams(location.search).get('auth');
    return ['register','forgot','reset','verify'].includes(value||'')?value as Mode:'login';
  });
  const [token]=useState(()=>new URLSearchParams(location.hash.slice(1)).get('token')||'');
  const [authenticated,setAuthenticated]=useState(SaasApi.hasSession());
  const [loading,setLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [mailEnabled,setMailEnabled]=useState<boolean|null>(null);
  const [form,setForm]=useState({workspace:'',email:'',password:'',confirm:'',companyName:'',name:''});
  const redemption=(mode==='reset'||mode==='verify')&&Boolean(token);
  useEffect(()=>{
    if(token)history.replaceState(null,'',location.pathname+location.search);
    SaasApi.authCapabilities().then(value=>setMailEnabled(value.accountEmail)).catch(()=>setMailEnabled(false));
    const expired=()=>{setAuthenticated(false);setError('Oturum süreniz doldu. Lütfen yeniden giriş yapın.');};
    window.addEventListener('qualitrack-auth-expired',expired);
    return ()=>window.removeEventListener('qualitrack-auth-expired',expired);
  },[token]);
  if(authenticated&&!redemption)return <>{children}</>;
  const switchMode=(next:Mode)=>{setMode(next);setError('');setMessage('');setForm(value=>({...value,password:'',confirm:''}));};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(loading)return;setError('');setMessage('');setLoading(true);
    try {
      if(mode==='login'||mode==='register'){
        if(mode==='register')await SaasApi.register(form);else if(platformLogin)await SaasApi.platformLogin({email:form.email,password:form.password});else await SaasApi.login(form);
        setAuthenticated(true);
      }else if(redemption){
        if(mode==='reset'&&form.password!==form.confirm)throw new Error('Şifreler eşleşmiyor.');
        const result=await SaasApi.redeemAccountLink({token,purpose:mode as 'reset'|'verify',password:mode==='reset'?form.password:undefined});
        if(mode==='reset'){await SaasApi.logout();setAuthenticated(false);}
        setMode('login');setMessage(result.message);setForm(value=>({...value,password:'',confirm:''}));
      }else{
        const result=await SaasApi.requestAccountLink({workspace:form.workspace,email:form.email,purpose:mode==='verify'?'verify':'reset'});
        setMessage(result.message);
      }
    }catch(err){setError(err instanceof Error?err.message:'İşlem tamamlanamadı.');}finally{setLoading(false);}
  };
  const titles={login:'Çalışma alanınıza hoş geldiniz.',register:'Kaliteye düzenli bir başlangıç.',forgot:'Şifrenizi yenileyin.',reset:'Yeni şifrenizi belirleyin.',verify:'E-postanızı doğrulayın.'};
  const descriptions={login:'Firma hesabınızla kaldığınız yerden devam edin.',register:'14 günlük denemenizi başlatın. Kredi kartı gerekmez.',forgot:'Firma çalışma alanınızı ve hesabınıza ait e-postayı girin.',reset:token?'Yeni şifrenizle tüm cihazlarda yeniden giriş yapmanız gerekir.':'Yeni bir şifre bağlantısı almak için hesap bilgilerinizi girin.',verify:token?'E-posta adresinizi doğrulamak için aşağıdaki düğmeye basın.':'Hesabınıza ait adrese bir doğrulama bağlantısı isteyin.'};
  const mailRequest=!redemption&&!['login','register'].includes(mode);
  const showPassword=mode==='login'||mode==='register'||(redemption&&mode==='reset');
  const field=(key:keyof typeof form,label:string,type='text',autoComplete?:string)=> <label className="rq-auth-field" key={key}><span>{label}</span><input required type={type} autoComplete={autoComplete} value={form[key]}
    minLength={key==='password'&&mode!=='login'?10:undefined} maxLength={key==='password'||key==='confirm'?72: key==='workspace'?49:254}
    pattern={key==='workspace'?'[a-z0-9][a-z0-9\\-]{2,48}':undefined} autoCapitalize={key==='workspace'||key==='email'?'none':undefined}
    onChange={e=>setForm({...form,[key]:key==='workspace'?e.target.value.toLowerCase().trim():e.target.value})}/></label>;
  return <div className="rq-auth-page"><aside className="rq-auth-story"><a href="https://www.getritim.com/quality" className="rq-auth-brand" aria-label="Ritim Quality ana sayfa"><Factory size={26}/>ritim <small>quality</small></a><div className="rq-auth-story-content"><span>ÇİZİMDEN RAPORA</span><h1>Her ölçümün<br/>bir yeri olsun.</h1><p>Teknik resimden kontrol planına, ilk ölçümden son rapora. Kalitenin her adımı aynı çalışma alanında.</p><div className="rq-auth-journey" aria-label="Kalite kontrol adımları">{['Teknik resim','Kontrol planı','Ölçüm raporu'].map((step,i)=><div key={step}><b>0{i+1}</b><span>{step}</span><Check size={14}/></div>)}</div></div><p><ShieldCheck size={18}/> Firmaya özel çalışma alanı</p></aside><main className="rq-auth-main"><div className="rq-auth-card"><div className="rq-auth-icon" aria-hidden="true"><LockKeyhole size={23}/></div><span className="rq-auth-eyebrow">{mode==='register'?'EKİBİNİZ İÇİN YENİ BİR BAŞLANGIÇ':'RİTİM QUALITY · HESABINIZ'}</span><h2>{platformLogin&&mode==='login'?'Platform y?netimine giri?':titles[mode]}</h2><p>{platformLogin&&mode==='login'?'Platform y?neticisi hesab?n?zla giri? yap?n.':descriptions[mode]}</p>
    <form onSubmit={submit}><fieldset disabled={loading}>
      {mode==='register'&&<>{field('companyName','Firma adı','text','organization')}{field('name','Ad soyad','text','name')}</>}
      {!redemption&&<>{field('workspace','Çalışma alanı','text','organization-title')}<small>Örnek: ornek-fabrika. Girişte bu adı kullanacaksınız.</small>{field('email','E-posta adresi','email','username')}</>}
      {showPassword&&field('password',mode==='reset'?'Yeni şifre':'Şifre','password',mode==='login'?'current-password':'new-password')}
      {(mode==='register'||(mode==='reset'&&redemption))&&<small>En az 10 karakter kullanın.</small>}
      {mode==='reset'&&redemption&&field('confirm','Yeni şifreyi tekrar girin','password','new-password')}
      {mailRequest&&mailEnabled===false&&<p className="rq-auth-feedback">E-posta ile hesap işlemleri henüz etkin değil. Firma yöneticinizle iletişime geçin.</p>}
      {error&&<p role="alert" className="rq-auth-feedback error">{error}</p>}
      {message&&<p role="status" className="rq-auth-feedback">{message}</p>}
      <button className="rq-auth-submit" disabled={loading||(mailRequest&&!mailEnabled)}>{loading?<Loader2 className="animate-spin" size={18}/>:null}{mode==='login'?'Giriş yap':mode==='register'?'14 günlük denemeyi başlat':redemption?(mode==='reset'?'Şifremi yenile':'E-postamı doğrula'):'Bağlantı iste'}{!loading&&<ArrowRight size={18}/>}</button>
    </fieldset></form>
    <div className="rq-auth-links">{mode==='login'?<><button onClick={()=>switchMode('forgot')}>Şifremi unuttum</button><button onClick={()=>switchMode('register')}>Yeni firma hesabı oluştur</button><button onClick={()=>switchMode('verify')}>E-posta doğrulama</button></>:<button onClick={()=>switchMode('login')}>Giriş ekranına dön</button>}</div>
    <nav className="rq-auth-policy-links" aria-label="Yardım ve bilgilendirme"><a href="https://www.getritim.com/quality/help" target="_blank" rel="noreferrer">Yardım</a><a href="https://www.getritim.com/quality/privacy" target="_blank" rel="noreferrer">Gizlilik</a><a href="https://www.getritim.com/quality/terms" target="_blank" rel="noreferrer">Kullanım koşulları</a></nav><div className="rq-auth-footnote"><ShieldCheck size={14}/> {mode==='reset'?'Şifreniz yalnızca size ait. Kimseyle paylaşmayın.':'Kalitenin her adımında, yanınızda.'}</div>
  </div></main></div>;
};
