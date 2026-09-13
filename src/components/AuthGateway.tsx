import React, { useEffect, useState } from 'react';
import { Factory, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { SaasApi } from '../services/api';

export const AuthGateway: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(SaasApi.hasSession());
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ workspace: '', email: '', password: '', companyName: '', name: '' });

  useEffect(() => {
    const expired = () => { setAuthenticated(false); setError('Oturum süreniz doldu. Lütfen yeniden giriş yapın.'); };
    window.addEventListener('qualitrack-auth-expired', expired);
    return () => window.removeEventListener('qualitrack-auth-expired', expired);
  }, []);

  if (authenticated) return <>{children}</>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    try {
      if (mode === 'login') await SaasApi.login({ workspace: form.workspace, email: form.email, password: form.password });
      else await SaasApi.register(form);
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white grid lg:grid-cols-2">
      <section className="hidden lg:flex p-14 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 flex-col justify-between">
        <div className="flex items-center gap-3"><Factory className="w-8 h-8 text-blue-400"/><span className="text-xl font-black">Ritim Quality SaaS</span></div>
        <div className="max-w-lg"><h1 className="text-4xl font-black leading-tight">Kalite kontrol ve ölçüm yönetimi, tek güvenli çalışma alanında.</h1><p className="mt-5 text-slate-300">Revizyonlu kontrol planları, operatör ölçümleri, SPC ve denetim izi.</p></div>
        <div className="flex gap-6 text-xs text-slate-400"><span className="flex gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400"/>Tenant izolasyonu</span><span className="flex gap-2"><LockKeyhole className="w-4 h-4 text-blue-400"/>Rol bazlı erişim</span></div>
      </section>
      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl space-y-4">
          <div><h2 className="text-2xl font-black">{mode === 'login' ? 'Çalışma alanına giriş' : '14 günlük denemeyi başlat'}</h2><p className="text-sm text-slate-400 mt-1">{mode === 'login' ? 'Firma çalışma alanınız ve hesabınızla devam edin.' : 'İlk yönetici hesabınızı oluşturun.'}</p></div>
          {mode === 'register' && <><input required placeholder="Firma adı" value={form.companyName} onChange={e=>setForm({...form,companyName:e.target.value})} className="auth-input"/><input required placeholder="Ad soyad" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="auth-input"/></>}
          <input required pattern="[a-z0-9][a-z0-9-]{2,48}" placeholder="Çalışma alanı (ornek-fabrika)" value={form.workspace} onChange={e=>setForm({...form,workspace:e.target.value.toLowerCase()})} className="auth-input"/>
          <input required type="email" placeholder="E-posta" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="auth-input"/>
          <input required minLength={mode === 'register' ? 10 : 1} type="password" placeholder="Şifre" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="auth-input"/>
          {error && <div className="text-sm text-red-300 bg-red-950/60 border border-red-900 rounded-xl p-3">{error}</div>}
          <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-xl py-3 font-bold flex justify-center gap-2">{loading && <Loader2 className="w-5 h-5 animate-spin"/>}{mode === 'login' ? 'Giriş Yap' : 'Firma Hesabı Oluştur'}</button>
          <button type="button" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}} className="w-full text-sm text-blue-300 hover:text-blue-200">{mode === 'login' ? 'Yeni firma hesabı oluştur' : 'Zaten hesabım var'}</button>
        </form>
      </main>
    </div>
  );
};
