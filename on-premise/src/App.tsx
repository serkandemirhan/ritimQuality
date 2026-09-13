import { Onboarding } from './components/Onboarding';
import { WorkCenter } from './components/WorkCenter';
import { PendingInspections } from './components/PendingInspections';
import React, { useState, useEffect } from 'react';
import { Product, ControlPlan, InspectionLog, User, CompanyProfile } from './types';
import { StorageService } from './services/storage';
import { Navbar, NavTab } from './components/Navbar';
import { OperatorStation } from './components/OperatorStation';
import { ControlPlanEditor } from './components/ControlPlanEditor';
import { ProductManagement } from './components/ProductManagement';
import { SPCReports } from './components/SPCReports';
import { MeasurementLogs } from './components/MeasurementLogs';
import { InspectionCertificateModal } from './components/InspectionCertificateModal';
import { DataBackupModal } from './components/DataBackupModal';
import { UserManager } from './components/UserManager';
import { OnPremApi } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>(new URLSearchParams(window.location.search).get('view')==='work'?'work':'operator');
  const [inspectionProductId,setInspectionProductId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [controlPlans, setControlPlans] = useState<ControlPlan[]>([]);
  const [inspectionLogs, setInspectionLogs] = useState<InspectionLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(StorageService.getCurrentUser());
  const [company, setCompany] = useState<CompanyProfile>(StorageService.getCompany());
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
      if (nextUser.role === 'auditor' && previous === 'operator') return 'spc';
      return previous;
    });
    setCompany(StorageService.getCompany());
  };

  useEffect(() => {
    StorageService.hydrateFromApi().then(()=>{loadData();setHydrated(true);}).catch(StorageService.reportSyncError);
    const onSyncError = (event: Event) => setSyncError((event as CustomEvent<string>).detail);
    window.addEventListener('qualitrack-sync-error', onSyncError);
    return () => window.removeEventListener('qualitrack-sync-error', onSyncError);
  }, []);

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

  // User handlers
  const handleSaveUser = async (user: User) => {
    try {
    await StorageService.saveUser(user);
    const updatedUsers = StorageService.getUsers();
    setUsers(updatedUsers);
    if (user.id === currentUser.id) {
      setCurrentUser(updatedUsers.find(item => item.id === user.id) || currentUser);
    }
  
    return true;
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); return false; }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
    await StorageService.deleteUser(userId);
    const remainingUsers = StorageService.getUsers();
    setUsers(remainingUsers);
  
    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); }
  };

  // Cross tab navigators
  const handleSelectProductForControlPlan = (productId: string) => {
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
    work: {title:'İşlerim',description:'Uygunsuzluk, görev ve onay yönetimi.'},
    operator: { title: 'Ölçüm İstasyonu', description: 'Üretim ölçümlerini kontrol planına göre kaydedin.' },
    'control-plans': { title: 'Kontrol Planları', description: 'Ölçüm noktalarını, toleransları ve revizyonları yönetin.' },
    products: { title: 'Ürünler', description: 'Parça kartlarını ve teknik resimleri yönetin.' },
    spc: { title: 'SPC Analizi', description: 'Proses kararlılığını ve yetenek indekslerini inceleyin.' },
    logs: { title: 'Ölçüm Kayıtları', description: 'Geçmiş kontrolleri, sonuçları ve sertifikaları görüntüleyin.' },
    users: { title: 'Kullanıcılar', description: 'Ekip üyelerini ve erişim rollerini yönetin.' },
  };

  if(!hydrated)return <main className="p-8"><p role="status">{syncError || 'Çalışma alanı yükleniyor…'}</p>{syncError&&<button type="button" className="mt-4 rounded-lg border p-3" onClick={()=>window.location.reload()}>Yeniden dene</button>}</main>;
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      {syncError && (
        <button type="button" onClick={() => setSyncError('')} className="fixed right-4 top-4 z-[100] max-w-md rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-left text-xs font-semibold text-red-800 shadow-xl">
          Sunucu senkronizasyonu başarısız: {syncError} · Kapat
        </button>
      )}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onLogout={async () => { await OnPremApi.logout(); window.location.reload(); }}
        productCount={products.length}
        logCount={inspectionLogs.length}
        currentUser={currentUser}
        company={company}
      />

      <div className="flex min-h-screen flex-col lg:pl-[280px]">
        <header className="hidden h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 lg:flex">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">{pageMeta[activeTab].title}</h1>
            <p className="mt-1 text-xs text-slate-500">{pageMeta[activeTab].description}</p>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-slate-700">{company.name}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ritim Quality · On-Premise</div>
          </div>
        </header>

        {currentUser.role === 'admin' && <Onboarding products={products} plans={controlPlans} users={users} logs={inspectionLogs} onNavigate={setActiveTab}/>}
        <PendingInspections onSaved={loadData} />
        {/* Main Content Area */}
        <main className={`flex-1 w-full mx-auto ${
        activeTab === 'operator' 
          ? 'max-w-[1700px] px-2 py-2 sm:px-4 sm:py-3 lg:px-6' 
          : 'max-w-7xl px-4 py-6 sm:px-6 lg:px-8'
        }`}>
        {activeTab === 'work' && <WorkCenter users={users} products={products} currentUser={currentUser} onInspect={handleSelectProductForInspection}/>}
        {activeTab === 'operator' && (
          <OperatorStation
            initialProductId={inspectionProductId}
            products={products}
            controlPlans={controlPlans}
            currentUser={currentUser}
            onInspectionSaved={handleInspectionSaved}
            onOpenCertificate={(log) => setCertificateLog(log)}
          />
        )}

        {activeTab === 'control-plans' && (
          <ControlPlanEditor
            products={products}
            controlPlans={controlPlans}
            onSavePlan={handleSaveControlPlan}
            onSetActiveVersion={handleSetActiveVersion}
            onDeletePlan={handleDeletePlan}
          />
        )}

        {activeTab === 'products' && (
          <ProductManagement
            products={products}
            controlPlans={controlPlans}
            onProductsChanged={loadData}
            onSelectProductForControlPlan={handleSelectProductForControlPlan}
            onSelectProductForInspection={handleSelectProductForInspection}
          />
        )}

        {activeTab === 'spc' && (
          <SPCReports
            products={products}
            controlPlans={controlPlans}
            inspectionLogs={inspectionLogs}
          />
        )}

        {activeTab === 'logs' && (
          <MeasurementLogs
            products={products}
            controlPlans={controlPlans}
            logs={inspectionLogs}
            currentUser={currentUser}
            onOpenCertificate={(log) => setCertificateLog(log)}
            onLogsChanged={loadData}
          />
        )}

        {activeTab === 'users' && (
          <UserManager
            users={users}
            currentUser={currentUser}
            onSaveUser={handleSaveUser}
            onDeleteUser={handleDeleteUser}
          />
        )}

        </main>

      {/* Printable ISO 9001 Certificate Modal */}
      {certificateLog && (
        <InspectionCertificateModal
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
        <footer className="border-t border-slate-200 bg-white py-4 px-4 text-center text-xs text-slate-500 font-sans">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Ritim Quality On-Premise</span>
            <span>•</span>
            <span className="font-semibold text-slate-600">{company.name}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-mono bg-emerald-100 text-emerald-800 font-bold">YEREL KURULUM</span>
          </div>
          <span className="text-slate-500">ISO 9001:2015 & IATF 16949 Uyumlu Kurum İçi Kalite & SPC Sistemi</span>
        </div>
        </footer>
      </div>
    </div>
  );
}
