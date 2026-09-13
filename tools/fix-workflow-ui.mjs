import {readFileSync as read,writeFileSync as write} from 'node:fs';
const edit=(path,fn)=>write(path,fn(read(path,'utf8').replace(/\r\n/g,'\n')));
for(const prefix of ['', 'on-premise/']){
 edit(prefix+'src/App.tsx',s=>{
   for(const name of ['handleSaveUser','handleSaveCompanyDetails']){
     const start=s.indexOf('  const '+name+' =');if(start<0)continue;
     const end=s.indexOf('\n  };',start);let block=s.slice(start,end);
     block=block.replace('    } catch (error)', '    return true;\n    } catch (error)').replace("'İşlem kaydedilemedi.'); }", "'İşlem kaydedilemedi.'); return false; }");
     s=s.slice(0,start)+block+s.slice(end);
   }
   return s;
 });
 edit(prefix+'src/components/UserManager.tsx',s=>s.replace('onSaveUser: (user: User) => void;', 'onSaveUser: (user: User) => void | Promise<boolean | void>;').replace('const submitForm = (event: React.FormEvent)', 'const submitForm = async (event: React.FormEvent)').replace('    onSaveUser({', '    const saved = await onSaveUser({').replace('    closeForm();\n  };','    if(saved!==false)closeForm();\n  };'));
 edit(prefix+'src/services/storage.ts',s=>s.replace(`    await ${prefix?'OnPremApi':'SaasApi'}.saveUser(user);`, `    await ${prefix?'OnPremApi':'SaasApi'}.saveUser(user);\n    user = {...user, pinCode:undefined};`));
 edit(prefix+'src/components/ControlPlanEditor.tsx',s=>{
   const start=s.indexOf('onClick={() => {\n                    onSetActiveVersion');
   if(start>=0){const end=s.indexOf('\n                  }}',start)+22;s=s.slice(0,start)+`onClick={async () => {
                    try { const active={...currentPlan,isActive:true,status:'active' as const};await StorageService.saveControlPlan(active);setCurrentPlan(active);onSavePlan(active); }
                    catch(error){alert(error instanceof Error?error.message:'Plan aktifleştirilemedi.');}
                  }}`+s.slice(end);}
   s=s.replace("const activePlan = plans.find(plan => plan.isActive && plan.status === 'active') || plans[0];", "const activePlan = plans.find(plan => plan.isActive && plan.status === 'active');");
   return s;
 });
 edit(prefix+'src/services/api.ts',s=>s.replace('logout: () => {',`logout: async () => {
    try { await request('/push/subscriptions',{method:'DELETE'}); const registration=await navigator.serviceWorker?.getRegistration();await (await registration?.pushManager.getSubscription())?.unsubscribe(); } catch { /* The local session must still be closed when offline. */ }
   `));
 edit(prefix+'src/App.tsx',s=>s.replace(`onLogout={() => { ${prefix?'OnPremApi':'SaasApi'}.logout(); window.location.reload(); }}`,`onLogout={async () => { await ${prefix?'OnPremApi':'SaasApi'}.logout(); window.location.reload(); }}`));
 // Avoid suggesting that a displayed statistic certifies regulatory compliance.
 edit(prefix+'src/App.tsx',s=>s.replace('ISO 9001:2015 & IATF 16949 Uyumlu Çok Kullanıcılı Bulut Kalite & SPC Sistemi','Revizyon kontrollü kalite kayıtları ve SPC analizi'));
}
edit('src/components/SubscriptionManager.tsx',s=>s.replace('onSaveCompanyDetails: (updated: TenantCompany) => void;', 'onSaveCompanyDetails: (updated: TenantCompany) => void | Promise<boolean | void>;').replace('const handleSaveCompany = (e: React.FormEvent)', 'const handleSaveCompany = async (e: React.FormEvent)').replace('    onSaveCompanyDetails(companyForm);\n    setIsEditingCompany(false);','    const saved = await onSaveCompanyDetails(companyForm);\n    if(saved!==false)setIsEditingCompany(false);'));
