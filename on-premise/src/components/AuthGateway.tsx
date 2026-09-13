import React, { useEffect, useState } from 'react';
import { Factory, Loader2, LockKeyhole, Server, ShieldCheck } from 'lucide-react';
import { OnPremApi } from '../services/api';

export const AuthGateway: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(OnPremApi.hasSession());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });

  useEffect(() => {
    const expired = () => {
      setAuthenticated(false);
      setError('Oturum süreniz doldu. Lütfen yeniden giriş yapın.');
    };
    window.addEventListener('qualitrack-auth-expired', expired);
    return () => window.removeEventListener('qualitrack-auth-expired', expired);
  }, []);

  if (authenticated) return <>{children}</>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await OnPremApi.login(form);
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-slate-950 text-white lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 p-14 lg:flex">
        <div className="flex items-center gap-3"><Factory className="h-8 w-8 text-blue-400"/><span className="text-xl font-black">Ritim Quality On-Premise</span></div>
        <div className="max-w-lg"><h1 className="text-4xl font-black leading-tight">Kalite verileriniz kurum altyapınızda kalır.</h1><p className="mt-5 text-slate-300">Revizyonlu kontrol planları, operatör ölçümleri, SPC ve denetim izi; abonelik veya harici ödeme servisi olmadan.</p></div>
        <div className="flex gap-6 text-xs text-slate-400"><span className="flex gap-2"><Server className="h-4 w-4 text-emerald-400"/>Yerel kurulum</span><span className="flex gap-2"><ShieldCheck className="h-4 w-4 text-blue-400"/>Rol bazlı erişim</span><span className="flex gap-2"><LockKeyhole className="h-4 w-4 text-amber-400"/>Kurum içi veri</span></div>
      </section>
      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
          <div><h2 className="text-2xl font-black">Yönetim sistemine giriş</h2><p className="mt-1 text-sm text-slate-400">Yerel kullanıcı hesabınızla devam edin.</p></div>
          <input required type="email" autoComplete="username" placeholder="E-posta" value={form.email} onChange={event => setForm({...form, email: event.target.value})} className="auth-input"/>
          <input required type="password" autoComplete="current-password" placeholder="Şifre" value={form.password} onChange={event => setForm({...form, password: event.target.value})} className="auth-input"/>
          {error && <div className="rounded-xl border border-red-900 bg-red-950/60 p-3 text-sm text-red-300">{error}</div>}
          <button disabled={loading} className="flex w-full justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold hover:bg-blue-500 disabled:opacity-60">{loading && <Loader2 className="h-5 w-5 animate-spin"/>}Giriş Yap</button>
          <p className="text-center text-xs text-slate-500">Kullanıcı hesapları yalnızca sistem yöneticisi tarafından oluşturulur.</p>
        </form>
      </main>
    </div>
  );
};
