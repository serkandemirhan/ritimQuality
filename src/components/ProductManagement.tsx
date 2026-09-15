import { EmptyState } from './EmptyState';
import { SaasApi } from '../services/api';
import { MediaImage } from './MediaImage';
import React, { useMemo, useState } from 'react';
import { Product, ControlPlan } from '../types';
import { StorageService } from '../services/storage';
import { SHAFT_BUSHING_SVG, FLANGE_BODY_SVG, CONNECTOR_HOUSING_SVG } from '../data/mockData';
import { 
  Package, 
  Plus, 
  Edit3, 
  Trash2, 
  Layers, 
  Play, 
  Sliders, 
  CheckCircle2, 
  Upload, 
  Building2, 
  Cpu,
  Search,
  ChevronRight,
  ArrowLeft,
  ImageIcon
} from 'lucide-react';

interface ProductManagementProps {
  products: Product[];
  controlPlans: ControlPlan[];
  onProductsChanged: () => void;
  onSelectProductForControlPlan: (productId: string) => void;
  onSelectProductForInspection: (productId: string) => void;
}

export const ProductManagement: React.FC<ProductManagementProps> = ({
  products,
  controlPlans,
  onProductsChanged,
  onSelectProductForControlPlan,
  onSelectProductForInspection,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [saving,setSaving]=useState(false);
  // Form State
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [customer, setCustomer] = useState<string>('');
  const [revision, setRevision] = useState<string>('A');
  const [material, setMaterial] = useState<string>('');
  const [category, setCategory] = useState<string>('Talaşlı İmalat (CNC)');
  const [description, setDescription] = useState<string>('');
  const [drawingUrl, setDrawingUrl] = useState<string>(SHAFT_BUSHING_SVG);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setCode(`PRD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`);
    setName('');
    setCustomer('');
    setRevision('A');
    setMaterial('16MnCr5 Çelik');
    setCategory('Talaşlı İmalat (CNC)');
    setDescription('');
    setDrawingUrl(SHAFT_BUSHING_SVG);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setCode(p.code);
    setName(p.name);
    setCustomer(p.customer);
    setRevision(p.revision || 'A');
    setMaterial(p.material);
    setCategory(p.category);
    setDescription(p.description);
    setDrawingUrl(p.defaultDrawingUrl);
    setIsAddModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if(saving)return;
    setSaving(true);
    try {
    if (!name || !code) return;

    const productData: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      code,
      name,
      customer: customer || 'Standart Müşteri',
      revision: revision || 'A',
      material: material || 'Genel Çelik / Alüminyum',
      category: category || 'İmalat',
      description: description || 'Kalite kontrollü üretim parçası.',
      defaultDrawingUrl: drawingUrl || '',
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await StorageService.saveProduct(productData);

    // If new product, automatically create initial v1.0 active control plan with a sample point
    if (!editingProduct) {
      const initialPlan: ControlPlan = {
        id: `cp-${Date.now()}`,
        productId: productData.id,
        version: 'v1.0',
        revisionDate: new Date().toISOString().slice(0, 10),
        revisionNote: 'İlk devreye alma kontrol planı.',
        isActive: false,
        status: 'draft',
        author: 'Kalite Sorumlusu',
        approvedBy: '',
        drawingImageUrl: productData.defaultDrawingUrl,
        defaultSampleCount: 5,
        characteristics: [
          {
            id: `char-${Date.now()}-1`,
            pointNo: 1,
            name: 'Ana Dış Çap / Boyut',
            nominal: 30.00,
            tolUpper: 0.05,
            tolLower: -0.05,
            usl: 30.05,
            lsl: 29.95,
            unit: 'mm',
            tool: 'Dijital Kumpas 0.01',
            sampleSize: '5 Adet',
            frequency: 'Saat başı',
            criticalClass: 'critical',
            type: 'numeric',
            evidencePolicy: 'none',
            pin: { x: 50, y: 50 },
            description: 'Kritik montaj boyutu'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await StorageService.saveControlPlan(initialPlan);
    }

    setIsAddModalOpen(false);
    onProductsChanged();
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); } finally {setSaving(false);}
  };

  const handleDrawingUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file=event.target.files?.[0]; if(!file) return;
    if(!file.type.startsWith('image/')&&file.type!=='application/pdf'){alert('Teknik resim için PDF veya görsel seçin.');return;}
    try { const asset=await SaasApi.uploadFile(file);setDrawingUrl('media:'+asset.id+'#'+asset.mimeType); } catch(error){alert(error instanceof Error?error.message:'Dosya yüklenemedi.');}
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
    if (confirm('Bu ürünü ve ilişkili kontrol planlarını silmek istediğinize emin misiniz?')) {
      await StorageService.deleteProduct(productId);
      if (selectedProductId === productId) setSelectedProductId(null);
      onProductsChanged();
    }
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); }
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('tr-TR');
    if (!term) return products;
    return products.filter(product => [product.code, product.name, product.customer, product.material, product.category]
      .some(value => value.toLocaleLowerCase('tr-TR').includes(term)));
  }, [products, searchTerm]);

  const selectedProduct = products.find(product => product.id === selectedProductId) || null;
  const selectedPlans = selectedProduct ? controlPlans.filter(plan => plan.productId === selectedProduct.id) : [];
  const selectedActivePlan = selectedPlans.find(plan => plan.isActive && plan.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </span>
            Ürün & Parça Kataloğu Yönetimi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            İmalatını yaptığınız parçaları tanımlayın, teknik resimlerini ve aktif kontrol planlarını yapılandırın.
          </p>
        </div>

        <button
          id="btn-add-new-product"
          type="button"
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Ürün Tanımla</span>
        </button>
      </div>

      {selectedProduct ? (
        <div className="space-y-4">
          <button type="button" onClick={() => setSelectedProductId(null)} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-700">
            <ArrowLeft className="h-4 w-4" /> Ürün Listesine Dön
          </button>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid lg:grid-cols-[minmax(320px,42%)_1fr]">
              <div className="flex min-h-72 items-center justify-center border-b border-slate-200 bg-slate-950 p-5 lg:border-b-0 lg:border-r">
                <MediaImage src={selectedProduct.defaultDrawingUrl || SHAFT_BUSHING_SVG} alt={selectedProduct.name} className="max-h-[360px] max-w-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <div className="p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-mono text-xs font-black text-blue-700">{selectedProduct.code}</span>
                    <h3 className="mt-3 text-2xl font-black text-slate-900">{selectedProduct.name}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{selectedProduct.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleOpenEdit(selectedProduct)} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 hover:text-blue-600" title="Düzenle"><Edit3 className="h-4 w-4" /></button>
                    <button type="button" onClick={() => handleDeleteProduct(selectedProduct.id)} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Sil"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-bold uppercase text-slate-400">Müşteri</dt><dd className="mt-1 text-sm font-bold text-slate-800">{selectedProduct.customer}</dd><div className="mt-1 text-[10px] font-mono text-blue-700">REV {selectedProduct.revision||'A'}</div></div>
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-bold uppercase text-slate-400">Malzeme</dt><dd className="mt-1 text-sm font-bold text-slate-800">{selectedProduct.material}</dd></div>
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-bold uppercase text-slate-400">Kategori</dt><dd className="mt-1 text-sm font-bold text-slate-800">{selectedProduct.category}</dd></div>
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-bold uppercase text-slate-400">Aktif Plan</dt><dd className="mt-1 text-sm font-bold text-slate-800">{selectedActivePlan?.version || 'Plan yok'} · {selectedActivePlan?.characteristics.length || 0} nokta</dd></div>
                </dl>
                <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                  <button type="button" onClick={() => onSelectProductForControlPlan(selectedProduct.id)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><Sliders className="h-4 w-4 text-blue-600" />Kontrol Planına Git</button>
                  <button type="button" onClick={() => onSelectProductForInspection(selectedProduct.id)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500"><Play className="h-4 w-4 fill-white" />Ölçüme Başla</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Kod, ürün, müşteri veya malzeme ara..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:bg-white" />
            </div>
            <span className="text-xs font-semibold text-slate-400">{filteredProducts.length} ürün</span>
          </div>
          <div className="max-h-[calc(100vh-310px)] min-h-64 overflow-y-auto">
            {filteredProducts.map(product => {
              const plans = controlPlans.filter(plan => plan.productId === product.id);
              const activePlan = plans.find(plan => plan.isActive && plan.status === 'active');
              return (
                <button key={product.id} type="button" onClick={() => setSelectedProductId(product.id)} className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50/50 sm:grid-cols-[52px_minmax(180px,1.4fr)_minmax(130px,1fr)_minmax(120px,.8fr)_100px_24px]">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-slate-900 sm:h-11 sm:w-11"><MediaImage src={product.defaultDrawingUrl || SHAFT_BUSHING_SVG} alt="" className="h-full w-full object-contain" /></div>
                  <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{product.name}</div><div className="mt-0.5 truncate font-mono text-[10px] font-bold text-blue-600">{product.code}</div></div>
                  <div className="hidden min-w-0 sm:block"><div className="truncate text-xs font-semibold text-slate-700">{product.customer}</div><div className="truncate text-[10px] text-slate-400">Müşteri / Proje</div></div>
                  <div className="hidden min-w-0 sm:block"><div className="truncate text-xs text-slate-600">{product.category}</div><div className="truncate text-[10px] text-slate-400">{product.material}</div></div>
                  <div className="text-right"><div className="text-xs font-black text-slate-700">{activePlan?.version || '—'}</div><div className="text-[10px] text-slate-400">{activePlan?.characteristics.length || 0} nokta</div></div>
                  <ChevronRight className="hidden h-4 w-4 text-slate-300 sm:block" />
                </button>
              );
            })}
            {filteredProducts.length === 0 && <EmptyState title={products.length?"Aramanızla eşleşen ürün yok":"İlk ürününüzü oluşturun"} description="Ürün kodu, teknik resim ve malzemeyle başlayın; ardından kontrol planını hazırlayın." action={handleOpenAdd} label="İlk ürününü oluştur"/>}
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingProduct ? 'Ürün Bilgilerini Düzenle' : 'Yeni Parça / Ürün Tanımla'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Parça Kodu *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Örn: PRD-2026-001"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Parça Adı *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: CNC Tahrik Şaftı"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ürün / Teknik Resim Revizyonu</label>
                <input type="text" required value={revision} onChange={e=>setRevision(e.target.value)} placeholder="Örn: C" className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Müşteri / Proje Adı</label>
                  <input
                    type="text"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="Örn: Bosch / Renault"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Malzeme Cinsi</label>
                  <input
                    type="text"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder="Örn: AISI 4140 / 16MnCr5"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">İmalat Kategorisi</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                >
                  <option value="Talaşlı İmalat (CNC Torna & Freze)">Talaşlı İmalat (CNC Torna & Freze)</option>
                  <option value="Taşlama & Honlama">Taşlama & Honlama</option>
                  <option value="Plastik Enjeksiyon & Kalıp">Plastik Enjeksiyon & Kalıp</option>
                  <option value="Sac Metal & Pres Baskı">Sac Metal & Pres Baskı</option>
                  <option value="Alüminyum Döküm">Alüminyum Döküm</option>
                  <option value="Montaj & Kauçuk Parçalar">Montaj & Kauçuk Parçalar</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Açıklama / Teknik Notlar</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kritik kalite kontrol veya montaj gereksinimleri..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium resize-none focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                />
              </div>

              {/* Template Blueprint selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Hazır Teknik Resim Şablonu</label>
                <div className="grid grid-cols-3 gap-2">
                  <div
                    onClick={() => setDrawingUrl(SHAFT_BUSHING_SVG)}
                    className={`p-2.5 rounded-xl border text-center cursor-pointer font-bold transition text-xs ${
                      drawingUrl === SHAFT_BUSHING_SVG ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Şaft / Burç Parçası
                  </div>
                  <div
                    onClick={() => setDrawingUrl(FLANGE_BODY_SVG)}
                    className={`p-2.5 rounded-xl border text-center cursor-pointer font-bold transition text-xs ${
                      drawingUrl === FLANGE_BODY_SVG ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Flanş Gövdesi
                  </div>
                  <div
                    onClick={() => setDrawingUrl(CONNECTOR_HOUSING_SVG)}
                    className={`p-2.5 rounded-xl border text-center cursor-pointer font-bold transition text-xs ${
                      drawingUrl === CONNECTOR_HOUSING_SVG ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Konnektör Gövdesi
                  </div>
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 py-2.5 font-bold text-blue-700 hover:bg-blue-100">
                <Upload className="h-4 w-4"/> PDF veya Teknik Resim Yükle
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleDrawingUpload}/>
              </label>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                >
                  İptal
                </button>
                <button
                  disabled={saving} type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-500/20 transition"
                >
                  {editingProduct ? 'Güncelle' : 'Ürünü Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
