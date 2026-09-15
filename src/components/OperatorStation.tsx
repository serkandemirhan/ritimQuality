import { InspectionQR } from './InspectionQR';
import React, { useState, useEffect, useRef } from 'react';
import { Product, ControlPlan, Characteristic, InspectionLog, SampleMeasurement, User, MeasurementValue, EvidenceAttachment, MeasurementSource } from '../types';
import { StorageService } from '../services/storage';
import { SaasApi } from '../services/api';
import { DrawingCanvas } from './DrawingCanvas';
import { 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Save, 
  RotateCcw, 
  Printer, 
  Hash, 
  Layers, 
  Cpu, 
  ArrowRight, 
  ArrowLeft,
  Volume2,
  VolumeX,
  Sparkles,
  Split,
  Maximize2,
  Gauge,
  Plus,
  Minus,
  Check,
  Zap,
  HelpCircle,
  Eye,
  User as UserIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface OperatorStationProps {
  initialProductId?: string;
  products: Product[];
  controlPlans: ControlPlan[];
  currentUser?: User;
  onInspectionSaved: (newLog: InspectionLog) => void;
  onOpenActions?:()=>void;
  onOpenCertificate: (log: InspectionLog) => void;
}

export const OperatorStation: React.FC<OperatorStationProps> = ({
  initialProductId,
  products,
  controlPlans,
  currentUser,
  onInspectionSaved,
  onOpenCertificate, onOpenActions,
}) => {
  const submissionRef = useRef<InspectionLog | null>(null);
  const savingRef = useRef(false);
  const [saving,setSaving] = useState(false);
  const draftKey = 'quality:draft:' + SaasApi.scope();
  const restoredRef = useRef(false);
  const [draftAvailable,setDraftAvailable] = useState(() => Boolean(localStorage.getItem(draftKey)));
  type ServerDraft={id:string;payload:Record<string,any>;claimed_by:string|null;claimed_by_name?:string;created_by_name:string;updated_at:string};
  const [serverDrafts,setServerDrafts]=useState<ServerDraft[]>([]);
  const [draftId,setDraftId]=useState<string|null>(null);
  const [draftBusy,setDraftBusy]=useState(false);
  // Selection State
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId || new URLSearchParams(window.location.search).get('product') || '');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  
  // Session Metadata
  const [operatorName, setOperatorName] = useState<string>(currentUser ? currentUser.name : 'Operatör Ahmet Kurt');
  const [lotNumber, setLotNumber] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [serialNumber, setSerialNumber] = useState<string>(new URLSearchParams(window.location.search).get('wo') || '');
  const [machineNo, setMachineNo] = useState<string>(currentUser?.stationOrMachine || 'CNC Torna #01 (Doosan)');
  const [source, setSource] = useState<MeasurementSource>('manual');
  const [equipmentId, setEquipmentId] = useState<string>(currentUser?.stationOrMachine || 'MANUEL-ISTASYON-01');
  const [sampleCount, setSampleCount] = useState<number>(5);
  const [customSampleCount, setCustomSampleCount] = useState<number>(5);
  const [mediaUploading, setMediaUploading] = useState(false);

  // Sync with current user changes
  useEffect(() => {
    if (currentUser) {
      setOperatorName(currentUser.name);
      if (currentUser.stationOrMachine) {
        setMachineNo(currentUser.stationOrMachine);
      }
    }
  }, [currentUser]);

  
  // Active Inspection State
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [activePointNo, setActivePointNo] = useState<number>(1);
  const [activeSampleIndex, setActiveSampleIndex] = useState<number>(1);
  const [samples, setSamples] = useState<SampleMeasurement[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [savedLog, setSavedLog] = useState<InspectionLog | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [mobileLayoutMode, setMobileLayoutMode] = useState<'split' | 'drawing' | 'card'>('split');

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isSessionActive || savedLog) return;
    try { localStorage.setItem(draftKey, JSON.stringify({draftId,submission:submissionRef.current,selectedProductId,selectedPlanId,lotNumber,orderNumber,machineNo,sampleCount,samples,notes,activePointNo,activeSampleIndex,serialNumber,source,equipmentId})); }
    catch { StorageService.reportSyncError(new Error('Taslak cihazda saklanamadı. Tarayıcı depolama alanını kontrol edin.')); }
  }, [isSessionActive,savedLog,draftId,selectedProductId,selectedPlanId,lotNumber,orderNumber,machineNo,sampleCount,samples,notes,activePointNo,activeSampleIndex,serialNumber,source,equipmentId,draftKey,saving]);
  const refreshDrafts=async()=>setServerDrafts(await SaasApi.inspectionDrafts() as ServerDraft[]);
  useEffect(()=>{void refreshDrafts().catch(()=>{});},[]);
  const applyDraft=(draft:Record<string,any>)=>{
    if(!controlPlans.some(p=>p.id===draft.selectedPlanId&&p.isActive&&p.status==='active'))throw new Error('Taslağın planı artık aktif değil. Kalite sorumlunuzla görüşün.');
    submissionRef.current=null;restoredRef.current=true;setDraftId(draft.id||draft.draftId);
    setSelectedProductId(draft.productId||draft.selectedProductId);setSelectedPlanId(draft.selectedPlanId);setLotNumber(draft.lotNumber||'');setOrderNumber(draft.orderNumber||'');setMachineNo(draft.machineNo||'');setSampleCount(draft.sampleCount);setCustomSampleCount(draft.sampleCount);
    setSamples(draft.samples);setNotes(draft.notes||'');setActivePointNo(draft.activePointNo);setActiveSampleIndex(draft.activeSampleIndex);setSerialNumber(draft.serialNumber||'');setSource(draft.source||'manual');setEquipmentId(draft.equipmentId||'');setOperatorName(currentUser.name);setIsSessionActive(true);setDraftAvailable(false);
  };
  const restoreDraft = () => {
    try {
      const draft=JSON.parse(localStorage.getItem(draftKey) || 'null');
      if(!draft || !controlPlans.some(p=>p.id===draft.selectedPlanId && p.isActive && p.status==='active'))throw new Error('Taslağın planı aktif değil. Kalite sorumlunuzla görüşün.');
      applyDraft({...draft,id:draft.draftId||crypto.randomUUID(),productId:draft.selectedProductId});
    }catch(error){alert(error instanceof Error?error.message:'Taslak açılamadı.');}
  };


  // Products are loaded asynchronously from the on-premise API. Keep the selection valid
  // after hydration and when a product is removed.
  useEffect(() => {
    if (products.length === 0) {
      setSelectedProductId('');
      return;
    }
    if (selectedProductId && !products.some(product => product.id === selectedProductId)) {
      setSelectedProductId('');
    }
  }, [products, selectedProductId]);

  // When product changes, automatically pick active control plan
  useEffect(() => {
    if (restoredRef.current) return;
    if (!selectedProductId) { setSelectedPlanId(''); return; }
    const plans = controlPlans.filter(cp => cp.productId === selectedProductId);
    const active = plans.find(cp => cp.isActive && cp.status === 'active');
    if (active) {
      setSelectedPlanId(active.id);
      setSampleCount(active.defaultSampleCount || 5);
    } else {
      setSelectedPlanId('');
    }
  }, [selectedProductId, controlPlans]);

  useEffect(() => {
    if (restoredRef.current) { restoredRef.current = false; return; }
    const plan = controlPlans.find(item => item.id === selectedPlanId);
    setActivePointNo(plan?.characteristics[0]?.pointNo ?? 1);
  }, [selectedPlanId, controlPlans]);

  const currentProduct = products.find(p => p.id === selectedProductId);
  const currentPlan = controlPlans.find(cp => cp.id === selectedPlanId);
  const characteristics = currentPlan?.characteristics || [];
  const currentCharacteristic = characteristics.find(c => c.pointNo === activePointNo) || characteristics[0];

  // Auto focus input when active point/sample changes
  useEffect(() => {
    if (isSessionActive && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [activePointNo, activeSampleIndex, isSessionActive]);

  // Start Inspection Session
  const handleStartSession = () => {
    if (!currentPlan || !currentPlan.isActive || currentPlan.status !== 'active' || !characteristics.length || !lotNumber.trim() || !orderNumber.trim()) { alert('Aktif plan, parti ve iş emri zorunludur.'); return; }

    setDraftId(crypto.randomUUID());
    // Initialize blank sample matrix
    const initialSamples: SampleMeasurement[] = [];
    for (let i = 1; i <= sampleCount; i++) {
      const values: Record<string, MeasurementValue> = {};
      const statuses: Record<string, 'pass' | 'warning' | 'fail' | 'empty'> = {};
      characteristics.forEach(c => {
        values[c.id] = null;
        statuses[c.id] = 'empty';
      });
      initialSamples.push({
        sampleIndex: i,
        values,
        statuses,
      });
    }

    setSamples(initialSamples);
    setActivePointNo(characteristics[0].pointNo);
    setActiveSampleIndex(1);
    setIsSessionActive(true);
    setSavedLog(null);
    submissionRef.current = null;
  };

  // Sound alert beep for pass/fail
  const playAlertSound = (type: 'pass' | 'fail') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'pass') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else {
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // Audio context policy
    }
  };

  // Handle measurement value change
  const handleValueChange = (charId: string, sIndex: number, rawVal: string) => {
    const char = characteristics.find(c => c.id === charId);
    if (!char || submissionRef.current) return;

    const numVal = rawVal === '' ? null : Number(rawVal.replace(',', '.'));
    let status: 'pass' | 'warning' | 'fail' | 'empty' = 'empty';

    if (numVal !== null && !isNaN(numVal)) {
      if (numVal >= char.lsl && numVal <= char.usl) {
        const tolRange = char.usl - char.lsl;
        const distToBoundary = Math.min(numVal - char.lsl, char.usl - numVal);
        if (distToBoundary <= tolRange * 0.12) {
          status = 'warning';
        } else {
          status = 'pass';
        }
      } else {
        status = 'fail';
      }
    }

    setSamples(prev => {
      return prev.map(s => {
        if (s.sampleIndex === sIndex) {
          return {
            ...s,
            values: { ...s.values, [charId]: numVal },
            statuses: { ...s.statuses, [charId]: status },
          };
        }
        return s;
      });
    });

    if (status === 'fail') {
      playAlertSound('fail');
    }
  };

  const setQualitativeValue = (char: Characteristic, value: MeasurementValue) => {
    if(submissionRef.current)return;
    const rejected=char.rejectedOptions||[];
    const status: 'pass'|'fail' = char.type==='ok_nok'||char.type==='visual'
      ? (value===true||value==='OK'?'pass':'fail')
      : (Array.isArray(value)?value.some(item=>rejected.includes(item)):rejected.includes(String(value)))?'fail':'pass';
    setSamples(previous=>previous.map(sample=>sample.sampleIndex===activeSampleIndex?{...sample,values:{...sample.values,[char.id]:value},statuses:{...sample.statuses,[char.id]:status}}:sample));
    if(status==='fail') playAlertSound('fail');
  };

  const handleEvidenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file=event.target.files?.[0]; if(!file||!currentCharacteristic||submissionRef.current) return;
    const sampleIndex=activeSampleIndex; const characteristicId=currentCharacteristic.id;
    setMediaUploading(true);
    try {
      const attachment=await SaasApi.uploadFile(file);
      setSamples(previous=>previous.map(sample=>sample.sampleIndex===sampleIndex?{...sample,evidence:{...(sample.evidence||{}),[characteristicId]:[...((sample.evidence||{})[characteristicId]||[]),attachment]}}:sample));
    } catch(error){alert(error instanceof Error?error.message:'Kanıt yüklenemedi.');}
    finally{setMediaUploading(false);event.target.value='';}
  };

  // Set precise nominal or offset value with one tap
  const handleSetPresetValue = (value: number) => {
    if (!currentCharacteristic) return;
    const rounded = Number(value.toFixed(currentCharacteristic.unit === '°' ? 1 : 3));
    handleValueChange(currentCharacteristic.id, activeSampleIndex, String(rounded));
  };

  // Move to next measurement point/sample on Enter
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdvanceNext();
    }
  };

  const handleAdvanceNext = () => {
    const index=characteristics.findIndex(c=>c.pointNo===activePointNo);
    if(index<characteristics.length-1)setActivePointNo(characteristics[index+1].pointNo);
    else if(activeSampleIndex<sampleCount){setActiveSampleIndex(value=>value+1);setActivePointNo(characteristics[0].pointNo);}
  };
  const handleGoPrevious = () => {
    const index=characteristics.findIndex(c=>c.pointNo===activePointNo);
    if(index>0)setActivePointNo(characteristics[index-1].pointNo);
    else if(activeSampleIndex>1){setActiveSampleIndex(value=>value-1);setActivePointNo(characteristics.at(-1)!.pointNo);}
  };

  // Demo auto-fill
  const handleFillDemoValues = () => {
    if (!characteristics.length) return;
    setSamples(prev => {
      return prev.map(s => {
        const newValues: Record<string, number | null> = {};
        const newStatuses: Record<string, 'pass' | 'warning' | 'fail' | 'empty'> = {};

        characteristics.forEach(c => {
          const noise = (Math.random() - 0.5) * ((c.usl - c.nominal) * 0.65);
          const val = Number((c.nominal + noise).toFixed(c.unit === '°' ? 1 : 3));
          newValues[c.id] = val;
          newStatuses[c.id] = (val >= c.lsl && val <= c.usl) ? 'pass' : 'fail';
        });

        return {
          ...s,
          values: newValues,
          statuses: newStatuses,
        };
      });
    });
  };

  // Calculate session metrics
  let totalChecked = 0;
  let failCount = 0;
  let warningCount = 0;
  let passCount = 0;

  samples.forEach(s => {
    Object.values(s.statuses).forEach(st => {
      if (st === 'pass') {
        passCount++;
        totalChecked++;
      } else if (st === 'warning') {
        warningCount++;
        totalChecked++;
      } else if (st === 'fail') {
        failCount++;
        totalChecked++;
      }
    });
  });

  const totalPossible = sampleCount * characteristics.length;
  const activeCharacteristicIndex=characteristics.findIndex(c=>c.pointNo===activePointNo);
  const isLastMeasurement=activeCharacteristicIndex===characteristics.length-1&&activeSampleIndex===sampleCount;
  const missingEvidenceCount=samples.reduce((total,sample)=>total+characteristics.filter(char=>{
    const policy=char.evidencePolicy||'none'; const status=sample.statuses[char.id]; const count=(sample.evidence?.[char.id]||[]).length;
    return (['always_required','photo_required','media_required','document_required'].includes(policy)||(policy==='required_on_fail'&&status==='fail'))&&count===0;
  }).length,0);
  const isComplete = totalChecked === totalPossible && totalPossible > 0 && missingEvidenceCount===0;
  const overallResult: 'pass' | 'warning' | 'fail' = failCount > 0 ? 'fail' : (warningCount > 0 ? 'warning' : 'pass');

  const draftPayload=()=>({id:draftId||crypto.randomUUID(),productId:selectedProductId,selectedPlanId,lotNumber,orderNumber,machineNo,sampleCount,samples,notes,activePointNo,activeSampleIndex,serialNumber,source,equipmentId});
  const saveServerDraft=async(release=false)=>{if(!isSessionActive||savedLog||draftBusy)return;setDraftBusy(true);try{const payload=draftPayload();setDraftId(payload.id);await SaasApi.saveInspectionDraft(payload.id,payload);if(release){await SaasApi.releaseInspectionDraft(payload.id);localStorage.removeItem(draftKey);setIsSessionActive(false);setSamples([]);setDraftId(null);}await refreshDrafts();}catch(error){alert(error instanceof Error?error.message:'Taslak kaydedilemedi.');}finally{setDraftBusy(false);}};
  const claimDraft=async(item:ServerDraft)=>{setDraftBusy(true);try{const claimed=await SaasApi.claimInspectionDraft(item.id) as ServerDraft;applyDraft({...claimed.payload,id:item.id});await refreshDrafts();}catch(error){alert(error instanceof Error?error.message:'Taslak devralınamadı.');}finally{setDraftBusy(false);}};

  // Save Session
  const handleSaveInspection = async () => {
    try {
    if (!currentProduct || !currentPlan || savingRef.current || savedLog || mediaUploading) return;
    savingRef.current = true; setSaving(true);

    const sessionCode = `INS-${crypto.randomUUID()}`;
    const newLog: InspectionLog = submissionRef.current || {
      id: crypto.randomUUID(),
      sessionCode,
      productId: currentProduct.id,
      productCode: currentProduct.code,
      productName: currentProduct.name,
      productRevision: currentProduct.revision || '',
      controlPlanId: currentPlan.id,
      controlPlanVersion: currentPlan.version,
      operatorName,
      lotNumber: lotNumber.trim(),
      orderNumber: orderNumber.trim(),
      serialNumber,
      machineNo: machineNo || 'Hat #01',
      source,
      equipmentId: equipmentId || machineNo || 'MANUEL-ISTASYON-01',
      sampleCount,
      overallStatus: overallResult,
      totalPointsChecked: totalChecked,
      failedPointsCount: failCount,
      warningPointsCount: warningCount,
      timestamp: new Date().toISOString(),
      notes: notes || (overallResult === 'pass' ? 'Tüm kontrol noktaları toleranslar dahilindedir.' : 'Tolerans dışı noktalar tespit edildi.'),
      samples,
      draftId: draftId || undefined,
    };

    submissionRef.current = newLog;
    const confirmed = await StorageService.saveInspectionLog(newLog);
    onInspectionSaved(confirmed);
    setSavedLog(confirmed);
    localStorage.removeItem(draftKey); setDraftAvailable(false);setDraftId(null);void refreshDrafts().catch(()=>{});

    if (overallResult === 'pass') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); } finally { savingRef.current = false; setSaving(false); }
  };

  // Active sample data
  const currentSampleObj = samples.find(s => s.sampleIndex === activeSampleIndex);
  const activeSampleStatuses = currentSampleObj?.statuses || {};
  const activeSampleValues = currentSampleObj?.values || {};

  const currentVal = activeSampleValues[currentCharacteristic?.id || ''];
  const currentValStatus = activeSampleStatuses[currentCharacteristic?.id || ''];
  const currentDeviation = (typeof currentVal === 'number' && currentCharacteristic)
    ? Number((currentVal - currentCharacteristic.nominal).toFixed(3))
    : null;

  return (
    <div className="w-full quality-operator">
      {!isSessionActive && <InspectionQR products={products} onSelect={(id,wo)=>{setSelectedProductId(id);setOrderNumber(wo);}}/>}
      {!isSessionActive && draftAvailable && <div className="mb-4 rounded-xl bg-blue-50 p-4"><p className="font-bold">Yarım kalan bir kontrolünüz var.</p><button type="button" onClick={restoreDraft} className="mt-2 rounded-lg bg-blue-700 px-4 py-3 text-white">Kontrole devam et</button></div>}
      {!isSessionActive&&serverDrafts.length>0&&<section className="mb-4 rounded-xl bg-amber-50 p-4"><h2 className="font-bold">Devam edilebilecek kontroller</h2><div className="mt-2 grid gap-2">{serverDrafts.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm"><span>{products.find(p=>p.id===(item.payload.productId||item.payload.selectedProductId))?.name||'Ürün'} · {item.payload.orderNumber||'İş emri yok'} · {item.created_by_name}{item.claimed_by_name&&` · ${item.claimed_by_name} kullanıyor`}</span><button disabled={draftBusy||Boolean(item.claimed_by&&item.claimed_by!==currentUser.id)} className="quality-primary" onClick={()=>void claimDraft(item)}>{item.claimed_by===currentUser.id?'Devam et':'Devral'}</button></div>)}</div></section>}
      {isSessionActive && submissionRef.current && !savedLog && <p role="status" className="my-2 rounded-lg bg-amber-50 p-3 text-sm">Bu ölçüm gönderim için kilitlendi. Kaydet düğmesi aynı kaydın gönderimini tekrar dener.</p>}
      {/* =========================================================================
          MODE 1: SETUP SCREEN (When session is NOT active)
          ========================================================================= */}
      {!isSessionActive ? (
        <div className="space-y-6 max-w-5xl mx-auto py-2">
          {/* Main Welcome Hero */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                  <Play className="w-7 h-7 fill-current ml-0.5" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    Operatör Ölçüm Terminali
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Teknik resimdeki kontrol noktalarını izleyerek ölçüm yapın. Yarım kalan kontrolünüz bu cihazda saklanır.
                  </p>
                </div>
              </div>

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition shadow-xs ${
                  soundEnabled 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'bg-slate-100 border-slate-200 text-slate-500'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4" />}
                <span className="sr-only">{soundEnabled ? 'Sesli Uyarı Açık' : 'Sessiz'}</span>
              </button>
            </div>

            {/* Selection Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-6">
              {/* Product */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Ölçülecek Parça / Ürün
                </label>
                <select
                  id="select-operator-product"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                >
                  <option value="">Ürün seçin</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProductId&&<>
              {/* Control Plan Version */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Kontrol Planı Revizyonu
                </label>
                <select
                  id="select-operator-plan" disabled={currentUser.role==='operator'}
                  value={selectedPlanId}
                  onChange={(e) => {const plan=controlPlans.find(item=>item.id===e.target.value);setSelectedPlanId(e.target.value);if(plan)setSampleCount(plan.defaultSampleCount||5)}}
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                >
                  {controlPlans
                    .filter(cp => cp.productId === selectedProductId)
                    .map(cp => (
                      <option key={cp.id} value={cp.id}>
                        {cp.version} {cp.isActive ? '(AKTİF GÜNCEL)' : `(${cp.status})`} - {cp.characteristics.length} Nokta
                      </option>
                    ))}
                </select>
              </div>

              {/* Sample Count */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Ölçülecek Numune Adedi
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 3, 5, 10].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setSampleCount(cnt)}
                      className={`py-2 rounded-xl text-xs font-bold transition border ${
                        sampleCount === cnt
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-200'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {cnt} Adet
                    </button>
                  ))}
                  <label className="text-center text-xs">Özel<input aria-label="Özel numune adedi" type="number" min={1} max={100} value={customSampleCount} onChange={e=>{const count=Math.min(100,Math.max(1,Math.trunc(Number(e.target.value))||1));setCustomSampleCount(count);setSampleCount(count)}} title="Özel numune adedi" className={`min-w-0 rounded-xl border px-1 text-center text-xs font-bold ${![1,3,5,10].includes(sampleCount)?'border-blue-600 bg-blue-600 text-white':'border-slate-200 bg-slate-50 text-slate-700'}`}/></label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Seri Numarası</label>
                <input type="text" value={serialNumber} onChange={e=>setSerialNumber(e.target.value)} placeholder="Örn: SN00125" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-sm font-mono text-slate-900"/>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Ölçüm Kaynağı</label>
                <select value={source} onChange={e=>setSource(e.target.value as MeasurementSource)} className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-900"><option value="manual">Manuel</option><option value="gauge">Dijital Ölçüm Cihazı</option><option value="import">Dosya İçe Aktarımı</option></select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Ekipman Kimliği</label>
                <input type="text" value={equipmentId} onChange={e=>setEquipmentId(e.target.value)} placeholder="Örn: KUMPAS-014" className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-sm font-mono text-slate-900"/>
              </div>

              <div><label htmlFor="inspection-work-order" className="mb-2 block text-xs font-bold text-slate-700">İş Emri No</label><input id="inspection-work-order" type="text" required maxLength={120} value={orderNumber} onChange={event=>setOrderNumber(event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm"/></div>
              {/* Lot Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Parti / Şarj (Lot) No
                </label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  aria-label="Parti numarası" required maxLength={120} placeholder="Örn: LOT-2026-0815-B"
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs font-mono"
                />
              </div>

              {/* Operator */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Operatör Adı
                </label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                />
              </div>

              {/* Machine */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Tezgah / İstasyon No
                </label>
                <input
                  type="text"
                  value={machineNo}
                  onChange={(e) => setMachineNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                />
              </div>
              </>}
            </div>

            {/* Blueprint Preview Card */}
            {currentPlan && (
              <div className="mt-6 p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold shrink-0">
                    {characteristics.length}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white flex items-center gap-2">
                      <span>{currentProduct?.name}</span>
                      <span className="text-xs text-blue-400 font-mono">({currentPlan.version})</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Bu kontrol planında toplam {characteristics.length} adet kritik ve standart ölçüm noktası tanımlıdır.
                    </p>
                  </div>
                </div>

                <button
                  id="btn-start-inspection"
                  type="button"
                  onClick={handleStartSession}
                  disabled={characteristics.length === 0}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 px-8 rounded-2xl shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2.5 transition active:scale-95 disabled:opacity-50 text-sm tracking-wide"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>ÖLÇÜME BAŞLA (Terminali Aç)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* =========================================================================
            MODE 2: ZERO-SCROLL ERGONOMIC OPERATOR WORKSPACE (Tablet & Mobile Optimized)
            Fits 100% in viewport without any scrolling!
            ========================================================================= */
        <div className="quality-session flex flex-col gap-3 lg:h-[calc(100dvh-7rem)] lg:min-h-[580px]">
          {/* Top Compact Master Ribbon (1 Row, No Clutter) */}
          <div className="bg-[#1E293B] text-white px-3 sm:px-4 py-2 rounded-2xl border border-slate-700 shadow-md flex items-center justify-between gap-2 shrink-0 select-none mb-2 sm:mb-3">
            {/* Left: Product & Version Badges */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                </span>
                <span className="font-bold text-xs sm:text-sm text-white truncate max-w-[120px] sm:max-w-[220px]">
                  {currentProduct?.name}
                </span>
              </div>

              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700">
                <Cpu className="w-3 h-3 text-emerald-400" />
                {currentPlan?.version}
              </span>

              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700">
                <Hash className="w-3 h-3 text-amber-400" />
                {lotNumber}
              </span>
            </div>

            {/* Center: Numune Selector Pills (#1, #2, #3, #4, #5) */}
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-700/80">
              <span className="text-[10px] font-bold text-slate-400 px-1 hidden lg:inline">NUMUNE:</span>
              {samples.map(s => {
                const isSelected = activeSampleIndex === s.sampleIndex;
                const statuses = Object.values(s.statuses);
                const hasFail = statuses.some(st => st === 'fail');
                const isFilled = statuses.length > 0 && statuses.every(st => st !== 'empty');

                return (
                  <button
                    key={s.sampleIndex}
                    id={`sample-tab-${s.sampleIndex}`}
                    type="button"
                    onClick={() => setActiveSampleIndex(s.sampleIndex)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/50'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title={`Numune #${s.sampleIndex}`}
                  >
                    <span>#{s.sampleIndex}</span>
                    {isFilled && (
                      hasFail ? (
                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      )
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right: Actions, Auto Test, Audio & Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Progress pill */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono">
                <span className="text-slate-400">İlerleme:</span>
                <span className="font-bold text-emerald-400">{totalChecked}/{totalPossible}</span>
              </div>

              {/* Auto Demo button */}
              <button
                type="button"
                hidden={!import.meta.env.DEV} onClick={handleFillDemoValues}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-blue-900/60 hover:bg-blue-800 text-blue-300 border border-blue-700 text-xs font-bold transition flex items-center gap-1"
                title="Hızlı Demo Verisi Doldur"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden xl:inline">Test Verisi</span>
              </button>

              {/* Sound */}
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1.5 rounded-xl border text-xs transition ${
                  soundEnabled 
                    ? 'bg-slate-800 text-blue-400 border-slate-700' 
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
                title={soundEnabled ? 'Sesli Uyarı Açık' : 'Sessiz'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* End Session */}
              <button
                type="button"
                onClick={() => {
                  if (confirm('Ölçüm oturumunu kapatmak istiyor musunuz?')) {
                    setIsSessionActive(false);
                  }
                }}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-slate-800 hover:bg-rose-900/50 hover:border-rose-700 text-slate-300 hover:text-rose-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1"
                title="Oturumu Kapat"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kapat</span>
              </button>
            </div>
          </div>

          {/* Main Grid: Zero-scroll Responsive Layout */}
          <div className="quality-measurement-grid flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:min-h-0 lg:overflow-hidden">
            {/* =========================================================================
                LEFT / TOP: Interactive Technical Blueprint Canvas
                Occupies ~60% on desktop/tablet landscape, top ~52% on mobile
                ========================================================================= */}
            <div className="quality-drawing lg:col-span-7 xl:col-span-8 flex flex-col min-h-0 h-[32dvh] min-h-48 lg:h-full overflow-hidden">
              <DrawingCanvas
                key={`${currentPlan.id}:${currentPlan.drawingImageUrl}`}
                imageUrl={currentPlan.drawingImageUrl || currentProduct?.defaultDrawingUrl || ''}
                characteristics={characteristics}
                activePointNo={activePointNo}
                onPointSelect={(pNo) => setActivePointNo(pNo)}
                pointStatuses={activeSampleStatuses}
                measuredValues={activeSampleValues}
                showLabelsDefault={true}
                className="flex-1 w-full h-full min-h-0"
              />
            </div>

            {/* =========================================================================
                RIGHT / BOTTOM: Ergonomic Direct Measurement Deck
                Contains active point details, high-contrast big input, +/- shortcuts,
                stepper navigation, and save buttons - all without scrolling!
                ========================================================================= */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-between min-h-0 h-full bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm overflow-y-auto lg:overflow-visible">
              {currentCharacteristic && (
                <div className="flex flex-col justify-between h-full gap-2 sm:gap-3">
                  {/* Point Top Info Row */}
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 text-white font-black text-sm sm:text-base flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
                          {currentCharacteristic.pointNo}
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                            {currentCharacteristic.name}
                          </h2>
                          <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono truncate">
                            Ölçüm Aleti: <strong className="text-slate-800">{currentCharacteristic.tool}</strong>
                          </div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                        currentCharacteristic.criticalClass === 'critical'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : currentCharacteristic.criticalClass === 'major'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {currentCharacteristic.criticalClass === 'critical' ? '⭐ Kritik' : currentCharacteristic.criticalClass === 'major' ? '🔷 Önemli' : 'Standart'}
                      </span>
                    </div>

                    {/* Tolerance Visual Target Strip (LSL - Nominal - USL) */}
                    <div className="grid grid-cols-3 gap-1 sm:gap-1.5 my-2">
                      <div className="bg-rose-50/70 p-1.5 rounded-xl border border-rose-200 text-center">
                        <div className="text-[9px] text-rose-700 uppercase font-bold tracking-wider">Alt (LSL)</div>
                        <div className="text-xs sm:text-sm font-bold text-rose-700 font-mono mt-0.5">
                          {currentCharacteristic.lsl} {currentCharacteristic.unit}
                        </div>
                      </div>

                      <div className="bg-blue-50 p-1.5 rounded-xl border border-blue-200 text-center ring-1 ring-blue-300">
                        <div className="text-[9px] text-blue-700 uppercase font-bold tracking-wider">Nominal</div>
                        <div className="text-sm sm:text-base font-black text-blue-950 font-mono mt-0.5">
                          {currentCharacteristic.nominal} {currentCharacteristic.unit}
                        </div>
                      </div>

                      <div className="bg-emerald-50/70 p-1.5 rounded-xl border border-emerald-200 text-center">
                        <div className="text-[9px] text-emerald-700 uppercase font-bold tracking-wider">Üst (USL)</div>
                        <div className="text-xs sm:text-sm font-bold text-emerald-700 font-mono mt-0.5">
                          {currentCharacteristic.usl} {currentCharacteristic.unit}
                        </div>
                      </div>
                    </div>

                    {/* Primary Large Touch Measurement Input */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span className="uppercase tracking-wider">
                          #Numune {activeSampleIndex} Ölçülen Değer:
                        </span>
                        <span className="font-mono text-slate-400 text-[10px]">
                          Enter tuşu sonraki noktaya geçirir
                        </span>
                      </div>

                      {(currentCharacteristic.type || 'numeric') === 'numeric' ? <>
                      <div className="relative">
                        <input
                          ref={inputRef}
                          id={`input-measured-value-pt${currentCharacteristic.pointNo}`}
                          inputMode="decimal" type="number"
                          step="0.001"
                          value={typeof currentVal === 'number' ? currentVal : ''}
                          onChange={(e) => handleValueChange(currentCharacteristic.id, activeSampleIndex, e.target.value)}
                          onKeyDown={handleInputKeyDown}
                          placeholder={String(currentCharacteristic.nominal)}
                          className={`w-full text-2xl sm:text-3xl font-mono font-black px-3 py-2 sm:py-2.5 rounded-2xl border bg-white transition text-center focus:outline-none focus:ring-4 shadow-xs ${
                            currentValStatus === 'pass'
                              ? 'border-emerald-500 text-emerald-700 focus:ring-emerald-100 bg-emerald-50/30'
                              : currentValStatus === 'warning'
                              ? 'border-amber-500 text-amber-800 focus:ring-amber-100 bg-amber-50/30'
                              : currentValStatus === 'fail'
                              ? 'border-rose-500 text-rose-700 focus:ring-rose-100 bg-rose-50/30 animate-shake'
                              : 'border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-blue-100'
                          }`}
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold text-xs sm:text-sm">
                          {currentCharacteristic.unit}
                        </span>
                      </div>

                      {/* Quick 1-Tap Preset Value Buttons (Touch Operator Friendly) */}
                      <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => handleSetPresetValue(currentCharacteristic.nominal)}
                          className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] sm:text-[11px] font-bold font-mono transition shrink-0"
                          title="Nominal Değeri Doğrudan Gir"
                        >
                          Nom: {currentCharacteristic.nominal}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetPresetValue(currentCharacteristic.nominal - 0.01)}
                          className="px-1.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-mono font-semibold transition shrink-0"
                        >
                          -0.01
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetPresetValue(currentCharacteristic.nominal + 0.01)}
                          className="px-1.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-mono font-semibold transition shrink-0"
                        >
                          +0.01
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetPresetValue(currentCharacteristic.nominal - 0.02)}
                          className="px-1.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-mono font-semibold transition shrink-0"
                        >
                          -0.02
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetPresetValue(currentCharacteristic.nominal + 0.02)}
                          className="px-1.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-mono font-semibold transition shrink-0"
                        >
                          +0.02
                        </button>
                      </div>
                      </> : (
                        <div className="grid grid-cols-2 gap-2">
                          {currentCharacteristic.type==='ok_nok'||currentCharacteristic.type==='visual' ? <>
                            <button type="button" onClick={()=>setQualitativeValue(currentCharacteristic,true)} className={`rounded-2xl border px-4 py-4 font-black ${currentVal===true?'border-emerald-600 bg-emerald-600 text-white':'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>✓ OK</button>
                            <button type="button" onClick={()=>setQualitativeValue(currentCharacteristic,false)} className={`rounded-2xl border px-4 py-4 font-black ${currentVal===false?'border-rose-600 bg-rose-600 text-white':'border-rose-200 bg-rose-50 text-rose-800'}`}>✕ NOK</button>
                          </> : (currentCharacteristic.options||[]).map(option=>{
                            const selected=Array.isArray(currentVal)?currentVal.includes(option):currentVal===option;
                            return <button key={option} type="button" onClick={()=>{
                              if(currentCharacteristic.type==='multi_select'){
                                const values=Array.isArray(currentVal)?currentVal:[]; setQualitativeValue(currentCharacteristic,selected?values.filter(item=>item!==option):[...values,option]);
                              }else setQualitativeValue(currentCharacteristic,option);
                            }} className={`rounded-xl border px-3 py-3 font-bold ${selected?'border-blue-600 bg-blue-600 text-white':'border-slate-200 bg-slate-50 text-slate-800'}`}>{currentCharacteristic.type==='multi_select'&&(selected?'☑ ':'☐ ')}{option}</button>;
                          })}
                        </div>
                      )}

                      {(currentValStatus==='fail'||(currentCharacteristic.evidencePolicy||'none')!=='none'||currentSampleObj?.evidence?.[currentCharacteristic.id]?.length||currentSampleObj?.pointNotes?.[currentCharacteristic.id])&&(
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-slate-600"><span>Fotoğraf ve ölçüm notu</span><span>{(!currentCharacteristic.evidencePolicy||['none','optional'].includes(currentCharacteristic.evidencePolicy))?'İsteğe bağlı':currentCharacteristic.evidencePolicy==='required_on_fail'?'NOK ise zorunlu':'Zorunlu'}</span></div>
                          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">{mediaUploading?'Yükleniyor…':'📷 🎥 📎 Kanıt Ekle'}<input type="file" accept="image/*,video/*,application/pdf" className="hidden" disabled={mediaUploading || saving || !!submissionRef.current} onChange={handleEvidenceUpload}/></label>
                          <label className="mt-3 block text-xs font-semibold text-slate-600">Bu noktaya not ekle (isteğe bağlı)<textarea aria-label="Ölçüm noktası notu" maxLength={2000} disabled={saving || !!submissionRef.current} value={currentSampleObj?.pointNotes?.[currentCharacteristic.id] || ''} onChange={event=>{const value=event.target.value;setSamples(previous=>previous.map(sample=>sample.sampleIndex===activeSampleIndex?{...sample,pointNotes:{...sample.pointNotes,[currentCharacteristic.id]:value}}:sample));}} placeholder="Örn. yüzeyde çizik, kenarda çapak…" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"/></label>
                          {(currentSampleObj?.evidence?.[currentCharacteristic.id]||[]).map(item=><div key={item.id} className="mt-1 truncate text-[10px] text-emerald-700">✓ {item.fileName}</div>)}
                        </div>
                      )}

                      {/* Instant Real-Time Status & Deviation Ribbon */}
                      {currentVal !== null && currentVal !== undefined && (
                        <div className="pt-1">
                          {currentValStatus === 'pass' && (
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                TOLERANS DAHİLİNDE (UYGUN)
                              </span>
                              <span className="font-mono">{typeof currentVal==='number'?`Sapma: ${currentDeviation&&currentDeviation>0?'+':''}${currentDeviation} ${currentCharacteristic.unit}`:Array.isArray(currentVal)?currentVal.join(', '):String(currentVal)}</span>
                            </div>
                          )}
                          {currentValStatus === 'warning' && (
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
                              <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                SINIRA YAKIN (UYARI)
                              </span>
                              <span className="font-mono">{typeof currentVal==='number'?`Sapma: ${currentDeviation&&currentDeviation>0?'+':''}${currentDeviation} ${currentCharacteristic.unit}`:Array.isArray(currentVal)?currentVal.join(', '):String(currentVal)}</span>
                            </div>
                          )}
                          {currentValStatus === 'fail' && (
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-[11px] font-bold">
                              <span className="flex items-center gap-1.5">
                                <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                TOLERANS DIŞI (HATALI / RED)
                              </span>
                              <span className="font-mono">{typeof currentVal==='number'?`Sapma: ${currentDeviation&&currentDeviation>0?'+':''}${currentDeviation} ${currentCharacteristic.unit}`:Array.isArray(currentVal)?currentVal.join(', '):String(currentVal)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Point Quick Strip (1-tap direct jump to any point) */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      <span>Parça Noktaları (#{activeSampleIndex}):</span>
                      <span className="font-mono">
                        {Object.values(activeSampleStatuses).filter(st => st !== 'empty').length}/{characteristics.length} Dolu
                      </span>
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                      {characteristics.map(c => {
                        const val = activeSampleValues[c.id];
                        const st = activeSampleStatuses[c.id];
                        const isActive = activePointNo === c.pointNo;

                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setActivePointNo(c.pointNo)}
                            className={`px-2 py-1 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1 border ${
                              isActive
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                                : st === 'pass'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : st === 'warning'
                                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                : st === 'fail'
                                ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>#{c.pointNo}</span>
                            {val !== null && val !== undefined && (
                              <span className="font-mono text-[9px] opacity-90">{Array.isArray(val)?val.join(','):val===true?'OK':val===false?'NOK':String(val)}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stepper Navigation & Next / Save Button */}
                  <div className="quality-measurement-actions sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 bg-white p-2 border-t border-slate-100 flex flex-col gap-2 lg:static">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={activePointNo <= 1 && activeSampleIndex <= 1}
                        onClick={handleGoPrevious}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1 transition disabled:opacity-30"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Önceki</span>
                      </button>

                      <div className="text-xs text-slate-700 font-mono font-bold text-center px-1">
                        Nokta {activePointNo} / {characteristics.length}
                      </div>

                      <button
                        type="button"
                        disabled={isLastMeasurement}
                        onClick={handleAdvanceNext}
                        className="flex-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition shadow-sm disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                      >
                        <span>{isLastMeasurement?'Son nokta':'Sonraki'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {!savedLog&&<div className="grid grid-cols-2 gap-2"><button disabled={draftBusy} type="button" className="quality-secondary" onClick={()=>void saveServerDraft(false)}>{draftBusy?'Kaydediliyor…':'Taslağı kaydet'}</button><button disabled={draftBusy} type="button" className="quality-secondary" onClick={()=>void saveServerDraft(true)}>Kaydet ve devret</button></div>}

                    {savedLog?.overallStatus==='fail'&&<div role="status" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Uygunsuzluk otomatik oluşturuldu ve kalite ekibine iletildi.{onOpenActions&&currentUser.role!=='operator'&&<button type="button" onClick={onOpenActions} className="mt-2 block font-semibold underline">Uygunsuzluğu ve aksiyonları aç</button>}</div>}
                    {/* Final Save / Certificate Trigger */}
                    {savedLog ? (
                      <button
                        id="btn-print-certificate"
                        type="button"
                        onClick={() => onOpenCertificate(savedLog)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition"
                      >
                        <Printer className="w-4 h-4" />
                        <span>PDF Kalite Raporunu Aç</span>
                      </button>
                    ) : (
                      <button
                        id="btn-save-inspection-log"
                        type="button"
                        aria-busy={saving} onClick={handleSaveInspection}
                        disabled={!isComplete || saving || mediaUploading}
                        className={`w-full text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-40 ${isComplete?'bg-emerald-700 hover:bg-emerald-600':'bg-slate-900 hover:bg-slate-800'}`}
                      >
                        <Save className="w-4 h-4 text-blue-400" />
                        <span>Ölçümleri Kaydet ({totalChecked}/{totalPossible})</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
