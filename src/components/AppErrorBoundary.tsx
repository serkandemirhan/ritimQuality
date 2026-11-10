import {Component,type ErrorInfo,type ReactNode} from 'react';

/** Keep local drafts intact when a rendering error interrupts the session. */
export class AppErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(_error:Error,_info:ErrorInfo){console.error('Uygulama görünümü açılamadı. Yeniden yükleme gerekli.');}
  render(){
    if(!this.state.failed)return this.props.children;
    return <main className="rq-app-recovery" role="alert"><div><span>RİTİM QUALITY</span><h1>Bu ekranı yeniden açmamız gerekiyor.</h1><p>Beklenmeyen bir sorun oluştu. Kaydedilmiş kayıtlarınız ve cihazdaki taslaklarınız silinmedi. Henüz kaydedilmemiş son girişinizin korunmuş olduğunu doğrulayamıyoruz.</p><button type="button" className="rq-button" onClick={()=>window.location.reload()}>Ekranı yeniden yükle</button><a href="https://www.getritim.com/quality/help">Kullanım yardımını aç</a></div></main>;
  }
}
