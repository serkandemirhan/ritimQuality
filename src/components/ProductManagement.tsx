import { PageHeader, Button, Card, DataTable, SearchInput, TableToolbar, StatusBadge, Badge, Tabs, IconButton, Breadcrumb, Modal, FormSection, Field, Input, Select, Textarea, PageActions } from './ui';
import { EmptyState } from './EmptyState';
import { SaasApi } from '../services/api';
import { MediaImage } from './MediaImage';
import React, { useMemo, useState, useEffect } from 'react';
import { Product, ControlPlan, InspectionLog } from '../types';
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
  inspectionLogs?: InspectionLog[];
  onOpenInspection?: (log:InspectionLog) => void;
  products: Product[];
  controlPlans: ControlPlan[];
  onProductsChanged: () => void;
  onSelectProductForControlPlan: (productId: string) => void;
  onSelectProductForInspection: (productId: string) => void;
}

export const ProductManagement: React.FC<ProductManagementProps> = ({
  products, inspectionLogs=[], onOpenInspection,
  controlPlans,
  onProductsChanged,
  onSelectProductForControlPlan,
  onSelectProductForInspection,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailTab,setDetailTab] = useState('overview');
  useEffect(()=>setDetailTab('overview'),[selectedProductId]);

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
  const productLogs=inspectionLogs.filter(log=>log.productId===selectedProductId).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
  const selectedActivePlan = selectedPlans.find(plan => plan.isActive && plan.status === 'active');

  return (
    <div className="space-y-6">
      {!selectedProduct&&<PageHeader title="Ürün kütüphanesi" description="Parça kimlikleri, teknik resimler ve kontrol planları." actions={<Button id="btn-add-new-product" variant="primary" onClick={handleOpenAdd}><Plus size={16}/>Yeni Ürün Tanımla</Button>} summary={<><span><strong>{products.length}</strong> ürün</span><span><strong>{products.filter(p=>controlPlans.some(cp=>cp.productId===p.id&&cp.isActive&&cp.status==='active')).length}</strong> aktif planlı ürün</span></>}/>}

      {selectedProduct ? (
        <div className="space-y-5">
          <PageHeader title={selectedProduct.name} description={selectedProduct.description} breadcrumb={<Breadcrumb items={[{label:'Ürün kütüphanesi',onClick:()=>setSelectedProductId(null)},{label:selectedProduct.code}]}/>} summary={<><span className="rq-technical">{selectedProduct.code}</span><span>Revizyon <strong>{selectedProduct.revision||'A'}</strong></span><span>{selectedProduct.material}</span><span>Kontrol planı: {selectedActivePlan?<StatusBadge status="active"/>:<Badge>Aktif plan yok</Badge>}</span></>} actions={<><IconButton label="Düzenle" onClick={()=>handleOpenEdit(selectedProduct)}><Edit3 size={16}/></IconButton><IconButton label="Sil" variant="danger" onClick={()=>handleDeleteProduct(selectedProduct.id)}><Trash2 size={16}/></IconButton><Button onClick={()=>onSelectProductForControlPlan(selectedProduct.id)}><Sliders size={15}/>Kontrol Planına Git</Button><Button variant="primary" onClick={()=>onSelectProductForInspection(selectedProduct.id)}><Play size={15}/>Ölçüme Başla</Button></>}/>
          <Tabs label="Ürün bölümleri" value={detailTab} onChange={setDetailTab} items={[{id:'overview',label:'Genel bilgiler'},{id:'drawings',label:'Teknik resim'},...(selectedPlans.length?[{id:'plans',label:'Kontrol planları'}]:[]),...(productLogs.length?[{id:'inspections',label:'Kontrol geçmişi'}]:[])]}/>
          {detailTab==='overview'&&<div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
            <Card className="flex min-h-80 items-center justify-center bg-slate-950"><MediaImage src={selectedProduct.defaultDrawingUrl||SHAFT_BUSHING_SVG} alt={selectedProduct.name} className="max-h-[500px] w-full object-contain"/></Card>
            <Card><h2 className="rq-section-title">Ürün kimliği</h2><dl className="rq-properties">{[['Ürün kodu',selectedProduct.code],['Müşteri / proje',selectedProduct.customer],['Malzeme',selectedProduct.material],['Kategori',selectedProduct.category],['Revizyon',selectedProduct.revision||'A'],['Aktif plan',selectedActivePlan?.version||'Plan yok'],['Ölçüm noktası',selectedActivePlan?.characteristics.length||0]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{productLogs[0]&&<div className="mt-5 border-t border-slate-100 pt-4"><h3 className="rq-helper">Son kontrol</h3><StatusBadge status={productLogs[0].overallStatus}/><p className="rq-helper rq-technical">{new Date(productLogs[0].timestamp).toLocaleString('tr-TR')}</p></div>}</Card>
          </div>}
          {detailTab==='drawings'&&<Card><MediaImage src={selectedProduct.defaultDrawingUrl||SHAFT_BUSHING_SVG} alt={selectedProduct.name+' teknik resmi'} className="max-h-[680px] w-full object-contain bg-slate-950 rounded-lg"/>{selectedProduct.images?.map(image=><div key={image.id} className="mt-4"><h3 className="rq-section-title mb-3">{image.name}</h3><MediaImage src={image.url} alt={image.name} className="max-h-[500px] w-full object-contain"/></div>)}</Card>}
          {detailTab==='plans'&&<DataTable label="Ürün kontrol planları"><thead><tr><th>Revizyon</th><th>Durum</th><th>Nokta</th><th>Hazırlayan</th><th>Revizyon tarihi</th><th>İşlem</th></tr></thead><tbody>{selectedPlans.map(plan=><tr key={plan.id}><td className="rq-technical">{plan.version}</td><td><StatusBadge status={plan.status}/></td><td>{plan.characteristics.length}</td><td>{plan.author}</td><td className="rq-technical">{plan.revisionDate}</td><td><Button onClick={()=>onSelectProductForControlPlan(selectedProduct.id)}>Planları aç</Button></td></tr>)}</tbody></DataTable>}
          {detailTab==='inspections'&&<DataTable label="Ürünün kontrol geçmişi"><thead><tr><th>Kontrol</th><th>Zaman</th><th>Operatör</th><th>Sonuç</th></tr></thead><tbody>{productLogs.map(log=><tr key={log.id}><td>{onOpenInspection?<button className="rq-row-link rq-technical" onClick={()=>onOpenInspection(log)}>{log.sessionCode}</button>:<span className="rq-technical">{log.sessionCode}</span>}</td><td className="rq-technical">{new Date(log.timestamp).toLocaleString('tr-TR')}</td><td>{log.operatorName}</td><td><StatusBadge status={log.overallStatus}/></td></tr>)}</tbody></DataTable>}
        </div>
      ) : (
        <div>
          <TableToolbar><SearchInput value={searchTerm} onChange={event=>setSearchTerm(event.target.value)} placeholder="Kod, ürün, müşteri veya malzeme ara…" aria-label="Ürün ara"/><span className="rq-helper m-0">{filteredProducts.length} ürün</span></TableToolbar>
          <DataTable label="Ürün kütüphanesi"><thead><tr><th>Teknik resim</th><th>Ürün / parça kodu</th><th>Müşteri</th><th>Malzeme / kategori</th><th>Revizyon</th><th>Kontrol planı</th><th>Nokta</th><th><span className="sr-only">İşlem</span></th></tr></thead><tbody>
            {filteredProducts.map(product => {const activePlan=controlPlans.find(plan=>plan.productId===product.id&&plan.isActive&&plan.status==='active');return <tr key={product.id}>
              <td><div className="flex h-12 w-16 items-center justify-center overflow-hidden rounded-md bg-slate-950"><MediaImage src={product.defaultDrawingUrl || SHAFT_BUSHING_SVG} alt={product.name+' teknik resmi'} className="h-full w-full object-contain"/></div></td>
              <td><button type="button" className="rq-row-link" onClick={()=>setSelectedProductId(product.id)}>{product.name}<small className="rq-technical">{product.code}</small></button></td>
              <td>{product.customer}</td><td>{product.material}<small>{product.category}</small></td><td className="rq-technical">{product.revision||'A'}</td>
              <td>{activePlan?<><StatusBadge status="active"/><small className="rq-technical">{activePlan.version}</small></>:<Badge>Plan yok</Badge>}</td><td className="rq-technical">{activePlan?.characteristics.length||0}</td>
              <td><Button variant="ghost" aria-label={product.name+' detayını aç'} onClick={()=>setSelectedProductId(product.id)}><ChevronRight size={16}/></Button></td>
            </tr>;})}
          </tbody></DataTable>
          {filteredProducts.length===0&&<EmptyState title={products.length?'Aramanızla eşleşen ürün yok':'İlk ürününüzü oluşturun'} description="Ürün kodu, teknik resim ve malzemeyle başlayın; ardından kontrol planını hazırlayın." action={handleOpenAdd} label="İlk ürününü oluştur"/>}
        </div>
      )}

      <Modal open={isAddModalOpen} busy={saving} title={editingProduct?'Ürün bilgilerini düzenle':'Yeni parça / ürün'} onClose={()=>setIsAddModalOpen(false)}>
        <form onSubmit={handleSaveProduct}>
          <FormSection title="Temel bilgiler" description="Ürünü tanımlayan kod, ad ve teknik resim revizyonu.">
            <Field label="Parça kodu *"><Input required value={code} onChange={e=>setCode(e.target.value)} placeholder="PRD-2026-001" className="rq-technical"/></Field>
            <Field label="Parça adı *"><Input required value={name} onChange={e=>setName(e.target.value)} placeholder="CNC Tahrik Şaftı"/></Field>
            <Field label="Ürün / teknik resim revizyonu *"><Input required value={revision} onChange={e=>setRevision(e.target.value)} className="rq-technical"/></Field>
            <Field label="Müşteri / proje"><Input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Müşteri veya proje adı"/></Field>
          </FormSection>
          <FormSection title="Sınıflandırma ve üretim" description="Malzeme, üretim kategorisi ve teknik notlar.">
            <Field label="Malzeme"><Input value={material} onChange={e=>setMaterial(e.target.value)} placeholder="AISI 4140 / 16MnCr5"/></Field>
            <Field label="İmalat kategorisi"><Select value={category} onChange={e=>setCategory(e.target.value)}>{Array.from(new Set([category,'Talaşlı İmalat (CNC Torna & Freze)','Taşlama & Honlama','Plastik Enjeksiyon & Kalıp','Sac Metal & Pres Baskı','Alüminyum Döküm','Montaj & Kauçuk Parçalar'])).map(value=><option key={value}>{value}</option>)}</Select></Field>
            <Field label="Açıklama / teknik notlar"><Textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Kalite kontrol veya montaj gereksinimleri…"/></Field>
          </FormSection>
          <FormSection title="Teknik resimler ve belgeler" description="Mevcut şablonlardan birini seçin veya kendi teknik resminizi yükleyin.">
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-2">{[[SHAFT_BUSHING_SVG,'Şaft / Burç Parçası'],[FLANGE_BODY_SVG,'Flanş Gövdesi'],[CONNECTOR_HOUSING_SVG,'Konnektör Gövdesi']].map(([url,label])=><Button key={label} aria-pressed={drawingUrl===url} onClick={()=>setDrawingUrl(url)}>{label}</Button>)}</div>
            <Field label="PDF veya teknik resim yükle"><Input type="file" accept="image/*,application/pdf" onChange={handleDrawingUpload}/></Field>
            {drawingUrl&&<MediaImage src={drawingUrl} alt="Seçilen teknik resim" className="h-28 w-full rounded-lg bg-slate-950 object-contain"/>}
          </FormSection>
          <PageActions><Button disabled={saving} onClick={()=>setIsAddModalOpen(false)}>İptal</Button><Button variant="primary" loading={saving} type="submit">{editingProduct?'Güncelle':'Ürünü kaydet'}</Button></PageActions>
        </form>
      </Modal>
    </div>
  );
};
