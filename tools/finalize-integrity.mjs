import {readFileSync as read,writeFileSync as write} from 'node:fs';
const edit=(path,fn)=>write(path,fn(read(path,'utf8').replace(/\r\n/g,'\n')));
edit('server/services/access.ts',s=>s.replace('SELECT plan_id, subscription_status, trial_ends_at FROM tenants', 'SELECT plan_id, subscription_status, trial_ends_at, billing_source, manual_license_ends_at FROM tenants').replace("  if (!tenant || (!trialValid", "  if (tenant?.billing_source === 'manual' && (!tenant.manual_license_ends_at || new Date(tenant.manual_license_ends_at).getTime() <= Date.now())) throw Object.assign(new Error('Manuel lisans süresi dolmuş.'), {status:402});\n  if (!tenant || (!trialValid"));
edit('server/routes/saas.ts',s=>s.replace("      const hash = input.password",`      if(existing?.role==='admin' && (input.role!=='admin'||input.status!=='active')) {
        await client.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[tenantId]);
        if((await client.query("SELECT count(*)::int count FROM users WHERE tenant_id=$1 AND role='admin' AND status='active'",[tenantId])).rows[0].count<=1) conflict('Son aktif yöneticinin rolü veya durumu değiştirilemez.');
      }
      if(existing?.status==='suspended' && input.status==='active')await assertQuota(client,tenantId,'users');
      const hash = input.password`).replace('password:z.string().min(4)', 'password:z.string().min(10)'));
