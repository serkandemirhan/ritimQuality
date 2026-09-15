import React, {useEffect,useState} from 'react';
import {SaasApi} from '../services/api';
import type {Product,ControlPlan,User,InspectionLog} from '../types';
import type {NavTab} from './Navbar';

export function Onboarding({products,plans,users,logs,onNavigate}:{products:Product[];plans:ControlPlan[];users:User[];logs:InspectionLog[];onNavigate:(tab:NavTab)=>void}) {
  const key='quality:onboarding:'+SaasApi.scope();
  const complete=logs.length>0&&products.length>0&&plans.some(p=>p.isActive&&p.status==='active')&&users.some(u=>u.role==='operator'&&u.status==='active');
  const [dismissed,setDismissed]=useState(()=>localStorage.getItem(key)==='complete');
  useEffect(()=>{if(complete){localStorage.setItem(key,'complete');setDismissed(true);}},[complete,key]);
  const steps:{label:string;description:string;tab:NavTab;done:boolean}[]=[
    {label:'1. İlk parçayı oluştur',description:'Parça kodu, teknik resim ve malzemeyi ekleyin.',tab:'products',done:products.length>0},
    {label:'2. Kontrol planını hazırla',description:'Gerçek ölçüm noktalarını ve toleransları girip planı aktifleştirin.',tab:'control-plans',done:plans.some(p=>p.isActive&&p.status==='active')},
    {label:'3. Operatör hesabını ekle',description:'Üretim ekibine kendi hesabıyla erişim verin.',tab:'users',done:users.some(u=>u.role==='operator'&&u.status==='active')},
    {label:'4. İlk kontrolü kaydet',description:'Parti ve iş emriyle ölçüm yapıp sunucu kaydını doğrulayın.',tab:'operator',done:logs.length>0},
  ];
  if(complete||dismissed)return null;
  return <section className="m-3 rounded-2xl border border-blue-200 bg-blue-50 p-4"><h2 className="font-bold">İlk kontrole başlayalım</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{steps.map(step=><button type="button" key={step.tab} onClick={()=>onNavigate(step.tab)} className="rounded-xl border bg-white p-4 text-left"><span className="block font-bold">{step.done?'✓ ':''}{step.label}</span><span className="mt-1 block text-sm text-slate-600">{step.description}</span></button>)}</div></section>;
}
