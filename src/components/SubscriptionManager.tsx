import {Badge, Button, Card, Field, FormSection, IconButton, Input, Modal, PageActions, Tabs, Textarea} from './ui';
import {UsageMeter} from './ui/UsageMeter';
import React, { useState } from 'react';
import { TenantCompany, SubscriptionPlanId } from '../types';
import { SUBSCRIPTION_PLANS } from '../data/mockData';
import { SaasApi } from '../services/api';
import {CheckCircle2, Copy, Check} from 'lucide-react';

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

  return <div className="space-y-6">
    <Card><div className="rq-chart-heading"><div><Badge tone={company.subscriptionStatus==='active'?'success':company.subscriptionStatus==='trial'?'info':'warning'}>{subscriptionLabel}</Badge><h2 className="rq-section-title mt-3">{company.name}</h2><p className="rq-helper">{[company.industry,company.facilityLocation].filter(Boolean).join(' · ')}</p></div><div><span className="rq-helper">Mevcut plan</span><h3 className="rq-section-title">{activePlan.name}</h3><p className="rq-helper">{company.billingPeriod==='annual'?'Yıllık faturalandırma':'Aylık faturalandırma'}</p></div></div>
      <dl className="rq-detail-grid"><div><dt>Abonelik kimliği</dt><dd className="flex items-center gap-2">{company.licenseKey||'—'}{company.licenseKey&&<IconButton label="Abonelik kimliğini kopyala" onClick={handleCopyLicense}>{copiedLicense?<Check size={16}/>:<Copy size={16}/>}</IconButton>}</dd></div><div><dt>Yenileme tarihi</dt><dd>{company.subscriptionRenewsAt||'—'}</dd></div></dl>
      <PageActions className="mt-4"><Button onClick={()=>setIsEditingCompany(true)}>Şirket & Fatura Bilgileri</Button><Button onClick={()=>void SaasApi.openBillingPortal().catch(error=>setCheckoutError(error instanceof Error?error.message:'Fatura portalı açılamadı.'))}>Ödeme & Faturaları Yönet</Button></PageActions>
    </Card>
    <section aria-label="Abonelik kullanımı"><h2 className="rq-section-title mb-4">Kota ve kullanım</h2><div className="rq-metrics-row">
      <UsageMeter label="Kontrol planı" value={controlPlanCount} limit={activePlan.maxControlPlans} unlimited={activePlan.maxControlPlans>=9999}/>
      <UsageMeter label="Kullanıcı / operatör" value={userCount} limit={activePlan.maxOperators} unlimited={activePlan.maxOperators>=9999}/>
      <UsageMeter label="Aylık ölçüm kaydı" value={monthlyMeasurementCount} limit={activePlan.maxMonthlyMeasurements} unlimited={activePlan.maxMonthlyMeasurements>=99999}/>
    </div></section>
    {checkoutError&&<p role="alert" className="rq-feedback rq-tone-danger">{checkoutError}</p>}
    <section className="space-y-5"><div className="rq-chart-heading"><div><h2 className="rq-section-title">Abonelik planları</h2><p className="rq-helper">Çalışma alanınız için planları ve kullanım sınırlarını karşılaştırın.</p></div><Tabs label="Faturalandırma dönemi" value={billingPeriod} onChange={value=>setBillingPeriod(value as 'monthly'|'annual')} items={[{id:'monthly',label:'Aylık ödeme'},{id:'annual',label:'Yıllık ödeme'}]}/></div>
      <div className="rq-plan-comparison">{SUBSCRIPTION_PLANS.map(plan=>{
        const isCurrent=company.planId===plan.id&&company.subscriptionStatus==='active';
        const price=billingPeriod==='annual'?Math.round(plan.annualPrice/12):plan.monthlyPrice;
        return <Card key={plan.id} className={'flex flex-col gap-5 '+(isCurrent?'rq-card-selected':'')} id={'plan-card-'+plan.id}>
          <div className="rq-actions"><Badge tone={isCurrent?'success':'neutral'}>{isCurrent?'Mevcut paketiniz':plan.badge}</Badge></div>
          <h3 className="rq-section-title">{plan.name}</h3>
          {import.meta.env.VITE_HIDE_PRICES!=='true'&&<div><p className="rq-kpi-value">₺{price.toLocaleString()} <span className="rq-helper">/ ay</span></p>{billingPeriod==='annual'&&<p className="rq-helper">Yıllık ₺{plan.annualPrice.toLocaleString()} olarak faturalandırılır.</p>}</div>}
          <ul className="space-y-3 flex-1">{plan.features.map((feature,index)=><li key={index} className="flex items-start gap-2 text-sm"><CheckCircle2 size={16} className="shrink-0 text-emerald-700 mt-0.5"/><span>{feature}</span></li>)}</ul>
          <Button variant={isCurrent?'secondary':'primary'} disabled={isCurrent||checkoutPlan!==null} loading={checkoutPlan===plan.id} onClick={()=>void handlePlanChange(plan.id)}>{isCurrent?'Kullanılan aktif plan':checkoutPlan===plan.id?'Stripe açılıyor…':'Bu Pakete Geç'}</Button>
        </Card>;
      })}</div>
    </section>
    <Modal open={isEditingCompany} title="Şirket & Fatura Bilgilerini Düzenle" onClose={()=>setIsEditingCompany(false)} busy={savingCompany}>
      <form onSubmit={handleSaveCompany} className="space-y-5"><fieldset disabled={savingCompany} className="space-y-5">
        <FormSection title="Şirket kimliği"><Field label="Şirket kısa adı"><Input required value={companyForm.name} onChange={event=>setCompanyForm({...companyForm,name:event.target.value})}/></Field><Field label="Resmi şirket ünvanı"><Input required value={companyForm.legalName} onChange={event=>setCompanyForm({...companyForm,legalName:event.target.value})}/></Field></FormSection>
        <FormSection title="Fatura bilgileri"><Field label="Vergi numarası"><Input required value={companyForm.taxNumber} onChange={event=>setCompanyForm({...companyForm,taxNumber:event.target.value})}/></Field><Field label="Vergi dairesi"><Input required value={companyForm.taxOffice} onChange={event=>setCompanyForm({...companyForm,taxOffice:event.target.value})}/></Field><Field label="Fatura e-posta"><Input type="email" value={companyForm.contactEmail} onChange={event=>setCompanyForm({...companyForm,contactEmail:event.target.value})}/></Field><Field label="Telefon"><Input value={companyForm.contactPhone} onChange={event=>setCompanyForm({...companyForm,contactPhone:event.target.value})}/></Field></FormSection>
        <Field label="Fabrika / tesis adresi"><Textarea rows={2} value={companyForm.facilityLocation} onChange={event=>setCompanyForm({...companyForm,facilityLocation:event.target.value})}/></Field>
        <PageActions><Button onClick={()=>setIsEditingCompany(false)}>İptal</Button><Button type="submit" variant="primary" loading={savingCompany}>Bilgileri Kaydet</Button></PageActions>
      </fieldset></form>
    </Modal>
  </div>;
};
