import {nextPlanVersion} from '../services/planVersion';
import { PageHeader, Button, DataTable, SearchInput, TableToolbar, StatusBadge, Badge, Breadcrumb, Card, Select, Input, NumberInput, Textarea, Field, FormSection } from './ui';
import {PLAN_STATUS_LABELS} from '../services/terms';
import {CharacteristicWorkspace} from './CharacteristicWorkspace';
import { EmptyState } from './EmptyState';
import { SaasApi } from '../services/api';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Product, ControlPlan, Characteristic, CriticalClass, MeasurementUnit, MeasurementTool, PinCoordinate, CharacteristicType, EvidencePolicy } from '../types';
import { StorageService } from '../services/storage';
import { DrawingCanvas } from './DrawingCanvas';
import { SHAFT_BUSHING_SVG, FLANGE_BODY_SVG, CONNECTOR_HOUSING_SVG } from '../data/mockData';
import { 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  Layers, 
  Upload, 
  Copy, 
  Info, 
  Sparkles, 
  Check, 
  Sliders, 
  Calendar,
  UserCheck,
  Search,
  ChevronRight,
  ArrowLeft,
  FileText
} from 'lucide-react';

const DrawingAnalysis=lazy(()=>import('./DrawingAnalysis').then(module=>({default:module.DrawingAnalysis})));
const stableValue=(value:unknown):unknown=>Array.isArray(value)?value.map(stableValue):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stableValue(v)])):value;

interface ControlPlanEditorProps {
  initialProductId?: string;
  onCreateProduct?:()=>void;
  onInspect?:(id:string)=>void;
  products: Product[];
  controlPlans: ControlPlan[];
  onSavePlan: (updatedPlan: ControlPlan) => void;
  onSetActiveVersion: (planId: string) => void;
  onDeletePlan: (planId: string) => void;
  onProductUpdated?: (product: Product) => void;
  onOpenQrLabels?:()=>void;
}

