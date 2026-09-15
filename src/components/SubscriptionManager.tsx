import React, { useState } from 'react';
import { TenantCompany, SubscriptionPlan, SubscriptionPlanId, User } from '../types';
import { SUBSCRIPTION_PLANS } from '../data/mockData';
import { SaasApi } from '../services/api';
import { 
  CreditCard, 
  CheckCircle2, 
  Sparkles, 
  Building, 
  Sliders, 
  HardHat, 
  TrendingUp, 
  ShieldCheck, 
  Download, 
  Copy, 
  Check, 
  Calendar, 
  Clock, 
  ArrowUpRight, 
  AlertCircle,
  FileText,
  Key,
  Layers,
  ChevronRight,
  Zap
} from 'lucide-react';

interface SubscriptionManagerProps {
  company: TenantCompany;
  controlPlanCount: number;
  userCount: number;
  monthlyMeasurementCount: number;
  onUpdatePlan: (planId: SubscriptionPlanId, billingPeriod: 'monthly' | 'annual') => Promise<void>;
  onSaveCompanyDetails: (updated: TenantCompany) => void | Promise<boolean | void>;
}

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  company,
  controlPlanCount,
  userCount,
  monthlyMeasurementCount,
  onUpdatePlan,
  onSaveCompanyDetails,
}) => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>(company.billingPeriod || 'annual');
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [copiedLicense, setCopiedLicense] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState('');

  // Form State
  const [companyForm, setCompanyForm] = useState<TenantCompany>({ ...company });

  const activePlan = SUBSCRIPTION_PLANS.find(p => p.id === company.planId) || SUBSCRIPTION_PLANS[1];
  const subscriptionLabel = company.subscriptionStatus === 'active' ? 'Abonelik Aktif' : company.subscriptionStatus === 'trial' ? 'Deneme Sürümü' : company.subscriptionStatus === 'past_due' ? 'Ödeme Gecikmiş' : 'Abonelik İptal';

  const handleCopyLicense = () => {
    navigator.clipboard.writeText(company.licenseKey);
    setCopiedLicense(true);
    setTimeout(() => setCopiedLicense(false), 2000);
  };

  const handlePlanChange = async (planId: SubscriptionPlanId) => {
    setCheckoutPlan(planId);
    setCheckoutError('');
    try {
      await onUpdatePlan(planId, billingPeriod);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Ödeme sayfası açılamadı.');
      setCheckoutPlan(null);
    }
  };

  const [savingCompany,setSavingCompany]=useState(false);
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if(savingCompany)return;
    setSavingCompany(true);
    try {
    const saved = await onSaveCompanyDetails(companyForm);
    if(saved!==false)setIsEditingCompany(false);
    } finally {setSavingCompany(false);}
  };

  // Quota percentages
  const planQuotaPct = Math.min(100, Math.round((controlPlanCount / activePlan.maxControlPlans) * 100));
  const operatorQuotaPct = Math.min(100, Math.round((userCount / activePlan.maxOperators) * 100));
  const measurementQuotaPct = Math.min(100, Math.round((monthlyMeasurementCount / activePlan.maxMonthlyMeasurements) * 100));

  return (
    <div className="space-y-6">
      {/* Top Banner: Active Subscription Status */}
      <div className="bg-gradient-to-r from-blue-900/50 via-[#1E293B] to-slate-900 border border-blue-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-900 text-blue-300 border border-blue-700">
                Abonelik
              </span>
              <span className="text-xs uppercase font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {subscriptionLabel}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white">
              {company.name}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              {company.industry} • {company.facilityLocation}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 font-mono">
                <Key className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-400">Abonelik ID:</span>
                <span className="text-white font-bold bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700">
                  {company.licenseKey}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLicense}
                  className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  title="Abonelik kimliğini kopyala"
                >
                  {copiedLicense ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">Yenileme Tarihi:</span>
                <span className="text-white font-semibold">{company.subscriptionRenewsAt}</span>
              </div>
            </div>
          </div>

          {/* Current Tier Badge & Quick Action */}
          <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center shrink-0 min-w-[240px]">
            <span className="text-xs text-slate-400 font-medium">Mevcut Abonelik Planı</span>
            <div className="text-lg font-black text-white mt-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>{activePlan.name}</span>
            </div>
            <div className="text-xs text-blue-300 font-mono mt-1 font-bold">
              {company.billingPeriod === 'annual' ? 'Yıllık Faturalandırma' : 'Aylık Faturalandırma'}
            </div>
            <button
              type="button"
              onClick={() => setIsEditingCompany(true)}
              className="mt-3 w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              Şirket & Fatura Bilgileri
            </button>
            <button
              type="button"
              onClick={() => void SaasApi.openBillingPortal().catch(error => setCheckoutError(error instanceof Error ? error.message : 'Fatura portalı açılamadı.'))}
              className="mt-2 w-full py-1.5 px-3 rounded-xl bg-blue-950/60 hover:bg-blue-900 text-blue-200 text-xs font-semibold border border-blue-800 transition"
            >
              Ödeme & Faturaları Yönet
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Usage & Quota Meters */}
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Abonelik Kota & Kullanım Durumu</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Dönem: {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Kontrol Planları Kotası */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                Kontrol Planı Sayısı
              </span>
              <span className="font-mono font-bold text-white">
                {controlPlanCount} / {activePlan.maxControlPlans >= 9999 ? 'Sınırsız' : activePlan.maxControlPlans}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${activePlan.maxControlPlans >= 9999 ? 15 : Math.max(5, planQuotaPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>{activePlan.maxControlPlans - controlPlanCount > 0 ? `${activePlan.maxControlPlans - controlPlanCount} plan daha oluşturabilirsiniz` : 'Kota limiti doldu'}</span>
              <span>%{planQuotaPct} Dolu</span>
            </div>
          </div>

          {/* Operatör & Ekip Kotası */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <HardHat className="w-3.5 h-3.5 text-emerald-400" />
                Kullanıcı & Operatör
              </span>
              <span className="font-mono font-bold text-white">
                {userCount} / {activePlan.maxOperators >= 9999 ? 'Sınırsız' : activePlan.maxOperators}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${activePlan.maxOperators >= 9999 ? 20 : Math.max(5, operatorQuotaPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Eşzamanlı terminal erişimi</span>
              <span>%{operatorQuotaPct} Dolu</span>
            </div>
          </div>

          {/* Aylık Ölçüm Kotası */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                Aylık Ölçüm Kaydı
              </span>
              <span className="font-mono font-bold text-white">
                {monthlyMeasurementCount.toLocaleString()} / {activePlan.maxMonthlyMeasurements >= 99999 ? 'Sınırsız' : activePlan.maxMonthlyMeasurements.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-purple-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${activePlan.maxMonthlyMeasurements >= 99999 ? 10 : Math.max(5, measurementQuotaPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>SPC & Yetenek analizine dahil</span>
              <span>%{measurementQuotaPct} Dolu</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Pricing Tiers Section */}
      <div className="space-y-4">
        {checkoutError && (
          <div className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-xs text-red-200">{checkoutError}</div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">
              SaaS Abonelik Paketleri & Yükseltme
            </h2>
            <p className="text-xs text-slate-400">
              İmalathanenizin büyüklüğüne göre planınızı dilediğiniz zaman yükseltebilir veya değiştirebilirsiniz.
            </p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center bg-[#1E293B] p-1 rounded-xl border border-slate-700 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                billingPeriod === 'monthly'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aylık Ödeme
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('annual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                billingPeriod === 'annual'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Yıllık Ödeme</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-bold">
                %20 İndirimli
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = company.planId === plan.id && company.subscriptionStatus === 'active';
            const price = billingPeriod === 'annual' 
              ? Math.round(plan.annualPrice / 12) 
              : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                id={`plan-card-${plan.id}`}
                className={`bg-[#1E293B] border rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between relative ${
                  isCurrent
                    ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-xl'
                    : plan.isPopular
                    ? 'border-blue-500/50 hover:border-blue-400 shadow-lg'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                {/* Popular Pill */}
                {plan.isPopular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                    En Çok Tercih Edilen
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Mevcut Paketiniz</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-white">{plan.name}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {plan.badge}
                    </span>
                  </div>

                  {import.meta.env.VITE_HIDE_PRICES!=='true'&&<div className="mt-4 mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">₺{price.toLocaleString()}</span>
                      <span className="text-xs text-slate-400">/ ay</span>
                    </div>
                    {billingPeriod === 'annual' && (
                      <p className="text-[11px] text-emerald-400 mt-0.5">
                        Yıllık ₺{plan.annualPrice.toLocaleString()} olarak faturalandırılır
                      </p>
                    )}
                  </div>

                  }
                  {/* Feature Checklist */}
                  <ul className="space-y-2.5 text-xs text-slate-300 border-t border-slate-700/80 pt-4">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Switch / Action Button */}
                <div className="mt-6 pt-4 border-t border-slate-700/80">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs cursor-default flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Kullanılan Aktif Plan</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handlePlanChange(plan.id)}
                      disabled={checkoutPlan !== null}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98 shadow-md ${
                        plan.isPopular
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                      }`}
                    >
                      <span>{checkoutPlan === plan.id ? 'Stripe açılıyor…' : 'Bu Pakete Geç'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice & Company Details Modal */}
      {isEditingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Şirket & Fatura Bilgilerini Düzenle
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingCompany(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Şirket Kısa Adı *
                </label>
                <input
                  type="text"
                  required
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Resmi Şirket Ünvanı (Fatura İçin) *
                </label>
                <input
                  type="text"
                  required
                  value={companyForm.legalName}
                  onChange={(e) => setCompanyForm({ ...companyForm, legalName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Vergi Numarası *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyForm.taxNumber}
                    onChange={(e) => setCompanyForm({ ...companyForm, taxNumber: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Vergi Dairesi *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyForm.taxOffice}
                    onChange={(e) => setCompanyForm({ ...companyForm, taxOffice: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Fabrika / Tesis Adresi
                </label>
                <textarea
                  rows={2}
                  value={companyForm.facilityLocation}
                  onChange={(e) => setCompanyForm({ ...companyForm, facilityLocation: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Fatura E-posta
                  </label>
                  <input
                    type="email"
                    value={companyForm.contactEmail}
                    onChange={(e) => setCompanyForm({ ...companyForm, contactEmail: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Telefon
                  </label>
                  <input
                    type="text"
                    value={companyForm.contactPhone}
                    onChange={(e) => setCompanyForm({ ...companyForm, contactPhone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-700 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingCompany(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                >
                  İptal
                </button>
                <button
                  disabled={savingCompany} type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition"
                >
                  Bilgileri Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
