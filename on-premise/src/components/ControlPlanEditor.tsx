import React, { useState, useEffect } from 'react';
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
  products: Product[];
  controlPlans: ControlPlan[];
  onSavePlan: (updatedPlan: ControlPlan) => void;
  onSetActiveVersion: (planId: string) => void;
  onDeletePlan: (planId: string) => void;
}

export const ControlPlanEditor: React.FC<ControlPlanEditorProps> = ({
  products,
  controlPlans,
  onSavePlan,
  onSetActiveVersion,
  onDeletePlan,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  
  // Active Plan Form State
  const [currentPlan, setCurrentPlan] = useState<ControlPlan | null>(null);
  const [activePointNo, setActivePointNo] = useState<number | null>(1);
  const [isSavedBanner, setIsSavedBanner] = useState<boolean>(false);
  const [detailOpen, setDetailOpen] = useState(false);
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
    const active = plans.find(cp => cp.isActive) || plans[0];
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
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); }
  };

  // Create completely new control plan for this product
  const handleCreateBlankPlan = async () => {
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
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); }
  };

  // Save changes
  const handleSaveCurrentPlan = async () => {
    try {
    if (!currentPlan) return;
    await StorageService.saveControlPlan(currentPlan);
    onSavePlan(currentPlan);
    setIsSavedBanner(true);
    setTimeout(() => setIsSavedBanner(false), 3000);
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); }
  };

  // Handle custom drawing image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentPlan) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCurrentPlan(prev => (prev ? { ...prev, drawingImageUrl: result } : null));
      }
    };
    reader.readAsDataURL(file);
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

    return (
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600"><Sliders className="h-5 w-5" /></span>
              Kontrol Planları
            </h2>
            <p className="mt-1 text-xs text-slate-500">Bir ürün seçerek kontrol planı detayına, revizyonlara ve ölçüm noktalarına ulaşın.</p>
          </div>
          <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">{products.length} ürün · {controlPlans.length} plan</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Ürün kodu, adı veya müşteri ara..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:bg-white" />
            </div>
            <span className="text-xs font-semibold text-slate-400">{filteredProducts.length} kayıt</span>
          </div>

          <div className="max-h-[calc(100vh-310px)] min-h-64 overflow-y-auto">
            {filteredProducts.map(product => {
              const plans = controlPlans.filter(plan => plan.productId === product.id);
              const activePlan = plans.find(plan => plan.isActive && plan.status === 'active');
              const totalPoints = activePlan?.characteristics.length || 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => { setSelectedProductId(product.id); setDetailOpen(true); }}
                  className="grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-0 hover:bg-blue-50/50 sm:grid-cols-[42px_minmax(200px,1.5fr)_minmax(130px,1fr)_100px_100px_24px]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><FileText className="h-4 w-4" /></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-900">{product.name}</span><span className="mt-0.5 block truncate font-mono text-[10px] font-bold text-blue-600">{product.code}</span></span>
                  <span className="hidden min-w-0 sm:block"><span className="block truncate text-xs font-semibold text-slate-600">{product.customer}</span><span className="block truncate text-[10px] text-slate-400">{product.category}</span></span>
                  <span className="text-right"><span className={`block text-xs font-black ${activePlan ? 'text-emerald-700' : 'text-slate-400'}`}>{activePlan?.version || 'Plan yok'}</span><span className="block text-[10px] text-slate-400">Aktif revizyon</span></span>
                  <span className="hidden text-right sm:block"><span className="block text-xs font-black text-slate-700">{totalPoints}</span><span className="block text-[10px] text-slate-400">Ölçüm noktası</span></span>
                  <ChevronRight className="hidden h-4 w-4 text-slate-300 sm:block" />
                </button>
              );
            })}
            {filteredProducts.length === 0 && <div className="flex min-h-64 flex-col items-center justify-center text-slate-400"><FileText className="mb-2 h-8 w-8"/><span className="text-sm font-bold">Kontrol planı kaydı bulunamadı</span></div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {currentPlan && <label className="flex items-center gap-3 rounded-xl border bg-white p-4"><input type="checkbox" checked={Boolean(currentPlan.requiresApproval)} onChange={event=>setCurrentPlan({...currentPlan,requiresApproval:event.target.checked})}/>Bu planla tamamlanan kontroller kalite onayı gerektirsin</label>}
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <button type="button" onClick={() => setDetailOpen(false)} className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-700">
              <ArrowLeft className="h-4 w-4" /> Kontrol Planı Listesine Dön
            </button>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shadow-xs">
                <Sliders className="w-5 h-5" />
              </span>
              Kontrol Planları & Görsel Nokta Tanımlama Studio
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Ürünlere ait kontrol planı revizyonlarını yönetin, teknik resim üzerine ölçüm noktalarını sürükleyip bırakın.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCreateBlankPlan}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>Yeni Kontrol Planı Ekle</span>
            </button>

            {currentPlan && (
              <button
                type="button"
                onClick={handleCreateNewRevision}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 shadow-xs transition"
              >
                <Copy className="w-3.5 h-3.5 text-blue-600" />
                <span>Bu Plandan Yeni Revizyon Türet</span>
              </button>
            )}

            {currentPlan && (
              <button
                id="btn-save-control-plan"
                type="button"
                onClick={handleSaveCurrentPlan}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Değişiklikleri Kaydet</span>
              </button>
            )}
          </div>
        </div>

        {/* Product & Version Selector Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              1. Parça / Ürün Seçimi
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              2. Kontrol Planı Revizyonu & Versiyonu
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {productPlans.map(cp => {
                const isSelected = selectedPlanId === cp.id;
                return (
                  <div
                    key={cp.id}
                    onClick={() => handleSelectPlan(cp.id)}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center gap-2 ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 text-blue-800 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cp.version}</span>
                    {cp.isActive ? (
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] border border-emerald-200 font-bold">
                        AKTİF
                      </span>
                    ) : (
                      <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                        {cp.status}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active Version Control Bar */}
        {currentPlan && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-medium">Durum:</span>
              {currentPlan.isActive ? (
                <span className="flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Operatörler İçin Varsayılan Aktif Kontrol Planı
                </span>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    try { const active={...currentPlan,isActive:true,status:'active' as const};await StorageService.saveControlPlan(active);setCurrentPlan(active);onSavePlan(active); }
                    catch(error){alert(error instanceof Error?error.message:'Plan aktifleştirilemedi.');}
                  }}                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold transition shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bu Versiyonu Aktif Varsayılan Olarak Belirle</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 text-slate-500 font-medium">
              <span>Revizyon Tarihi: <strong className="text-slate-800">{currentPlan.revisionDate}</strong></span>
              <span>Hazırlayan: <strong className="text-slate-800">{currentPlan.author}</strong></span>
            </div>
          </div>
        )}

        {isSavedBanner && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Kontrol planı ve ölçüm noktası koordinatları başarıyla kaydedildi!</span>
          </div>
        )}
      </div>

      {currentPlan && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Left: Interactive Blueprint with Pin Placement (6 cols) */}
          <div className="xl:col-span-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Görsel Teknik Resim & Pin Konumları</span>
                <span className="text-[11px] font-medium text-slate-500">(Etiketleri sürükleyerek konumlandırın)</span>
              </h3>

              {/* Upload custom blueprint drawing */}
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200 transition shadow-xs">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Teknik Resim Görseli Yükle</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            <DrawingCanvas
              imageUrl={currentPlan.drawingImageUrl || currentProduct?.defaultDrawingUrl || SHAFT_BUSHING_SVG}
              characteristics={currentPlan.characteristics}
              activePointNo={activePointNo}
              onPointSelect={(pNo) => setActivePointNo(pNo)}
              onPinMove={handlePinMove}
              isEditable={true}
              defaultFilterMode="all"
              className="min-h-[460px] flex-1"
            />

            {/* Revision Note Box */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs shadow-sm">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Revizyon Notları & Onay Bilgileri
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Revizyon Tarihi</label>
                  <input
                    type="date"
                    value={currentPlan.revisionDate}
                    onChange={(e) => setCurrentPlan({ ...currentPlan, revisionDate: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Hazırlayan / Kalite</label>
                  <input
                    type="text"
                    value={currentPlan.author}
                    onChange={(e) => setCurrentPlan({ ...currentPlan, author: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Onaylayan / Direktör</label>
                  <input
                    type="text"
                    value={currentPlan.approvedBy}
                    onChange={(e) => setCurrentPlan({ ...currentPlan, approvedBy: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Varsayılan Numune</label>
                  <input type="number" min={1} max={100} value={currentPlan.defaultSampleCount || 5} onChange={e=>setCurrentPlan({...currentPlan,defaultSampleCount:Math.max(1,Number(e.target.value)||1)})} className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"/>
                </div>
              </div>
              <div>
                <label className="text-slate-600 font-bold block mb-1">Revizyon Nedeni / Değişiklik Özeti</label>
                <textarea
                  rows={2}
                  value={currentPlan.revisionNote}
                  onChange={(e) => setCurrentPlan({ ...currentPlan, revisionNote: e.target.value })}
                  placeholder="Müşteri talebi, takım değişimi veya tolerans güncelleme notları..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Right: Characteristic Editor Matrix (6 cols) */}
          <div className="xl:col-span-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Ölçüm Karakteristikleri & Tolerans Listesi</span>
                <span className="bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded-full text-xs border border-blue-200">
                  {currentPlan.characteristics.length} Nokta
                </span>
              </h3>

              <button
                id="btn-add-characteristic"
                type="button"
                onClick={handleAddCharacteristic}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Karakteristik Ekle</span>
              </button>
            </div>

            {/* Characteristics Scrollable List */}
            <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
              {currentPlan.characteristics.map((char) => {
                const isActive = activePointNo === char.pointNo;

                return (
                  <div
                    key={char.id}
                    onClick={() => setActivePointNo(char.pointNo)}
                    className={`bg-white border rounded-2xl p-4 transition-all shadow-sm ${
                      isActive
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Header line */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
                      <div className="flex items-center gap-2.5 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          {char.pointNo}
                        </div>
                        <input
                          type="text"
                          value={char.name}
                          onChange={(e) => handleUpdateCharacteristic(char.id, { name: e.target.value })}
                          placeholder="Karakteristik Adı (Örn: Dış Çap)"
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 flex-1 focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Critical class dropdown */}
                        <select
                          value={char.criticalClass}
                          onChange={(e) => handleUpdateCharacteristic(char.id, { criticalClass: e.target.value as CriticalClass })}
                          className={`text-xs font-bold px-2.5 py-1 rounded-xl border focus:outline-none ${
                            char.criticalClass === 'critical'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : char.criticalClass === 'major'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="critical">⭐ Kritik</option>
                          <option value="major">🔷 Önemli</option>
                          <option value="minor">Standart</option>
                        </select>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`"${char.name}" noktasını silmek istediğinize emin misiniz?`)) {
                              handleDeleteCharacteristic(char.id);
                            }
                          }}
                          className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title="Karakteristiği Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 mb-3 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">Kontrol Tipi</label>
                        <select value={char.type || 'numeric'} onChange={e=>handleUpdateCharacteristic(char.id,{type:e.target.value as CharacteristicType})} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-semibold">
                          <option value="numeric">Sayısal</option><option value="ok_nok">OK / NOK</option><option value="single_select">Tekli Seçim</option><option value="multi_select">Çoklu Seçim</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">Kanıt Politikası</label>
                        <select value={char.evidencePolicy || 'none'} onChange={e=>handleUpdateCharacteristic(char.id,{evidencePolicy:e.target.value as EvidencePolicy})} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-semibold">
                          <option value="none">Medya yok</option><option value="optional">Opsiyonel</option><option value="required_on_fail">NOK olduğunda zorunlu</option><option value="always_required">Her kontrolde zorunlu</option>
                        </select>
                      </div>
                      {(char.type==='single_select'||char.type==='multi_select')&&<>
                        <div><label className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">Seçenekler</label><input value={(char.options||[]).join(', ')} onChange={e=>handleUpdateCharacteristic(char.id,{options:e.target.value.split(',').map(v=>v.trim()).filter(Boolean)})} placeholder="Normal, Çizik, Hasarlı" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5"/></div>
                        <div><label className="text-[10px] text-rose-500 block uppercase font-bold tracking-wider mb-1">NOK Yapan Seçenekler</label><input value={(char.rejectedOptions||[]).join(', ')} onChange={e=>handleUpdateCharacteristic(char.id,{rejectedOptions:e.target.value.split(',').map(v=>v.trim()).filter(Boolean)})} placeholder="Çatlak, Çapak" className="w-full rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5"/></div>
                      </>}
                    </div>

                    {/* Numeric Dimension Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">Nominal</label>
                        <input
                          type="number"
                          step="0.001"
                          value={char.nominal}
                          onChange={(e) => handleUpdateCharacteristic(char.id, { nominal: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-blue-700 text-xs focus:bg-white focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">Üst Tol (+) </label>
                        <input
                          type="number"
                          step="0.001"
                          value={char.tolUpper}
                          onChange={(e) => handleUpdateCharacteristic(char.id, { tolUpper: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-semibold text-emerald-700 text-xs focus:bg-white focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">Alt Tol (-) </label>
                        <input
                          type="number"
                          step="0.001"
                          value={char.tolLower}
                          onChange={(e) => handleUpdateCharacteristic(char.id, { tolLower: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-semibold text-rose-700 text-xs focus:bg-white focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-1">Birim</label>
                        <select
                          value={char.unit}
                          onChange={(e) => handleUpdateCharacteristic(char.id, { unit: e.target.value as MeasurementUnit })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs font-semibold focus:bg-white focus:border-blue-500"
                        >
                          {unitOptions.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* USL / LSL Calculated preview */}
                    <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-600 mb-3">
                      <span>Alt Sınır (LSL): <strong className="text-rose-600 font-bold">{char.lsl} {char.unit}</strong></span>
                      <span>Üst Sınır (USL): <strong className="text-emerald-600 font-bold">{char.usl} {char.unit}</strong></span>
                      <span>Aralık: <strong className="text-slate-800 font-bold">{(char.usl - char.lsl).toFixed(3)} {char.unit}</strong></span>
                    </div>

                    {/* Metrology & Frequency Line */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-500 block font-bold mb-1">Ölçüm Aleti / Cihaz</label>
                        <select
                          value={char.tool}
                          onChange={(e) => handleUpdateCharacteristic(char.id, { tool: e.target.value as MeasurementTool })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs font-medium focus:bg-white focus:border-blue-500"
                        >
                          {toolOptions.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block font-bold mb-1">Örneklem (Adet)</label>
                        <input
                          type="text"
                          value={char.sampleSize}
                          onChange={(e) => handleUpdateCharacteristic(char.id, { sampleSize: e.target.value })}
                          placeholder="Örn: 5 Adet"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs font-medium focus:bg-white focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block font-bold mb-1">Kontrol Sıklığı</label>
                        <input
                          type="text"
                          value={char.frequency}
                          onChange={(e) => handleUpdateCharacteristic(char.id, { frequency: e.target.value })}
                          placeholder="Örn: Saat başı"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-800 text-xs font-medium focus:bg-white focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