export const ControlPlanEditor: React.FC<ControlPlanEditorProps> = ({
  initialProductId, onCreateProduct, onInspect,onOpenQrLabels,
  products,
  controlPlans,
  onSavePlan,
  onSetActiveVersion,
  onDeletePlan,onProductUpdated,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId || products[0]?.id || '');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  
  const requestedPlan = useRef<string | null>(null);
  const [saving,setSaving]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [analysisOpen,setAnalysisOpen]=useState(false);
  // Active Plan Form State
  const [currentPlan, setCurrentPlan] = useState<ControlPlan | null>(null);
  const [activePointNo, setActivePointNo] = useState<number | null>(1);
  const [isSavedBanner, setIsSavedBanner] = useState<boolean>(false);
  const [detailOpen, setDetailOpen] = useState(Boolean(initialProductId));
  const [searchTerm, setSearchTerm] = useState('');
  const [focusMode,setFocusMode]=useState(false);
  const [revisionUsage,setRevisionUsage]=useState<{id:string;used:boolean;token:string}|null>(null);
  const [usageError,setUsageError]=useState('');
  useEffect(()=>{
    if(!selectedPlanId){setRevisionUsage(null);return;}
    let live=true;setRevisionUsage(null);setUsageError('');
    void SaasApi.controlPlanRevisionUsage(selectedPlanId).then(result=>{if(!live)return;const local=controlPlans.find(plan=>plan.id===selectedPlanId);if(!local||JSON.stringify(stableValue(local))!==JSON.stringify(stableValue(result.payload))){setUsageError('Plan başka bir kullanıcı tarafından güncellendi. Düzenlemeden önce sayfayı yenileyin.');return;}setRevisionUsage({id:selectedPlanId,used:result.used,token:result.token});}).catch(()=>{if(live)setUsageError('Plan kullanım durumu alınamadı. Düzenlemek için sayfayı yenileyin.');});
    return ()=>{live=false;};
  },[selectedPlanId]);

  useEffect(() => {
    if (selectedProductId && !products.some(product => product.id === selectedProductId)) {
      setSelectedProductId('');
      setDetailOpen(false);
    }
  }, [products, selectedProductId]);

  // When selected product changes, select its active or first plan
  useEffect(() => {
    const plans = controlPlans.filter(cp => cp.productId === selectedProductId);
    const active = plans.find(cp=>cp.id===requestedPlan.current) || plans.find(cp=>cp.id===selectedPlanId) || plans.find(cp => cp.isActive) || plans[0];
    requestedPlan.current=null;
    if (active) {
      setSelectedPlanId(active.id);
      setCurrentPlan(JSON.parse(JSON.stringify(active)));
    } else {
      setSelectedPlanId('');
      setCurrentPlan(null);
    }
  }, [selectedProductId, controlPlans]);

  // When selected plan ID changes
  const handleSelectPlan = (planId: string) => {
    const found = controlPlans.find(cp => cp.id === planId);
    if (found) {
      setSelectedPlanId(planId);
      setCurrentPlan(JSON.parse(JSON.stringify(found)));
      setActivePointNo(1);
    }
  };

  const productPlans = controlPlans.filter(cp => cp.productId === selectedProductId);
  const currentProduct = products.find(p => p.id === selectedProductId);
  const updatePlan=(next:ControlPlan)=>{
    if(revisionUsage?.id===next.id&&revisionUsage.used){
      const version=nextPlanVersion(controlPlans.filter(p=>p.productId===next.productId).map(p=>p.version));
      const draft={...next,id:`draft-${crypto.randomUUID()}`,version,isActive:false,status:'draft' as const,revisionDate:new Date().toISOString().slice(0,10),revisionNote:`${next.version} revizyonundan oluşturuldu.`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      setCurrentPlan(draft);
    }else setCurrentPlan(next);
  };

  // Pin Move handler on Drawing Canvas
  const handlePinMove = (characteristicId: string, newPin: PinCoordinate) => {
    if (!currentPlan) return;
    setCurrentPlan(prev => {
      if (!prev) return null;
      const updatedChars = prev.characteristics.map(c => {
        if (c.id === characteristicId) {
          return { ...c, pin: newPin };
        }
        return c;
      });
      return { ...prev, characteristics: updatedChars };
    });
  };

  // Add new characteristic point
  const handleAddCharacteristic = () => {
    if (!currentPlan) return;
    const newPointNo = currentPlan.characteristics.length + 1;
    const newChar: Characteristic = {
      id: `char-${Date.now()}`,
      pointNo: newPointNo,
      name: `Karakteristik #${newPointNo}`,
      nominal: 25.00,
      tolUpper: 0.05,
      tolLower: -0.05,
      usl: 25.05,
      lsl: 24.95,
      unit: 'mm',
      tool: 'Dijital Kumpas 0.01',
      sampleSize: '5 Adet',
      frequency: 'Saat başı',
      criticalClass: 'major',
      pin: { x: 50, y: 50 },
      description: 'Ölçüm detayı',
      type: 'numeric',
      options: ['Normal','Çizik','Hasarlı','Kirli'],
      rejectedOptions: ['Hasarlı'],
      evidencePolicy: 'none',
    };

    setCurrentPlan(prev => {
      if (!prev) return null;
      return {
        ...prev,
        characteristics: [...prev.characteristics, newChar],
      };
    });
    setActivePointNo(newPointNo);
  };

  // Update characteristic values
  const handleUpdateCharacteristic = (charId: string, updates: Partial<Characteristic>) => {
    if (!currentPlan) return;
    setCurrentPlan(prev => {
      if (!prev) return null;
      const updatedChars = prev.characteristics.map(c => {
        if (c.id === charId) {
          const merged = { ...c, ...updates };
          // Recalculate USL and LSL if nominal or tolerances change
          if (updates.nominal !== undefined || updates.tolUpper !== undefined || updates.tolLower !== undefined) {
            const nom = updates.nominal !== undefined ? updates.nominal : c.nominal;
            const up = updates.tolUpper !== undefined ? updates.tolUpper : c.tolUpper;
            const low = updates.tolLower !== undefined ? updates.tolLower : c.tolLower;
            merged.usl = Number((nom + up).toFixed(4));
            merged.lsl = Number((nom + (c.extraction ? low : -Math.abs(low))).toFixed(4));
          }
          return merged;
        }
        return c;
      });
      return { ...prev, characteristics: updatedChars };
    });
  };

  // Delete characteristic
  const handleDeleteCharacteristic = (charId: string) => {
    if (!currentPlan) return;
    const filtered = currentPlan.characteristics.filter(c => c.id !== charId);
    // Re-number pointNos
    const renumbered = filtered.map((c, idx) => ({ ...c, pointNo: idx + 1 }));
    setCurrentPlan(prev => {
      if (!prev) return null;
      return { ...prev, characteristics: renumbered };
    });
    setActivePointNo(1);
  };

  // Create new revision from current plan (e.g. v1.1 -> v1.2)
  const handleCreateNewRevision = async () => {
    if(saving||uploading)return;
    setSaving(true);
    try {
    if (!currentPlan || !currentProduct) return;
    const currentVer = currentPlan.version;
    const newVer = nextPlanVersion(controlPlans.filter(p=>p.productId===currentProduct.id).map(p=>p.version));

    const newRevision: ControlPlan = {
      ...JSON.parse(JSON.stringify(currentPlan)),
      id: `cp-${Date.now()}`,
      version: newVer,
      revisionDate: new Date().toISOString().slice(0, 10),
      revisionNote: `${currentVer} versiyonundan yeni revizyon türetildi.`,
      isActive: false,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await StorageService.saveControlPlan(newRevision,{expected:'missing'});
    requestedPlan.current=newRevision.id;
    onSavePlan(newRevision);
    setSelectedPlanId(newRevision.id);
    setCurrentPlan(newRevision);
    alert(`${newVer} revizyonu başarıyla taslak olarak oluşturuldu. Kontrol edip aktifleştirin.`);
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); } finally {setSaving(false);}
  };

  // Create completely new control plan for this product
  const handleCreateBlankPlan = async () => {
    if(saving||uploading)return;
    setSaving(true);
    try {
    if (!currentProduct) return;
    const newPlan: ControlPlan = {
      id: `cp-${Date.now()}`,
      productId: currentProduct.id,
      version: nextPlanVersion(controlPlans.filter(p=>p.productId===currentProduct.id).map(p=>p.version)),
      revisionDate: new Date().toISOString().slice(0, 10),
      revisionNote: 'İlk onaylı kontrol planı versiyonu.',
      isActive: false,
      status: 'draft',
      author: 'Kalite Sorumlusu',
      approvedBy: '',
      drawingImageUrl: currentProduct.defaultDrawingUrl || '',
      defaultSampleCount: 1,
      characteristics: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await StorageService.saveControlPlan(newPlan,{expected:'missing'});
    requestedPlan.current=newPlan.id;
    onSavePlan(newPlan);
    setSelectedPlanId(newPlan.id);
    setCurrentPlan(newPlan);
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); } finally {setSaving(false);}
  };

  // Save changes
  const handleSaveCurrentPlan = async () => {
    if(saving||uploading)return;
    setSaving(true);
    try {
    if (!currentPlan) return;
    const original=controlPlans.find(plan=>plan.id===currentPlan.id);
    const expected=original?revisionUsage?.id===currentPlan.id?revisionUsage.token:undefined:'missing';
    if(!expected)throw new Error('Planın güncel sürümü doğrulanamadı. Sayfayı yenileyin.');
    await StorageService.saveControlPlan(currentPlan,{expected});
    requestedPlan.current=currentPlan.id;
    setSelectedPlanId(currentPlan.id);
    onSavePlan(currentPlan);
    setRevisionUsage(null);
    try{const usage=await SaasApi.controlPlanRevisionUsage(currentPlan.id);setRevisionUsage({id:currentPlan.id,...usage});setUsageError('');}catch{setUsageError('Plan kaydedildi; güncel sürüm bilgisi alınamadı. Devam etmek için sayfayı yenileyin.');}
    setIsSavedBanner(true);
    setTimeout(() => setIsSavedBanner(false), 3000);
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); } finally {setSaving(false);}
  };

  // Handle custom drawing image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0];if(!file||!currentPlan)return;
    const planId=currentPlan.id;
    try {const asset=await SaasApi.uploadFile(file);setCurrentPlan(previous=>previous?.id===planId?{...previous,drawingImageUrl:'media:'+asset.id+'#'+asset.mimeType}:previous);}
    catch(error){alert(error instanceof Error?error.message:'Dosya yüklenemedi.');}
  };

  const toolOptions: MeasurementTool[] = [
    'Dijital Kumpas 0.01',
    'Mikrometre 0.001',
    'CMM 3D Ölçüm Cihazı',
    'Mihengir / Yükseklik Mastarı',
    'Profil Projeksiyon / Optik',
    'Yüzey Pürüzlülük (Surftest)',
    'Geçer / Geçmez Tampon Mastar',
    'Torkmetre',
    'Sertlik Ölçüm Cihazı (HRC/HB)',
    'Diğer Ölçüm Aleti',
  ];

  const unitOptions: MeasurementUnit[] = ['mm', 'inch', 'µm', '°', 'N', 'Ra', 'kg', 'bar', 'adet'];

  if (!detailOpen) {
    const term = searchTerm.trim().toLocaleLowerCase('tr-TR');
    const filteredProducts = products.filter(product => !term || [product.code, product.name, product.customer, product.category]
      .some(value => value.toLocaleLowerCase('tr-TR').includes(term)));

    const openPlan=(product:Product,plan?:ControlPlan)=>{requestedPlan.current=selectedProductId===product.id?null:plan?.id||null;if(selectedProductId===product.id&&plan)handleSelectPlan(plan.id);setSelectedProductId(product.id);setDetailOpen(true);};
    return <div className="space-y-5">
      <PageHeader title="Kontrol planları" description="Ürün revizyonları, ölçüm noktaları ve yayın durumları." summary={<><span><strong>{controlPlans.length}</strong> revizyon</span><span><strong>{controlPlans.filter(p=>p.isActive&&p.status==='active').length}</strong> aktif plan</span><span><strong>{products.length}</strong> ürün</span></>} actions={onOpenQrLabels&&<Button onClick={onOpenQrLabels}>QR etiketlerini yazdır</Button>}/>
      <TableToolbar><SearchInput value={searchTerm} onChange={event=>setSearchTerm(event.target.value)} placeholder="Ürün kodu, adı veya müşteri ara…" aria-label="Kontrol planı ara"/><span className="rq-helper m-0">{filteredProducts.length} ürün</span></TableToolbar>
      <DataTable className="rq-plan-list-table" label="Kontrol planları ve revizyonlar"><thead><tr><th>Ürün / parça</th><th>Müşteri</th><th>Revizyon</th><th>Durum</th><th>Aktif</th><th>Nokta</th><th>Revizyon tarihi</th><th>Hazırlayan</th><th>İşlem</th></tr></thead><tbody>
      {filteredProducts.flatMap(product=>{const plans=controlPlans.filter(plan=>plan.productId===product.id);return plans.length?plans.map(plan=><tr key={plan.id}><td><button type="button" className="rq-row-link" onClick={()=>openPlan(product,plan)}>{product.name}<small className="rq-technical">{product.code}</small></button></td><td>{product.customer||'—'}</td><td className="rq-technical">{plan.version}</td><td><StatusBadge status={plan.status}/></td><td>{plan.isActive&&plan.status==='active'?<Badge tone="success">Aktif</Badge>:<span className="rq-helper">—</span>}</td><td className="rq-technical">{plan.characteristics.length}</td><td className="rq-technical">{plan.revisionDate}</td><td>{plan.author}</td><td><Button onClick={()=>openPlan(product,plan)}>Aç <ChevronRight size={14}/></Button></td></tr>):[<tr key={product.id}><td><button type="button" className="rq-row-link" onClick={()=>openPlan(product)}>{product.name}<small className="rq-technical">{product.code}</small></button></td><td>{product.customer||'—'}</td><td>—</td><td><Badge>Plan yok</Badge></td><td>—</td><td>0</td><td>—</td><td>—</td><td><Button onClick={()=>openPlan(product)}>Plan hazırla</Button></td></tr>];})}
      </tbody></DataTable>
      {!filteredProducts.length&&<EmptyState title="Kontrol planı bulunamadı" description="Ürün aramasını değiştirin veya ilk ürününüzü oluşturun." label="Ürün oluştur" action={onCreateProduct}/>}
    </div>;
  }

  const storedPlan=controlPlans.find(plan=>plan.id===currentPlan?.id);
  const unsaved=!!currentPlan&&JSON.stringify(currentPlan)!==JSON.stringify(storedPlan);
  const publishPlan=async(inspect=false)=>{
    if(!currentPlan||!storedPlan||saving||uploading||revisionUsage?.id!==currentPlan.id)return;
    const active=controlPlans.find(plan=>plan.productId===currentPlan.productId&&plan.isActive);
    if(!confirm(`${currentPlan.version} yayınlanacak${active&&active.id!==currentPlan.id?`; ${active.version} artık aktif olmayacak`:''}. Devam edilsin mi?`))return;
    setSaving(true);
    try{
      const published={...currentPlan,isActive:true,status:'active' as const};
      await StorageService.saveControlPlan(published,{expected:revisionUsage.token,active:active?.id||'none'});
      requestedPlan.current=published.id;setCurrentPlan(published);onSavePlan(published);
      setRevisionUsage(null);
      if(inspect&&onInspect){onInspect(published.productId);return;}
      try{const usage=await SaasApi.controlPlanRevisionUsage(published.id);setRevisionUsage({id:published.id,...usage});setUsageError('');}catch{setUsageError('Plan yayınlandı; güncel sürüm bilgisi alınamadı. Devam etmek için sayfayı yenileyin.');}
    }catch(error){StorageService.reportSyncError(error);alert(error instanceof Error?error.message:'Plan yayınlanamadı.');}finally{setSaving(false);}
  };
  return <div className={`space-y-4${focusMode?' rq-plan-focus-view':''}`}>
    <PageHeader title={currentProduct?.name||'Kontrol planı'} description="Kontrol noktaları, teknik resimler ve revizyon yönetimi." breadcrumb={<Breadcrumb items={[{label:'Kontrol planları',onClick:()=>setDetailOpen(false)},{label:currentProduct?.code||'Ürün'}]}/>} summary={currentPlan&&<><span className="rq-technical">{currentProduct?.code} · {currentPlan.version}</span><StatusBadge status={currentPlan.status}/><Badge tone={unsaved?'warning':'neutral'}>{unsaved?'Kaydedilmemiş değişiklikler':'Kaydedildi'}</Badge><span>{currentPlan.characteristics.length} kontrol noktası</span></>} actions={<>
      {currentPlan?.isActive&&onInspect&&<Button onClick={()=>onInspect(currentPlan.productId)}>Ölçüme başla</Button>}
      <Button aria-pressed={focusMode} onClick={()=>setFocusMode(!focusMode)}>{focusMode?'Odak modundan çık':'Çizime odaklan'}</Button>
      {currentPlan&&!currentPlan.isActive&&<><Button disabled={saving||uploading||!currentPlan.characteristics.length||revisionUsage?.id!==currentPlan.id} onClick={()=>void publishPlan()}>Planı yayınla</Button>{onInspect&&<Button variant="primary" disabled={saving||uploading||!currentPlan.characteristics.length||revisionUsage?.id!==currentPlan.id} onClick={()=>void publishPlan(true)}>Yayınla ve ölçüme geç</Button>}</>}
      <details className="rq-plan-actions"><summary>Diğer işlemler ▾</summary><div><Button disabled={saving||uploading} onClick={handleCreateBlankPlan}><Plus size={14}/>Yeni plan</Button>
      <Button disabled={saving||!currentProduct} onClick={()=>setAnalysisOpen(true)}><Sparkles size={14}/>PDF’den plan oluştur</Button>
      {currentPlan&&<Button disabled={saving||uploading} onClick={handleCreateNewRevision}><Copy size={14}/>Yeni revizyon</Button>}</div></details>
      {currentPlan&&<Button id="btn-save-control-plan" variant="primary" loading={saving} disabled={uploading||(!revisionUsage&&!!storedPlan)} onClick={handleSaveCurrentPlan}><Save size={14}/>Değişiklikleri kaydet</Button>}
    </>}/>
    {analysisOpen&&currentProduct&&<Suspense fallback={<p role="status">PDF inceleme ekranı hazırlanıyor…</p>}><DrawingAnalysis key={currentProduct.id} product={currentProduct} onClose={()=>setAnalysisOpen(false)} onProductUpdated={onProductUpdated} onCreated={plan=>{requestedPlan.current=plan.id;onSavePlan(plan);setSelectedPlanId(plan.id);setCurrentPlan(plan);setAnalysisOpen(false);}}/></Suspense>}
    {currentPlan?.drawingAnalysis&&<details className="rq-card"><summary>PDF kaynak ve analiz bilgileri</summary><p>{currentPlan.drawingAnalysis.pageCount} sayfa · İncelenen sayfa: {currentPlan.drawingAnalysis.analyzedPage}</p><ul>{currentPlan.drawingAnalysis.notes.map((note,i)=><li key={i}>{note}</li>)}</ul><Button onClick={()=>void SaasApi.openEvidence(currentPlan.drawingAnalysis!.originalUrl.replace(/^media:/,'').split('#')[0])}>Kaynak PDF’yi aç</Button></details>}
    <details className="rq-card rq-plan-context"><summary>Ürün / revizyon seçimi ve plan durumu <span className="rq-technical">{currentPlan?.version} · {currentPlan?.revisionDate}</span></summary><div className="mt-4 grid gap-4 lg:grid-cols-2"><Field label="Parça / ürün"><Select value={selectedProductId} onChange={e=>setSelectedProductId(e.target.value)}>{products.map(product=><option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}</Select></Field><Field label="Kontrol planı revizyonu"><Select value={selectedPlanId} onChange={e=>handleSelectPlan(e.target.value)}>{productPlans.map(plan=><option key={plan.id} value={plan.id}>{plan.version} · {PLAN_STATUS_LABELS[plan.status]}</option>)}</Select></Field></div>
      {currentPlan&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><div className="rq-actions"><StatusBadge status={currentPlan.status}/>{currentPlan.status!=='archived'&&<Button disabled={saving||uploading} onClick={async()=>{if(!confirm('Bu plan arşivlenecek. Devam edilsin mi?'))return;setSaving(true);try{const stored=controlPlans.find(p=>p.id===currentPlan.id);if(!stored)return;const archived={...stored,status:'archived' as const,isActive:false};if(revisionUsage?.id!==stored.id)throw new Error('Plan s\u00fcr\u00fcm\u00fc do\u011frulanamad\u0131.');await StorageService.saveControlPlan(archived,{expected:revisionUsage.token});setRevisionUsage(null);setCurrentPlan(archived);onSavePlan(archived);const usage=await SaasApi.controlPlanRevisionUsage(archived.id);setRevisionUsage({id:archived.id,...usage});}catch(error){StorageService.reportSyncError(error);}finally{setSaving(false);}}}>Arşivle</Button>}</div><span className="rq-helper m-0">{currentPlan.author} · <span className="rq-technical">{currentPlan.revisionDate}</span></span></div>}
      {isSavedBanner&&<p role="status" className="mt-3 text-sm text-emerald-700">Kontrol planı ve ölçüm noktaları kaydedildi.</p>}
    </details>
    {!currentPlan&&currentProduct&&<EmptyState title="İlk kontrol planınızı hazırlayın" description="Bu ürün için toleransları ve ölçüm noktalarını tanımlayın." label="İlk kontrol planını oluştur" action={()=>void handleCreateBlankPlan()}/>}
    {usageError&&<p role="alert">{usageError}</p>}{revisionUsage?.used&&currentPlan?.id===revisionUsage.id&&<p role="status" className="rq-feedback rq-tone-info">Bu plan kullanılmış veya açık bir göreve bağlı. Düzenleme yeni taslak revizyon oluşturur; yayınlanana kadar mevcut plan aktif kalır.</p>}{currentPlan?.id.startsWith('draft-')&&unsaved&&<p role="status" className="rq-feedback rq-tone-info">Değişiklikler yeni taslak revizyonda hazırlanıyor. Önce kaydedin, ardından planı aktifleştirin.</p>}{currentPlan&&currentProduct&&<><fieldset disabled={saving||uploading||(!revisionUsage&&!!storedPlan)}><CharacteristicWorkspace onUploadingChange={setUploading} product={currentProduct} plan={currentPlan} onChange={updatePlan} onProductUpdated={onProductUpdated}/></fieldset>
      <details className="rq-card"><summary className="cursor-pointer rq-section-title">Revizyon bilgileri</summary><fieldset disabled={saving||uploading||(!revisionUsage&&!!storedPlan)}><div className="mt-5"><FormSection title="Revizyon ve kalite bilgileri"><Field label="Revizyon tarihi"><Input type="date" value={currentPlan.revisionDate} onChange={e=>updatePlan({...currentPlan,revisionDate:e.target.value})}/></Field><Field label="Çizim revizyonu" hint="Teknik resim üzerindeki revizyonu girin; bilinmiyorsa boş bırakın."><Input value={currentPlan.drawingRevision||''} onChange={e=>updatePlan({...currentPlan,drawingRevision:e.target.value})}/></Field><Field label="Hazırlayan"><Input value={currentPlan.author} onChange={e=>updatePlan({...currentPlan,author:e.target.value})}/></Field><Field label="Onaylayan"><Input value={currentPlan.approvedBy} onChange={e=>updatePlan({...currentPlan,approvedBy:e.target.value})}/></Field><Field label="Önerilen numune sayısı"><NumberInput min={1} max={100} value={currentPlan.defaultSampleCount||1} onChange={e=>updatePlan({...currentPlan,defaultSampleCount:Math.max(1,Number(e.target.value)||1)})}/></Field><Field label="Revizyon notu"><Textarea value={currentPlan.revisionNote} onChange={e=>updatePlan({...currentPlan,revisionNote:e.target.value})}/></Field></FormSection></div></fieldset></details>
    </>}
  </div>;
};
