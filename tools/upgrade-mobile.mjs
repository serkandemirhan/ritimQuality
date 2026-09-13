import {readFileSync as read,writeFileSync as write} from 'node:fs';
const edit=(path,fn)=>write(path,fn(read(path,'utf8').replace(/\r\n/g,'\n')));
const local=read('on-premise/src/types.ts','utf8');
edit('src/types.ts',s=>s.slice(0,s.indexOf('export interface SPCMetric'))+local.slice(local.indexOf('export interface SPCMetric'),local.indexOf('/* =========================================================================',local.indexOf('export interface SPCMetric')))+s.slice(s.indexOf('/* =========================================================================',s.indexOf('export interface SPCMetric'))));
for(const prefix of ['', 'on-premise/']){
const api=prefix?'OnPremApi':'SaasApi';
edit(prefix+'src/components/OperatorStation.tsx',s=>{
  s=s.replace('  // Selection State',`  const draftKey = 'quality:draft:' + ${api}.scope();
  const restoredRef = useRef(false);
  const [draftAvailable,setDraftAvailable] = useState(() => Boolean(localStorage.getItem(draftKey)));
  // Selection State`);
  const anchor='  const inputRef = useRef<HTMLInputElement>(null);';
  s=s.replace(anchor,anchor+`
  useEffect(() => {
    if (!isSessionActive || savedLog) return;
    try { localStorage.setItem(draftKey, JSON.stringify({selectedProductId,selectedPlanId,lotNumber,orderNumber,machineNo,sampleCount,samples,notes,activePointNo,activeSampleIndex,serialNumber,source,equipmentId})); }
    catch { StorageService.reportSyncError(new Error('Taslak cihazda saklanamadı. Tarayıcı depolama alanını kontrol edin.')); }
  }, [isSessionActive,savedLog,selectedProductId,selectedPlanId,lotNumber,orderNumber,machineNo,sampleCount,samples,notes,activePointNo,activeSampleIndex,serialNumber,source,equipmentId,draftKey]);
  const restoreDraft = () => {
    try {
      const draft=JSON.parse(localStorage.getItem(draftKey) || 'null');
      if(!draft || !controlPlans.some(p=>p.id===draft.selectedPlanId && p.isActive && p.status==='active'))throw new Error('Taslağın planı aktif değil. Kalite sorumlunuzla görüşün.');
      restoredRef.current=true;
      setSelectedProductId(draft.selectedProductId);setSelectedPlanId(draft.selectedPlanId);
      setLotNumber(draft.lotNumber);setOrderNumber(draft.orderNumber);setMachineNo(draft.machineNo);setSampleCount(draft.sampleCount);
      setSamples(draft.samples);setNotes(draft.notes);setActivePointNo(draft.activePointNo);setActiveSampleIndex(draft.activeSampleIndex);
      setSerialNumber(draft.serialNumber||'');setSource(draft.source||'manual');setEquipmentId(draft.equipmentId||'');
      setIsSessionActive(true);setDraftAvailable(false);
    }catch(error){alert(error instanceof Error?error.message:'Taslak açılamadı.');}
  };
`);
  s=s.replace('    if (!selectedProductId) return;', '    if (restoredRef.current) return;\n    if (!selectedProductId) return;');
  s=s.replace('    const plan = controlPlans.find(item => item.id === selectedPlanId);', '    if (restoredRef.current) { restoredRef.current = false; return; }\n    const plan = controlPlans.find(item => item.id === selectedPlanId);');
  s=s.replace('    setSavedLog(confirmed);','    setSavedLog(confirmed);\n    localStorage.removeItem(draftKey); setDraftAvailable(false);');
  s=s.replace('<div className="w-full">','<div className="w-full quality-operator">\n      {!isSessionActive && draftAvailable && <div className="mb-4 rounded-xl bg-blue-50 p-4"><p className="font-bold">Yarım kalan bir kontrolünüz var.</p><button type="button" onClick={restoreDraft} className="mt-2 rounded-lg bg-blue-700 px-4 py-3 text-white">Kontrole devam et</button></div>}');
  s=s.replace('flex flex-col h-[calc(100dvh-5.25rem)] min-h-[580px] max-h-[100dvh] -my-3 sm:-my-4','quality-session flex flex-col gap-3 lg:h-[calc(100dvh-7rem)] lg:min-h-[580px]');
  s=s.replace('flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 min-h-0 overflow-hidden','quality-measurement-grid flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:min-h-0 lg:overflow-hidden');
  s=s.replace('lg:col-span-7 xl:col-span-8 flex flex-col min-h-0 h-full overflow-hidden','quality-drawing lg:col-span-7 xl:col-span-8 flex flex-col min-h-0 h-[32dvh] min-h-48 lg:h-full overflow-hidden');
  s=s.replace('pt-2 border-t border-slate-100 flex flex-col gap-2','quality-measurement-actions sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 bg-white p-2 border-t border-slate-100 flex flex-col gap-2 lg:static');
  s=s.replace('disabled={!isComplete}', 'disabled={!isComplete || saving}');
  s=s.replace('type="number"\n                          step=', 'inputMode="decimal" type="number"\n                          step=');
  s=s.replace("parseFloat(rawVal)","Number(rawVal.replace(',', '.'))");
  // Stable ordering works even when imported point numbers are not contiguous.
  const from=s.indexOf('  const handleAdvanceNext =');const to=s.indexOf('  // Demo auto-fill',from);
  s=s.slice(0,from)+`  const handleAdvanceNext = () => {
    const index=characteristics.findIndex(c=>c.pointNo===activePointNo);
    if(index<characteristics.length-1)setActivePointNo(characteristics[index+1].pointNo);
    else if(activeSampleIndex<sampleCount){setActiveSampleIndex(value=>value+1);setActivePointNo(characteristics[0].pointNo);}
  };
  const handleGoPrevious = () => {
    const index=characteristics.findIndex(c=>c.pointNo===activePointNo);
    if(index>0)setActivePointNo(characteristics[index-1].pointNo);
    else if(activeSampleIndex>1){setActiveSampleIndex(value=>value-1);setActivePointNo(characteristics.at(-1)!.pointNo);}
  };

`+s.slice(to);
  return s;
});
edit(prefix+'src/components/Navbar.tsx',s=>{
  s=s.replace("  const [mobileOpen, setMobileOpen] = useState(false);",`  const [mobileOpen, setMobileOpen] = useState(false);
  const preferenceKey = 'quality:preferences:' + currentUser.id;
  const [hand,setHand] = useState<'left'|'right'>(()=>localStorage.getItem(preferenceKey)==='left'?'left':'right');
  useEffect(()=>{document.documentElement.dataset.hand=hand;localStorage.setItem(preferenceKey,hand);},[hand,preferenceKey]);`);
  s=s.replace('<nav className="flex-1', `<div className="px-4 py-2"><label className="text-xs">Kullanılan el<select aria-label="Kullanılan el" value={hand} onChange={e=>setHand(e.target.value as 'left'|'right')} className="ml-3 rounded-lg bg-slate-800 p-2"><option value="right">Sağ el</option><option value="left">Sol el</option></select></label></div>\n      <nav className="flex-1`);
  s=s.replace('      {mobileOpen && (',`      <nav aria-label="Mobil gezinme" className="quality-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white px-2 pt-1 text-slate-800 lg:hidden" style={{paddingBottom:'max(.5rem, env(safe-area-inset-bottom))'}}>
        {visibleItems.filter(item=>['operator','logs','work','spc'].includes(item.id)).slice(0,3).map(item=><button key={item.id} type="button" onClick={()=>onTabChange(item.id)} aria-current={activeTab===item.id?'page':undefined} className={'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs '+(activeTab===item.id?'bg-blue-100 text-blue-800 font-bold':'')}>{item.icon}<span>{item.id==='operator'?'Ölçüm':item.id==='logs'?'Kayıtlar':item.id==='work'?'İşlerim':'SPC'}</span></button>)}
        <button type="button" onClick={()=>setMobileOpen(true)} aria-expanded={mobileOpen} className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs"><Menu className="h-5 w-5"/>Diğer</button>
      </nav>
      {mobileOpen && (`);
  s=s.replace('relative h-full w-[280px] animate-in','quality-mobile-menu relative h-full w-[280px] max-w-full animate-in');
  return s;
});
edit(prefix+'src/index.css',s=>s+`
@media (pointer: coarse) {
  button, select, input:not([type="file"]), [role="button"] { min-height:44px; }
  button, [role="button"] { min-width:44px; }
  input, select, textarea { font-size:16px !important; }
}
@media (max-width:1023px) {
  body { padding-bottom:calc(4.5rem + env(safe-area-inset-bottom)); }
  .quality-operator { overflow-wrap:anywhere; }
  .quality-session, .quality-measurement-grid { overflow:visible; }
  .quality-measurement-grid > div:last-child { overflow:visible; height:auto; }
  .quality-measurement-grid > div:last-child > div { overflow:visible; }
  .quality-session button { min-height:44px; min-width:44px; }
  [data-hand="right"] .quality-mobile-menu { margin-left:auto; }
  [data-hand="left"] .quality-measurement-actions > div:first-child { flex-direction:row-reverse; }
  [data-hand="left"] .quality-bottom-nav { direction:rtl; }
  .quality-bottom-nav button { direction:ltr; }
}
@media (prefers-reduced-motion:reduce) { *, *::before, *::after { scroll-behavior:auto !important; animation:none !important; transition:none !important; } }
button:focus-visible, a:focus-visible { outline:3px solid #2563eb; outline-offset:3px; }
`);
}
