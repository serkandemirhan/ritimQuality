import { readFileSync as read, writeFileSync as write, copyFileSync as copy } from 'node:fs';
const edit=(path,fn)=>write(path,fn(read(path,'utf8').replace(/\r\n/g,'\n')));
const local=read('on-premise/src/types.ts','utf8');
edit('src/types.ts',s=>local.slice(0,local.indexOf('export interface SPCMetric'))+s.slice(s.indexOf('export interface SPCMetric')));
for(const file of ['OperatorStation','ControlPlanEditor','ProductManagement','DrawingCanvas','MeasurementLogs','InspectionCertificateModal','SPCReports']){
  write(`src/components/${file}.tsx`,read(`on-premise/src/components/${file}.tsx`,'utf8').replaceAll('OnPremApi','SaasApi'));
}
copy('on-premise/src/services/spcEngine.ts','src/services/spcEngine.ts');
copy('src/services/pendingInspections.ts','on-premise/src/services/pendingInspections.ts');
write('on-premise/src/components/PendingInspections.tsx',read('src/components/PendingInspections.tsx','utf8').replaceAll('SaasApi','OnPremApi'));
const media=read('on-premise/src/services/api.ts','utf8');
edit('src/services/api.ts',s=>s.replace('  voidInspectionLog:',media.slice(media.indexOf('  uploadEvidence:'),media.indexOf('  voidInspectionLog:'))+'  voidInspectionLog:'));
for(const prefix of ['', 'on-premise/']){
  const api=prefix?'OnPremApi':'SaasApi';
  edit(prefix+'src/services/api.ts',s=>{
    s="import { pendingStore, sessionScope } from './pendingInspections';\n"+s;
    s=s.replace(`export const ${api} = {`,`const pending = pendingStore(TOKEN_KEY);\nexport const ${api} = {\n  scope: () => sessionScope(TOKEN_KEY),\n  pendingInspections: pending.list,`);
    s=s.replace("saveInspectionLog: (value: { id: string }) => request('/inspection-logs', { method: 'POST', body: JSON.stringify(value) }),","saveInspectionLog: (value: { id: string }) => pending.save(value, () => request('/inspection-logs', { method: 'POST', body: JSON.stringify(value) })),");
    s=s.replace("logout: () => localStorage.removeItem(TOKEN_KEY)",`logout: () => { localStorage.removeItem(TOKEN_KEY); for(const key of Object.keys(localStorage)) if(key.startsWith('${prefix?'qualitrack_onprem_':'qualitrack_'}') && !key.includes(':pending:') && !key.includes(':draft:') && !key.includes(':preferences:') && key !== TOKEN_KEY) localStorage.removeItem(key); }`);
    return s;
  });
  edit(prefix+'src/services/storage.ts',s=>s.replace('saveInspectionLog: async (log: InspectionLog): Promise<void>', 'saveInspectionLog: async (log: InspectionLog): Promise<InspectionLog>').replace('else logs.unshift(log);\n    localStorage.setItem(STORAGE_KEYS.INSPECTION_LOGS, JSON.stringify(logs));', 'else logs.unshift(log);\n    localStorage.setItem(STORAGE_KEYS.INSPECTION_LOGS, JSON.stringify(logs));\n    return log;'));
  edit(prefix+'src/App.tsx',s=>"import { PendingInspections } from './components/PendingInspections';\n"+s.replace('        {/* Main Content Area */}', '        <PendingInspections onSaved={loadData} />\n        {/* Main Content Area */}'));
  edit(prefix+'src/components/OperatorStation.tsx',s=>{
    s=s.replace('  // Selection State',`  const submissionRef = useRef<InspectionLog | null>(null);
  const savingRef = useRef(false);
  const [saving,setSaving] = useState(false);
  // Selection State`);
    s=s.replace('    setSavedLog(null);', '    setSavedLog(null);\n    submissionRef.current = null;');
    s=s.replace('    if (!currentProduct || !currentPlan) return;', "    if (!currentProduct || !currentPlan || savingRef.current || savedLog) return;\n    savingRef.current = true; setSaving(true);");
    s=s.replace('const sessionCode = `INS-${new Date().toISOString().slice(0, 10).replace(/-/g, \'\')}-${String(Math.floor(Math.random() * 900) + 100)}`;', "const sessionCode = `INS-${crypto.randomUUID()}`;");
    s=s.replace('const newLog: InspectionLog = {', 'const newLog: InspectionLog = submissionRef.current || {');
    s=s.replace('id: `log-${Date.now()}`,', 'id: crypto.randomUUID(),');
    s=s.replace('    await StorageService.saveInspectionLog(newLog);\n    onInspectionSaved(newLog);\n    setSavedLog(newLog);', '    submissionRef.current = newLog;\n    const confirmed = await StorageService.saveInspectionLog(newLog);\n    onInspectionSaved(confirmed);\n    setSavedLog(confirmed);');
    const start=s.indexOf('  const handleSaveInspection');const end=s.indexOf('  // Active sample data',start);
    let block=s.slice(start,end).replace("'İşlem kaydedilemedi.'); }", "'İşlem kaydedilemedi.'); } finally { savingRef.current = false; setSaving(false); }");
    s=s.slice(0,start)+block+s.slice(end);
    s=s.replace('onClick={handleSaveInspection}', 'aria-busy={saving} onClick={handleSaveInspection}');
    return s;
  });
}
