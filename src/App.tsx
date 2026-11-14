import {currentRelease} from './releaseHistory';
import { AppShell, Topbar, PageContainer, PageHeader, Breadcrumb, Button, Skeleton } from './components/ui';
import { AccountMenu } from './components/AccountMenu';
import { Toast } from './components/Toast';
import { NotificationPanel } from './components/NotificationPanel';
import { Settings } from './components/Settings';
import { WorkCenter } from './components/WorkCenter';
import { PendingInspections } from './components/PendingInspections';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Product, ControlPlan, InspectionLog, User, TenantCompany, SubscriptionPlanId, InspectionRequest } from './types';
import { StorageService } from './services/storage';
import { Navbar, NavTab } from './components/Navbar';
import { OperatorStation } from './components/OperatorStation';
import { ControlPlanEditor } from './components/ControlPlanEditor';
import { ProductManagement } from './components/ProductManagement';
import { MeasurementLogs } from './components/MeasurementLogs';
import { InspectionCertificateModal } from './components/InspectionCertificateModal';
import {MobileInspectionUploads} from './components/MobileInspectionUploads';
import { DataBackupModal } from './components/DataBackupModal';
import { UserManager } from './components/UserManager';
import { SubscriptionManager } from './components/SubscriptionManager';
import { SaasApi } from './services/api';
import {VerifyEmailNotice} from './components/VerifyEmailNotice';
import {readMobileSession} from './services/mobileMeasurement';
import {MobileMeasurementShell} from './components/MobileMeasurementShell';
import {readOfflineCatalog} from './services/offlineCatalog';
import {QrLabelManager} from './components/QrLabelManager';

const Overview=lazy(()=>import('./components/Overview').then(module=>({default:module.Overview})));
const SPCReports=lazy(()=>import('./components/SPCReports').then(module=>({default:module.SPCReports})));
const AnalyticsLoading=()=> <div role="status" aria-label="Analiz yükleniyor"><Skeleton className="h-24 mb-5"/><Skeleton className="h-96"/></div>;

