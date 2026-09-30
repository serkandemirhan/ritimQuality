import { AppShell, Topbar, PageContainer, PageHeader, Breadcrumb, Button, Skeleton } from './components/ui';
import { ROLE_LABELS } from './services/terms';
import { Toast } from './components/Toast';
import { NotificationPanel } from './components/NotificationPanel';
import { Settings } from './components/Settings';
import { Onboarding } from './components/Onboarding';
import { WorkCenter } from './components/WorkCenter';
import { PendingInspections } from './components/PendingInspections';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Product, ControlPlan, InspectionLog, User, TenantCompany, SubscriptionPlanId } from './types';
import { StorageService } from './services/storage';
import { Navbar, NavTab } from './components/Navbar';
import { OperatorStation } from './components/OperatorStation';
import { ControlPlanEditor } from './components/ControlPlanEditor';
import { ProductManagement } from './components/ProductManagement';
import { MeasurementLogs } from './components/MeasurementLogs';
import { InspectionCertificateModal } from './components/InspectionCertificateModal';
import { DataBackupModal } from './components/DataBackupModal';
import { UserManager } from './components/UserManager';
import { SubscriptionManager } from './components/SubscriptionManager';
import { SaasApi } from './services/api';

const Overview=lazy(()=>import('./components/Overview').then(module=>({default:module.Overview})));
const SPCReports=lazy(()=>import('./components/SPCReports').then(module=>({default:module.SPCReports})));
const AnalyticsLoading=()=> <div role="status" aria-label="Analiz yükleniyor"><Skeleton className="h-24 mb-5"/><Skeleton className="h-96"/></div>;

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>(new URLSearchParams(window.location.search).get('view')==='work'?'work':new URLSearchParams(window.location.search).has('product')?'operator':StorageService.getCurrentUser().role==='operator'?'operator':'overview');
  const [recordId,setRecordId]=useState('');
  const openRecord=(id:string)=>{setRecordId(id);setActiveTab('logs');};
  const [planProductId,setPlanProductId] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('ritim:sidebar-collapsed') === 'true');
  const toggleSidebar = () => setSidebarCollapsed(value => {localStorage.setItem('ritim:sidebar-collapsed', String(!value));return !value;});
  const [measurementActive, setMeasurementActive] = useState(false);
  const [kiosk,setKiosk] = useState(false);
  const [inspectionProductId,setInspectionProductId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [controlPlans, setControlPlans] = useState<ControlPlan[]>([]);
  const [inspectionLogs, setInspectionLogs] = useState<InspectionLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(StorageService.getCurrentUser());
  const [company, setCompany] = useState<TenantCompany>(StorageService.getCompany());
  const [syncError, setSyncError] = useState('');
  const [hydrated,setHydrated] = useState(false);
  
  // Modals
  const [certificateLog, setCertificateLog] = useState<InspectionLog | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);

  // Load initial data
  const loadData = () => {
    StorageService.init();
    setProducts(StorageService.getProducts());
    setControlPlans(StorageService.getControlPlans());
    setInspectionLogs(StorageService.getInspectionLogs());
    setUsers(StorageService.getUsers());
    const nextUser = StorageService.getCurrentUser();
    setCurrentUser(nextUser);
    setActiveTab(previous => {
      if (nextUser.role === 'auditor' && previous === 'operator') return 'overview';
      return previous;
    });
    setCompany(StorageService.getCompany());
  };

  useEffect(() => {
    StorageService.hydrateFromApi().then(()=>{loadData();const query=new URLSearchParams(window.location.search);const role=StorageService.getCurrentUser().role;setActiveTab(query.get('view')==='work'?'work':query.has('product')&&role!=='auditor'?'operator':role==='operator'?'operator':'overview');setHydrated(true);}).catch(StorageService.reportSyncError);
    const onSyncError = (event: Event) => setSyncError((event as CustomEvent<string>).detail);
    window.addEventListener('qualitrack-sync-error', onSyncError);
    return () => window.removeEventListener('qualitrack-sync-error', onSyncError);
  }, []);

  useEffect(()=>{if(!hydrated||activeTab!=='overview')return;const timer=setInterval(()=>{void StorageService.hydrateFromApi().then(loadData).catch(StorageService.reportSyncError);},60000);return()=>clearInterval(timer);},[hydrated,activeTab]);

  useEffect(()=>{document.documentElement.dataset.hand=localStorage.getItem('quality:preferences:'+currentUser.id)==='left'?'left':'right';},[currentUser.id]);
  const navigateWork=(section:string)=>setActiveTab(({tasks:'work',inbox:'notifications',cases:'cases',approvals:'approvals'} as Record<string,NavTab>)[section] || 'work');

  // Handlers for state updates
  const handleInspectionSaved = (newLog: InspectionLog) => {
    setInspectionLogs(prev => [newLog, ...prev.filter(log=>log.id!==newLog.id)]);
  };

  const handleSaveControlPlan = (updatedPlan: ControlPlan) => {
    setControlPlans(StorageService.getControlPlans());
  };

  const handleSetActiveVersion = async (planId: string) => {
    try {
    await StorageService.setActiveControlPlanVersion(planId);
    setControlPlans(StorageService.getControlPlans());
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
    await StorageService.deleteControlPlan(planId);
    setControlPlans(StorageService.getControlPlans());
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); }
  };

  // SaaS User Handlers
  const handleUserSelect = (userId: string) => {
    if (SaasApi.hasSession()) return;
    StorageService.setCurrentUser(userId);
    const updatedCur = StorageService.getCurrentUser();
    setCurrentUser(updatedCur);
  };

  const handleSaveUser = async (user: User) => {
    try {
    await StorageService.saveUser(user);
    setUsers(StorageService.getUsers());
    if (user.id === currentUser.id) {
      setCurrentUser(user);
    }
  
    return true;
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); return false; }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
    await StorageService.deleteUser(userId);
    const remainingUsers = StorageService.getUsers();
    setUsers(remainingUsers);
    if (currentUser.id === userId && remainingUsers.length > 0) {
      handleUserSelect(remainingUsers[0].id);
    }
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); }
  };

  // SaaS Subscription & Company Handlers
  const handleUpdatePlan = async (planId: SubscriptionPlanId, billingPeriod: 'monthly' | 'annual') => {
    await SaasApi.checkout(planId, billingPeriod);
  };

  const handleSaveCompanyDetails = async (updated: TenantCompany) => {
    try {
    await StorageService.saveCompany(updated);
    setCompany(updated);
  
    return true;
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); return false; }
  };

  // Cross tab navigators
  const handleSelectProductForControlPlan = (productId: string) => {
    setPlanProductId(productId);
    setActiveTab('control-plans');
  };

  const handleSelectProductForInspection = (productId: string) => {
    setInspectionProductId(productId);
    setActiveTab('operator');
  };

  // Find related product and plan for certificate modal
  const certificateProduct = certificateLog
    ? products.find(p => p.id === certificateLog.productId)
    : undefined;
  const certificatePlan = certificateLog
    ? certificateLog.controlPlanSnapshot || controlPlans.find(cp => cp.id === certificateLog.controlPlanId)
    : undefined;

  const pageMeta: Record<NavTab, { title: string; description: string }> = {
    overview: {title:'Genel Bakış',description:'Kalite performansı ve öncelikli aksiyonlar.'},
    organization: {title:'Organizasyon',description:'Tesis, bölüm ve istasyon yapısı.'},
    settings: {title:'Ayarlar',description:'Kişisel kullanım tercihleri ve çalışma alanı yönetimi.'},
    notifications: {title:'Bildirimler',description:'Süreçlerinizle ilgili gelişmeleri takip edin.'},
    cases: {title:'Uygunsuzluklar',description:'Uygunsuz ölçümler, düzeltici aksiyonlar ve kapanış takibi.'},
    approvals: {title:'Onaylar',description:'Ölçüm incelemeleri ve kalite kararları.'},
    work: {title:'Aksiyonlar',description:'Atanan görevler ve planlanan kontroller.'},
    operator: { title: 'Ölçüm İstasyonu', description: 'Üretim ölçümlerini kontrol planına göre kaydedin.' },
    'control-plans': { title: 'Kontrol Planları', description: 'Ölçüm noktalarını, toleransları ve revizyonları yönetin.' },
    products: { title: 'Ürünler', description: 'Parça kartlarını ve teknik resimleri yönetin.' },
    spc: { title: 'SPC Analizi', description: 'Proses kararlılığını ve yetenek indekslerini inceleyin.' },
    logs: { title: 'Ölçüm Kayıtları', description: 'Geçmiş kontrolleri, sonuçları ve sertifikaları görüntüleyin.' },
    users: { title: 'Kullanıcılar', description: 'Ekip üyelerini ve erişim rollerini yönetin.' },
    subscription: { title: 'Abonelik', description: 'Paket kullanımını ve faturalandırmayı yönetin.' },
  };

  if(!hydrated)return <main className="p-8"><p role="status">{syncError || 'Çalışma alanı yükleniyor…'}</p>{syncError&&<button type="button" className="mt-4 rounded-lg border p-3" onClick={()=>window.location.reload()}>Yeniden dene</button>}</main>;
  return (
    <AppShell style={{'--rq-sidebar-width':sidebarCollapsed?'72px':'240px'} as React.CSSProperties}>
      <a className="rq-skip-link" href="#main-content">İçeriğe geç</a>
      <Toast/>
      {syncError && (
        <button type="button" onClick={() => setSyncError('')} className="fixed right-4 top-4 z-[100] max-w-md rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-left text-xs font-semibold text-red-800 shadow-xl">
          Sunucu senkronizasyonu başarısız: {syncError} · Kapat
        </button>
      )}
      {!kiosk && !measurementActive && <Navbar
        collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onLogout={async () => { await SaasApi.logout(); window.location.reload(); }}
        productCount={products.length}
        logCount={inspectionLogs.length}
        currentUser={currentUser}
        company={company}
      />}

      <div className={`flex min-h-screen flex-col ${kiosk || measurementActive ? '' : 'rq-shell-content'}`}>
        <Topbar hidden={measurementActive} className="app-page-header">
          <div className="rq-site-identity"><span className="rq-site-mark" aria-hidden="true"/><div><strong>{company.name}</strong>{company.facilityLocation&&<small>{company.facilityLocation}</small>}</div></div>
          <div className="flex items-center gap-3">
            {activeTab==='operator'&&<Button onClick={()=>setKiosk(!kiosk)}>{kiosk?'Menüyü göster':'Odak modu'}</Button>}
            <NotificationPanel onNavigate={setActiveTab}/>
            <details className="relative text-sm"><summary className="cursor-pointer">{currentUser.name} · {ROLE_LABELS[currentUser.role]}</summary><div className="absolute right-0 z-40 min-w-48 rounded-xl bg-white p-4 shadow-xl"><button className="block p-2" onClick={()=>setActiveTab('settings')}>Kişisel ayarlar</button><button className="block p-2" onClick={async()=>{await SaasApi.logout();window.location.reload();}}>Oturumu kapat</button></div></details>
          </div>
        </Topbar>


        <PendingInspections onSaved={loadData} />
        {/* Main Content Area */}
        <PageContainer id="main-content" tabIndex={-1} className={measurementActive?'rq-terminal-page':'rq-workspace'}>
        {!measurementActive&&!['products','control-plans','operator'].includes(activeTab)&&<PageHeader title={pageMeta[activeTab].title} description={pageMeta[activeTab].description} breadcrumb={<Breadcrumb items={[{label:'Ritim Quality'},{label:pageMeta[activeTab].title}]}/>}/>}
        {activeTab === 'overview' && currentUser.role === 'admin' && <Onboarding products={products} plans={controlPlans} users={users} logs={inspectionLogs} onNavigate={setActiveTab}/>}
        {activeTab==='overview'&&<Suspense fallback={<AnalyticsLoading/>}><Overview canInspect={currentUser.role!=='auditor'} logs={inspectionLogs} onNavigate={setActiveTab} onOpenLog={log=>openRecord(log.id)}/></Suspense>}
        {activeTab==='organization'&&currentUser.role==='admin'&&<WorkCenter section="organization" onSectionChange={()=>{}} users={users} products={products} currentUser={currentUser} onInspect={handleSelectProductForInspection}/>}
        {['work','cases','approvals','notifications'].includes(activeTab) && <WorkCenter onOpenRecord={openRecord} section={activeTab==='work'?'tasks':activeTab==='notifications'?'inbox':activeTab} onSectionChange={navigateWork} users={users} products={products} currentUser={currentUser} onInspect={handleSelectProductForInspection}/>}
        {activeTab === 'settings' && <Settings onNavigate={setActiveTab} currentUser={currentUser} users={users} products={products} onInspect={handleSelectProductForInspection} onOpenBackup={()=>setIsBackupModalOpen(true)}/>}
        {activeTab === 'operator' && (
          <OperatorStation
            onSessionChange={setMeasurementActive}
            onOpenActions={()=>setActiveTab('cases')}
            initialProductId={inspectionProductId}
            products={products}
            controlPlans={controlPlans}
            currentUser={currentUser}
            onInspectionSaved={handleInspectionSaved}
            onOpenCertificate={(log) => setCertificateLog(log)}
          />
        )}

        {activeTab === 'control-plans' && ['admin','quality_engineer'].includes(currentUser.role) && (
          <ControlPlanEditor
            onInspect={handleSelectProductForInspection}
            initialProductId={planProductId}
            onCreateProduct={()=>setActiveTab('products')}
            products={products}
            controlPlans={controlPlans}
            onSavePlan={handleSaveControlPlan}
            onSetActiveVersion={handleSetActiveVersion}
            onDeletePlan={handleDeletePlan}
            onProductUpdated={updated=>setProducts(current=>current.map(product=>product.id===updated.id?updated:product))}
          />
        )}

        {activeTab === 'products' && ['admin','quality_engineer'].includes(currentUser.role) && (
          <ProductManagement
            inspectionLogs={inspectionLogs} onOpenInspection={log=>openRecord(log.id)}
            products={products}
            controlPlans={controlPlans}
            onProductsChanged={loadData}
            onSelectProductForControlPlan={handleSelectProductForControlPlan}
            onSelectProductForInspection={handleSelectProductForInspection}
          />
        )}

        {activeTab === 'spc' && (
          <Suspense fallback={<AnalyticsLoading/>}>
          <SPCReports
            products={products}
            controlPlans={controlPlans}
            inspectionLogs={inspectionLogs}
          />
          </Suspense>
        )}

        {activeTab === 'logs' && (
          <MeasurementLogs
            initialLogId={recordId}
            onOpenPlan={currentUser.role==='admin'||currentUser.role==='quality_engineer'?handleSelectProductForControlPlan:undefined}
            onOpenSPC={currentUser.role!=='operator'?()=>setActiveTab('spc'):undefined}
            products={products}
            controlPlans={controlPlans}
            logs={inspectionLogs}
            currentUser={currentUser}
            onOpenCertificate={(log) => setCertificateLog(log)}
            onLogsChanged={loadData}
          />
        )}

        {activeTab === 'users' && currentUser.role==='admin' && (
          <UserManager
            users={users}
            currentUser={currentUser}
            onUserSelect={handleUserSelect}
            onSaveUser={handleSaveUser}
            onDeleteUser={handleDeleteUser}
          />
        )}

        {activeTab === 'subscription' && currentUser.role==='admin' && (
          <SubscriptionManager
            company={company}
            controlPlanCount={controlPlans.length}
            userCount={users.length}
            monthlyMeasurementCount={inspectionLogs
              .filter(log => log.timestamp.slice(0, 7) === new Date().toISOString().slice(0, 7))
              .reduce((total, log) => total + log.samples.length, 0)}
            onUpdatePlan={handleUpdatePlan}
            onSaveCompanyDetails={handleSaveCompanyDetails}
          />
        )}
        </PageContainer>

      {/* Printable ISO 9001 Certificate Modal */}
      {certificateLog && (
        <InspectionCertificateModal
          company={company}
          log={certificateLog}
          product={certificateProduct}
          controlPlan={certificatePlan}
          onClose={() => setCertificateLog(null)}
        />
      )}

      {/* Database Backup & Restore Modal */}
      {isBackupModalOpen && (
        <DataBackupModal
          onClose={() => setIsBackupModalOpen(false)}
          onDataRestored={() => {
            loadData();
            setIsBackupModalOpen(false);
          }}
        />
      )}

        {/* Professional Footer */}
        <footer hidden={measurementActive} className="app-page-footer border-t border-slate-200 bg-white py-4 px-4 text-center text-xs text-slate-500 font-sans">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Ritim Quality · v1.0 · Ritim Cloud</span>
          <span>Revizyon kontrollü kalite kayıtları</span>
        </div>
        </footer>
      </div>
    </AppShell>
  );
}