for(const prefix of ['', 'on-premise/']){
 const api=prefix?'OnPremApi':'SaasApi';
 edit(prefix+'src/services/storage.ts',s=>{
   const from=s.indexOf('  init: () => {');const end=s.indexOf('\n  },',from);
   s=s.slice(0,from)+`  init: () => {
    if (!localStorage.getItem(STORAGE_KEYS.APP_SETTINGS)) localStorage.setItem(STORAGE_KEYS.APP_SETTINGS,JSON.stringify(DEFAULT_SETTINGS));`+s.slice(end);
   s=s.replaceAll('data ? JSON.parse(data) : INITIAL_PRODUCTS','data ? JSON.parse(data) : []').replaceAll('return INITIAL_PRODUCTS;','return [];').replaceAll('data ? JSON.parse(data) : INITIAL_CONTROL_PLANS','data ? JSON.parse(data) : []').replaceAll('return INITIAL_CONTROL_PLANS;','return [];').replaceAll('data ? JSON.parse(data) : INITIAL_USERS','data ? JSON.parse(data) : []').replaceAll('return INITIAL_USERS;','return [];');
   s=s.replace('  importData: (jsonStr: string): boolean => {','  importData: (jsonStr: string): boolean => {\n    if (!import.meta.env.DEV) throw new Error(\'Sunucu verileri yalnızca yönetilen veritabanı geri yüklemesiyle değiştirilebilir.\');');
   s=s.replace('  resetToDemo: (): void => {','  resetToDemo: (): void => {\n    if (!import.meta.env.DEV) throw new Error(\'Demo sıfırlama üretimde kullanılamaz.\');');
   s=s.replace('    const confirmed = await',`    const scope = ${api}.scope();\n    const confirmed = await`).replace('    log = confirmed;',`    if (${api}.scope() !== scope) throw new Error('Oturum değişti. Kayıt önceki hesabınıza kaydedildi.');\n    log = confirmed;`);
   s=s.replace('      pinCode: String', '      pinCode: String');
   return s;
 });
 edit(prefix+'src/App.tsx',s=>s.replace("  const [syncError, setSyncError] = useState('');", "  const [syncError, setSyncError] = useState('');\n  const [hydrated,setHydrated] = useState(false);")
   .replace('StorageService.hydrateFromApi().then(loadData).catch(StorageService.reportSyncError);', 'StorageService.hydrateFromApi().then(()=>{loadData();setHydrated(true);}).catch(StorageService.reportSyncError);')
   .replace('  return (\n    <div className=',`  if(!hydrated)return <main className="p-8"><p role="status">{syncError || 'Çalışma alanı yükleniyor…'}</p>{syncError&&<button type="button" className="mt-4 rounded-lg border p-3" onClick={()=>window.location.reload()}>Yeniden dene</button>}</main>;
  return (
    <div className=`)
   .replace('    setInspectionLogs(prev => [newLog, ...prev]);','    setInspectionLogs(prev => [newLog, ...prev.filter(log=>log.id!==newLog.id)]);'));
 edit(prefix+'src/components/DataBackupModal.tsx',s=>s.replace('onChange={handleImportFile}', 'disabled={!import.meta.env.DEV} onChange={handleImportFile}').replace('onClick={handleResetDemo}', 'hidden={!import.meta.env.DEV} onClick={handleResetDemo}'));
 edit(prefix+'src/components/Navbar.tsx',s=>s.replace('onClick={onOpenBackupModal}', 'hidden={currentUser.role!==\'admin\'} onClick={onOpenBackupModal}'));
 edit(prefix+'src/components/UserManager.tsx',s=>s.replace("Hızlı giriş PIN'i",'Geçici şifre').replace('(isteğe bağlı, 4-6 rakam)','(yeni kullanıcı için en az 10 karakter)').replace('type="text" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6}', 'type="password" required={!editingUser} minLength={10} maxLength={128}').replace("event.target.value.replace(/\\D/g, '')", 'event.target.value'));
 edit(prefix+'server/routes/'+(prefix?'app.ts':'saas.ts'),s=>s.replace('if(existing.voided_at || existing.payload.requestSignature !== signature)', `if(existing.voided_at || existing.payload.operatorUserId !== ${prefix?'req.auth!.userId':'userId'} || existing.payload.requestSignature !== signature)`));
 edit(prefix+'src/components/MeasurementLogs.tsx',s=>s.replace('StorageService.deleteInspectionLog(logId)', 'StorageService.deleteInspectionLog(logId)'));
 edit(prefix+'src/services/spcEngine.ts',s=>{
   s=s.replace('if (count === 0) return null;', 'if (count < 2 || !Number.isFinite(char.usl) || !Number.isFinite(char.lsl) || char.usl <= char.lsl) return null;');
   s=s.replace('const effectiveStdDev = stdDev === 0 ? 0.00001 : stdDev;', 'if (stdDev === 0) return null;\n    const effectiveStdDev = stdDev;');
   s=s.replace('const effectiveWithinStdDev=withinStdDev||effectiveStdDev;', 'if(withinDegreesOfFreedom>0 && withinStdDev===0)return null;\n    const effectiveWithinStdDev=withinStdDev;');
   s=s.replace('const populationStdDev = Math.sqrt(totalSquaredDiffs / count) || effectiveStdDev;', 'const populationStdDev = stdDev;');
   s=s.replace('const ucl = Number((mean + 3 * (effectiveStdDev / Math.sqrt(Math.min(5, count)))).toFixed(4));','const ucl = Number((mean + 2.66 * movingRangeAverage).toFixed(4));').replace('const lcl = Number((mean - 3 * (effectiveStdDev / Math.sqrt(Math.min(5, count)))).toFixed(4));','const lcl = Number((mean - 2.66 * movingRangeAverage).toFixed(4));');
   s=s.replace('const metric = SPCEngine.calculateMetric(char, logs);', 'const metric = SPCEngine.calculateMetric(char, logs.filter(log=>log.controlPlanId===plan.id && log.controlPlanVersion===plan.version));');
   s=s.replace('Mükemmel Süreç Yeteneği (6 Sigma)','Yüksek hesaplanan süreç yeteneği').replace('Yetenekli Süreç (IATF 16949 Onaylı)','Hesaplanan süreç yeteneği yeterli aralıkta').replace("Hata ihtimali milyonda 1'in altındadır.",'Sonuç, kullanılan örneklem ve dağılım varsayımlarına bağlıdır.').replace('Süreç kararlıdır.','Kararlılığı kontrol grafikleriyle ayrıca doğrulayın.');
   return s;
 });
}