export default function App() {
  const [activeTab, setActiveTabImmediate] = useState<NavTab>((['overview','work','logs','settings','subscription'] as NavTab[]).includes(new URLSearchParams(window.location.search).get('view') as NavTab)?new URLSearchParams(window.location.search).get('view') as NavTab:new URLSearchParams(window.location.search).has('product')?'operator':StorageService.getCurrentUser().role==='operator'?'operator':'overview');
  const setActiveTab: React.Dispatch<React.SetStateAction<NavTab>> = next => { const proceed=()=>{if(typeof next==='string'&&next!=='operator')setInspectionRequest(undefined);setActiveTabImmediate(next);}; const event=new CustomEvent('ritim-measurement-navigate',{cancelable:true,detail:proceed}); if(window.dispatchEvent(event))proceed(); };
  const [inspectionRequest,setInspectionRequest]=useState<InspectionRequest>();
  const [recordId,setRecordId]=useState('');
  const openRecord=(id:string)=>{void StorageService.hydrateFromApi().then(()=>{loadData();setRecordId(id);setActiveTab('logs');}).catch(StorageService.reportSyncError);};
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
  const [offlineMobile,setOfflineMobile]=useState(false);
  const [offlineCatalogAt,setOfflineCatalogAt]=useState('');
  
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
    let live=true;
    StorageService.hydrateFromApi().then(()=>{if(!live)return;loadData();const query=new URLSearchParams(window.location.search);const role=StorageService.getCurrentUser().role;setActiveTab(['overview','work','logs','settings','subscription'].includes(query.get('view')||'')?query.get('view') as NavTab:query.has('product')&&role!=='auditor'?'operator':role==='operator'?'operator':'overview');setHydrated(true);}).catch(async error=>{
      StorageService.reportSyncError(error);
      if(!navigator.onLine&&SaasApi.hasSession()){
        try{
          if(await readMobileSession(SaasApi.scope())){setOfflineMobile(true);return;}
          const catalog=await readOfflineCatalog(SaasApi.scope());
          if(catalog&&live){
            setSyncError('');setOfflineCatalogAt(catalog.savedAt);setProducts(catalog.products);setControlPlans(catalog.controlPlans);setInspectionLogs([]);setUsers([catalog.currentUser]);setCurrentUser(catalog.currentUser);setCompany(catalog.company);setActiveTab('operator');setHydrated(true);
          }
        }catch{/* Keep the startup error visible when no verified local catalog exists. */}
      }
    });
    const onSyncError = (event: Event) => setSyncError((event as CustomEvent<string>).detail);
    window.addEventListener('qualitrack-sync-error', onSyncError);
    return () => {live=false;window.removeEventListener('qualitrack-sync-error', onSyncError);};
  }, []);

  useEffect(()=>{if(!hydrated||activeTab!=='overview')return;const timer=setInterval(()=>{void StorageService.hydrateFromApi().then(loadData).catch(StorageService.reportSyncError);},60000);return()=>clearInterval(timer);},[hydrated,activeTab]);

  useEffect(()=>{document.documentElement.dataset.hand=localStorage.getItem('quality:preferences:'+currentUser.id)==='left'?'left':'right';},[currentUser.id]);
  const navigateWork=(section:string)=>setActiveTab(({tasks:'work',inbox:'notifications',cases:'cases',approvals:'approvals'} as Record<string,NavTab>)[section] || 'work');

  // Handlers for state updates
  const handleInspectionSaved = (newLog: InspectionLog) => {
    setInspectionLogs(prev => [newLog, ...prev.filter(log=>log.id!==newLog.id)]);
    setCertificateLog(previous=>previous?.id===newLog.id?newLog:previous);
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

  const handleSelectProductForInspection = (productId: string, request?: InspectionRequest) => {
    setInspectionRequest(request);
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
    operator: { title: 'Kontrol başlat', description: 'Üretim ölçümlerini kontrol planına göre kaydedin.' },
    'control-plans': { title: 'Kontrol Planları', description: 'Ölçüm noktalarını, toleransları ve revizyonları yönetin.' },
    products: { title: 'Parçalar', description: 'Parça kartlarını ve teknik resimleri yönetin.' },
    'qr-labels': {title:'QR Etiketleri',description:'Aktif kontrol planlarını QR etiketleriyle operatörlere ulaştırın.'},
    spc: { title: 'SPC Analizi', description: 'Proses kararlılığını ve yetenek indekslerini inceleyin.' },
    logs: { title: 'Kontrol kayıtları', description: 'Geçmiş kontrolleri, sonuçları ve raporları görüntüleyin.' },
    users: { title: 'Kullanıcılar', description: 'Ekip üyelerini ve erişim rollerini yönetin.' },
    subscription: { title: 'Abonelik', description: 'Paket kullanımını ve faturalandırmayı yönetin.' },
  };

  if(offlineMobile)return <><MobileInspectionUploads onConfirmed={log=>{handleInspectionSaved(log);setCertificateLog(previous=>previous?.id===log.id?log:previous);}}/>{certificateLog?<InspectionCertificateModal log={certificateLog} company={company} product={certificateProduct} controlPlan={certificatePlan} onClose={()=>{setCertificateLog(null);setOfflineMobile(false);}}/>:<MobileMeasurementShell onSaved={()=>{}} onCompleted={setCertificateLog} onExit={()=>setOfflineMobile(false)}/>}</>;
  if(!hydrated)return <main className="p-8"><p role="status">{syncError || 'Çalışma alanı yükleniyor…'}</p>{syncError&&<button type="button" className="mt-4 rounded-lg border p-3" onClick={()=>window.location.reload()}>Yeniden dene</button>}</main>;
  return (
    <AppShell style={{'--rq-sidebar-width':sidebarCollapsed?'72px':'240px'} as React.CSSProperties}>
      <a className="rq-skip-link" href="#main-content">İçeriğe geç</a>
      <Toast/>
      {offlineCatalogAt&&<div role="status" className="sticky top-0 z-[90] bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950">Çevrimdışı çalışma · {new Date(offlineCatalogAt).toLocaleString('tr-TR')} tarihinde cihazda saklanan aktif kontrol planları kullanılıyor.</div>}
      {syncError && (
        <button type="button" onClick={() => setSyncError('')} className="fixed right-4 top-4 z-[100] max-w-md rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-left text-xs font-semibold text-red-800 shadow-xl">
          Sunucu senkronizasyonu başarısız: {syncError} · Kapat
        </button>
      )}
      {!kiosk && !measurementActive && <Navbar
        collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar}
        activeTab={activeTab}
        onOpenRecord={openRecord}
        onTabChange={setActiveTab}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onLogout={async () => { await SaasApi.logout(); window.location.reload(); }}
        productCount={products.length}
        logCount={inspectionLogs.length}
        currentUser={currentUser}
        company={company}
      />}

      <div className={`flex min-h-screen flex-col ${kiosk || measurementActive ? '' : 'rq-shell-content'}`}>
        <Topbar hidden={measurementActive} className={'app-page-header'+(!kiosk?' rq-desktop-topbar':'')}>
          <div className="rq-site-identity"><span className="rq-site-mark" aria-hidden="true"/><div><strong>{company.name}</strong>{company.facilityLocation&&<small>{company.facilityLocation}</small>}</div></div>
          <div className="flex items-center gap-3">
            {activeTab==='operator'&&<Button onClick={()=>setKiosk(!kiosk)}>{kiosk?'Menüyü göster':'Odak modu'}</Button>}
            <NotificationPanel onNavigate={setActiveTab} onOpenRecord={openRecord} role={currentUser.role}/>
            <AccountMenu user={currentUser} onSettings={()=>setActiveTab('settings')} onLogout={async()=>{await SaasApi.logout();window.location.reload();}}/>
          </div>
        </Topbar>


        {!measurementActive&&<PendingInspections onSaved={loadData} />}
        <MobileInspectionUploads onConfirmed={log=>{handleInspectionSaved(log);setCertificateLog(previous=>previous?.id===log.id?log:previous);}}/>
        {/* Main Content Area */}
        <PageContainer id="main-content" tabIndex={-1} className={measurementActive?'rq-terminal-page':'rq-workspace'}>
        {!measurementActive&&!['overview','products','control-plans','operator','qr-labels'].includes(activeTab)&&<PageHeader title={pageMeta[activeTab].title} description={pageMeta[activeTab].description} breadcrumb={<Breadcrumb items={[{label:'Ritim Quality'},{label:pageMeta[activeTab].title}]}/>}/>}
        {activeTab === 'overview' && <VerifyEmailNotice/>}
        {activeTab==='overview'&&<Suspense fallback={<AnalyticsLoading/>}><Overview canInspect={currentUser.role!=='auditor'} canManage={currentUser.role==='admin'||currentUser.role==='quality_engineer'} products={products} plans={controlPlans} logs={inspectionLogs} onNavigate={setActiveTab} onOpenLog={log=>openRecord(log.id)} onOpenReport={setCertificateLog}/></Suspense>}
        {activeTab==='organization'&&currentUser.role==='admin'&&<WorkCenter section="organization" onSectionChange={()=>{}} users={users} products={products} currentUser={currentUser} onInspect={handleSelectProductForInspection}/>}
        {['work','cases','approvals','notifications'].includes(activeTab) && <WorkCenter onOpenReport={id=>{void StorageService.hydrateFromApi().then(()=>{loadData();const log=StorageService.getInspectionLogs().find(l=>l.id===id);if(log)setCertificateLog(log);}).catch(StorageService.reportSyncError);}} onOpenRecord={openRecord} section={activeTab==='work'?'tasks':activeTab==='notifications'?'inbox':activeTab} onSectionChange={navigateWork} users={users} products={products} currentUser={currentUser} onInspect={handleSelectProductForInspection}/>}
        {activeTab === 'settings' && <Settings onNavigate={setActiveTab} currentUser={currentUser} users={users} products={products} onInspect={handleSelectProductForInspection} onOpenBackup={()=>setIsBackupModalOpen(true)}/>}
        {activeTab === 'operator' && (
          <OperatorStation
            onSessionChange={setMeasurementActive}
            onOpenActions={()=>setActiveTab('cases')}
            initialProductId={inspectionProductId} initialRequest={inspectionRequest}
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
            onOpenQrLabels={()=>setActiveTab('qr-labels')}
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
        {activeTab==='qr-labels'&&['admin','quality_engineer'].includes(currentUser.role)&&<QrLabelManager products={products} controlPlans={controlPlans} onBack={()=>setActiveTab('control-plans')}/>} 

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
          <span>Ritim Quality · v{currentRelease.version} · Ritim Cloud</span>
          <span>Revizyon kontrollü kalite kayıtları</span>
        </div>
        </footer>
      </div>
    </AppShell>
  );
}
