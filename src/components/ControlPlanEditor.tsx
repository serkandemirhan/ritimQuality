import { PageHeader, Button, DataTable, SearchInput, TableToolbar, StatusBadge, Badge, Breadcrumb, Card, Select, Input, NumberInput, Textarea, Field, FormSection } from './ui';
import {PLAN_STATUS_LABELS} from '../services/terms';
import {CharacteristicWorkspace} from './CharacteristicWorkspace';
import { EmptyState } from './EmptyState';
import { SaasApi } from '../services/api';
import React, { useState, useEffect, useRef } from 'react';
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
}

export const ControlPlanEditor: React.FC<ControlPlanEditorProps> = ({
  initialProductId, onCreateProduct, onInspect,
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
  // Active Plan Form State
  const [currentPlan, setCurrentPlan] = useState<ControlPlan | null>(null);
  const [activePointNo, setActivePointNo] = useState<number | null>(1);
  const [isSavedBanner, setIsSavedBanner] = useState<boolean>(false);
  const [detailOpen, setDetailOpen] = useState(Boolean(initialProductId));
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (selectedProductId && !products.some(product => product.id === selectedProductId)) {
      setSelectedProductId('');
      setDetailOpen(false);
    }
  }, [products, selectedProductId]);

  // When selected product changes, select its active or first plan
  useEffect(() => {
    const plans = controlPlans.filter(cp => cp.productId === selectedProductId);
    const active = plans.find(cp=>cp.id===requestedPlan.current) || plans.find(cp => cp.isActive) || plans[0];
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
            merged.lsl = Number((nom - Math.abs(low)).toFixed(4));
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
    if(saving)return;
    setSaving(true);
    try {
    if (!currentPlan || !currentProduct) return;
    const currentVer = currentPlan.version;
    const verNum = parseFloat(currentVer.replace('v', '')) || 1.0;
    const newVer = `v${(verNum + 0.1).toFixed(1)}`;

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

    await StorageService.saveControlPlan(newRevision);
    onSavePlan(newRevision);
    setSelectedPlanId(newRevision.id);
    setCurrentPlan(newRevision);
    alert(`${newVer} revizyonu başarıyla taslak olarak oluşturuldu. Kontrol edip aktifleştirin.`);
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); } finally {setSaving(false);}
  };

  // Create completely new control plan for this product
  const handleCreateBlankPlan = async () => {
    if(saving)return;
    setSaving(true);
    try {
    if (!currentProduct) return;
    const newPlan: ControlPlan = {
      id: `cp-${Date.now()}`,
      productId: currentProduct.id,
      version: 'v1.0',
      revisionDate: new Date().toISOString().slice(0, 10),
      revisionNote: 'İlk onaylı kontrol planı versiyonu.',
      isActive: false,
      status: 'draft',
      author: 'Kalite Sorumlusu',
      approvedBy: '',
      drawingImageUrl: currentProduct.defaultDrawingUrl || SHAFT_BUSHING_SVG,
      defaultSampleCount: 5,
      characteristics: [
        {
          id: `char-${Date.now()}-1`,
          pointNo: 1,
          name: 'Ana Boyut (Kritik Çap/Boy)',
          nominal: 50.00,
          tolUpper: 0.05,
          tolLower: -0.05,
          usl: 50.05,
          lsl: 49.95,
          unit: 'mm',
          tool: 'Dijital Kumpas 0.01',
          sampleSize: '5 Adet',
          frequency: 'Saat başı',
          criticalClass: 'critical',
          pin: { x: 50, y: 50 },
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await StorageService.saveControlPlan(newPlan);
    onSavePlan(newPlan);
    setSelectedPlanId(newPlan.id);
    setCurrentPlan(newPlan);
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); } finally {setSaving(false);}
  };

  // Save changes
  const handleSaveCurrentPlan = async () => {
    if(saving)return;
    setSaving(true);
    try {
    if (!currentPlan) return;
    await StorageService.saveControlPlan(currentPlan);
    onSavePlan(currentPlan);
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

  const unitOptions: MeasurementUnit[] = ['mm', 'µm', '°', 'N', 'Ra', 'kg', 'bar', 'adet'];

  if (!detailOpen) {
    const term = searchTerm.trim().toLocaleLowerCase('tr-TR');
    const filteredProducts = products.filter(product => !term || [product.code, product.name, product.customer, product.category]
      .some(value => value.toLocaleLowerCase('tr-TR').includes(term)));

    const openPlan=(product:Product,plan?:ControlPlan)=>{requestedPlan.current=selectedProductId===product.id?null:plan?.id||null;if(selectedProductId===product.id&&plan)handleSelectPlan(plan.id);setSelectedProductId(product.id);setDetailOpen(true);};
    return <div className="space-y-5">
      <PageHeader title="Kontrol planları" description="Ürün revizyonları, ölçüm noktaları ve yayın durumları." summary={<><span><strong>{controlPlans.length}</strong> revizyon</span><span><strong>{controlPlans.filter(p=>p.isActive&&p.status==='active').length}</strong> aktif plan</span><span><strong>{products.length}</strong> ürün</span></>}/>
      <TableToolbar><SearchInput value={searchTerm} onChange={event=>setSearchTerm(event.target.value)} placeholder="Ürün kodu, adı veya müşteri ara…" aria-label="Kontrol planı ara"/><span className="rq-helper m-0">{filteredProducts.length} ürün</span></TableToolbar>
      <DataTable label="Kontrol planları ve revizyonlar"><thead><tr><th>Ürün / parça</th><th>Revizyon</th><th>Durum</th><th>Nokta</th><th>Revizyon tarihi</th><th>Hazırlayan</th><th>İşlem</th></tr></thead><tbody>
      {filteredProducts.flatMap(product=>{const plans=controlPlans.filter(plan=>plan.productId===product.id);return plans.length?plans.map(plan=><tr key={plan.id}><td><button type="button" className="rq-row-link" onClick={()=>openPlan(product,plan)}>{product.name}<small className="rq-technical">{product.code}</small></button></td><td className="rq-technical">{plan.version}</td><td><StatusBadge status={plan.status}/></td><td className="rq-technical">{plan.characteristics.length}</td><td className="rq-technical">{plan.revisionDate}</td><td>{plan.author}</td><td><Button onClick={()=>openPlan(product,plan)}>Aç <ChevronRight size={14}/></Button></td></tr>):[<tr key={product.id}><td><button type="button" className="rq-row-link" onClick={()=>openPlan(product)}>{product.name}<small className="rq-technical">{product.code}</small></button></td><td>—</td><td><Badge>Plan yok</Badge></td><td>0</td><td>—</td><td>—</td><td><Button onClick={()=>openPlan(product)}>Plan hazırla</Button></td></tr>];})}
      </tbody></DataTable>
      {!filteredProducts.length&&<EmptyState title="Kontrol planı bulunamadı" description="Ürün aramasını değiştirin veya ilk ürününüzü oluşturun." label="Ürün oluştur" action={onCreateProduct}/>}
    </div>;
  }

  const storedPlan=controlPlans.find(plan=>plan.id===currentPlan?.id);
  const unsaved=!!currentPlan&&JSON.stringify(currentPlan)!==JSON.stringify(storedPlan);
  return <div className="space-y-4">
    <PageHeader title={currentProduct?.name||'Kontrol planı'} description="Kontrol noktaları, teknik resimler ve revizyon yönetimi." breadcrumb={<Breadcrumb items={[{label:'Kontrol planları',onClick:()=>setDetailOpen(false)},{label:currentProduct?.code||'Ürün'}]}/>} summary={currentPlan&&<><span className="rq-technical">{currentProduct?.code} · {currentPlan.version}</span><StatusBadge status={currentPlan.status}/><Badge tone={unsaved?'warning':'neutral'}>{unsaved?'Kaydedilmemiş değişiklikler':'Kaydedildi'}</Badge><span>{currentPlan.characteristics.length} kontrol noktası</span></>} actions={<>
      {currentPlan?.isActive&&onInspect&&<Button onClick={()=>onInspect(currentPlan.productId)}>Ölçüme başla</Button>}
      <Button disabled={saving} onClick={handleCreateBlankPlan}><Plus size={14}/>Yeni plan</Button>
      {currentPlan&&<><Button disabled={saving} onClick={handleCreateNewRevision}><Copy size={14}/>Yeni revizyon</Button><Button id="btn-save-control-plan" variant="primary" loading={saving} onClick={handleSaveCurrentPlan}><Save size={14}/>Değişiklikleri kaydet</Button></>}
    </>}/>
    <details className="rq-card rq-plan-context"><summary>Ürün / revizyon seçimi ve plan durumu <span className="rq-technical">{currentPlan?.version} · {currentPlan?.revisionDate}</span></summary><div className="mt-4 grid gap-4 lg:grid-cols-2"><Field label="Parça / ürün"><Select value={selectedProductId} onChange={e=>setSelectedProductId(e.target.value)}>{products.map(product=><option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}</Select></Field><Field label="Kontrol planı revizyonu"><Select value={selectedPlanId} onChange={e=>handleSelectPlan(e.target.value)}>{productPlans.map(plan=><option key={plan.id} value={plan.id}>{plan.version} · {PLAN_STATUS_LABELS[plan.status]}</option>)}</Select></Field></div>
      {currentPlan&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><div className="rq-actions"><StatusBadge status={currentPlan.status}/>{!currentPlan.isActive&&<Button disabled={saving} onClick={async()=>{try{const active={...currentPlan,isActive:true,status:'active' as const};await StorageService.saveControlPlan(active);setCurrentPlan(active);onSavePlan(active);}catch(error){alert(error instanceof Error?error.message:'Plan aktifleştirilemedi.');}}}>Aktif varsayılan yap</Button>}{currentPlan.status!=='archived'&&<Button disabled={saving} onClick={async()=>{if(!confirm('Bu plan arşivlenecek. Devam edilsin mi?'))return;setSaving(true);try{const stored=controlPlans.find(p=>p.id===currentPlan.id);if(!stored)return;const archived={...stored,status:'archived' as const,isActive:false};await StorageService.saveControlPlan(archived);setCurrentPlan(archived);onSavePlan(archived);}catch(error){StorageService.reportSyncError(error);}finally{setSaving(false);}}}>Arşivle</Button>}</div><span className="rq-helper m-0">{currentPlan.author} · <span className="rq-technical">{currentPlan.revisionDate}</span></span></div>}
      {isSavedBanner&&<p role="status" className="mt-3 text-sm text-emerald-700">Kontrol planı ve ölçüm noktaları kaydedildi.</p>}
    </details>
    {!currentPlan&&currentProduct&&<EmptyState title="İlk kontrol planınızı hazırlayın" description="Bu ürün için toleransları ve ölçüm noktalarını tanımlayın." label="İlk kontrol planını oluştur" action={()=>void handleCreateBlankPlan()}/>}
    {currentPlan&&currentProduct&&<><CharacteristicWorkspace product={currentProduct} plan={currentPlan} onChange={setCurrentPlan} onProductUpdated={onProductUpdated}/>
      <details className="rq-card"><summary className="cursor-pointer rq-section-title">Revizyon bilgileri</summary><div className="mt-5"><FormSection title="Revizyon ve kalite bilgileri"><Field label="Revizyon tarihi"><Input type="date" value={currentPlan.revisionDate} onChange={e=>setCurrentPlan({...currentPlan,revisionDate:e.target.value})}/></Field><Field label="Hazırlayan"><Input value={currentPlan.author} onChange={e=>setCurrentPlan({...currentPlan,author:e.target.value})}/></Field><Field label="Onaylayan"><Input value={currentPlan.approvedBy} onChange={e=>setCurrentPlan({...currentPlan,approvedBy:e.target.value})}/></Field><Field label="Varsayılan numune"><NumberInput min={1} max={100} value={currentPlan.defaultSampleCount||5} onChange={e=>setCurrentPlan({...currentPlan,defaultSampleCount:Math.max(1,Number(e.target.value)||1)})}/></Field><Field label="Revizyon notu"><Textarea value={currentPlan.revisionNote} onChange={e=>setCurrentPlan({...currentPlan,revisionNote:e.target.value})}/></Field></FormSection></div></details>
    </>}
  </div>;
};
