import { Sidebar, IconButton, Modal } from './ui';
import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  CheckCircle2,
  Database,
  History,
  LogOut,
  Menu,
  Package,
  Play,
  Settings2,
  ShieldCheck,
  Users,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { TenantCompany, User, UserRole } from '../types';

export type NavTab = 'overview' | 'organization' | 'work' | 'operator' | 'control-plans' | 'products' | 'spc' | 'logs' | 'users' | 'subscription' | 'cases' | 'approvals' | 'notifications' | 'settings';

interface NavbarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenBackupModal: () => void;
  onLogout: () => void;
  productCount: number;
  logCount: number;
  currentUser: User;
  company: TenantCompany;
}

type NavItem = {
  id: NavTab;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  allowedRoles: UserRole[];
  group: 'Operasyon' | 'Kalite' | 'Analitik' | 'Yönetim';
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab, collapsed=false, onToggleCollapse,
  onTabChange,
  onOpenBackupModal,
  onLogout,
  productCount,
  logCount,
  currentUser,
  company,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  const navItems: NavItem[] = [
    {id:'overview',label:'Genel Bakış',description:'Kalite performansı',icon:<BarChart3 className="h-4 w-4"/>,allowedRoles:['admin','quality_engineer','auditor'],group:'Operasyon'},
    {id:'organization',label:'Organizasyon',description:'Tesis, bölüm ve istasyon',icon:<Building2 className="h-4 w-4"/>,allowedRoles:['admin'],group:'Yönetim'},
    {id:'settings',label:'Ayarlar',description:'Tercihler ve veri yönetimi',icon:<Settings2 className="h-4 w-4"/>,allowedRoles:['admin'],group:'Yönetim'},
    {id:'cases',label:'Uygunsuzluklar',description:'Kalite aksiyonları',icon:<ShieldCheck className="h-4 w-4"/>,allowedRoles:['admin','quality_engineer','operator','auditor'],group:'Operasyon'},
    {id:'approvals',label:'Onaylar',description:'Ölçüm incelemeleri',icon:<CheckCircle2 className="h-4 w-4"/>,allowedRoles:['admin','quality_engineer','auditor'],group:'Operasyon'},
    {id:'work',label:'Aksiyonlar',description:'Atanan görevler',icon:<ClipboardCheck className="h-4 w-4"/>,allowedRoles:['admin','quality_engineer','operator','auditor'],group:'Operasyon'},
    {
      id: 'operator',
      label: 'Ölçüm İstasyonu',
      description: 'Canlı operatör ölçümü',
      icon: <Play className="h-4 w-4" />,
      badge: 'CANLI',
      allowedRoles: ['admin', 'quality_engineer', 'operator'],
      group: 'Operasyon',
    },
    {
      id: 'control-plans',
      label: 'Kontrol Planları',
      description: 'Noktalar ve revizyonlar',
      icon: <ClipboardCheck className="h-4 w-4" />,
      allowedRoles: ['admin', 'quality_engineer'],
      group: 'Kalite',
    },
    {
      id: 'products',
      label: 'Ürünler',
      description: 'Parça ve teknik resimler',
      icon: <Package className="h-4 w-4" />,
      badge: String(productCount),
      allowedRoles: ['admin', 'quality_engineer'],
      group: 'Kalite',
    },
    {
      id: 'spc',
      label: 'SPC Analizi',
      description: 'Proses yetenek raporları',
      icon: <BarChart3 className="h-4 w-4" />,
      allowedRoles: ['admin', 'quality_engineer', 'auditor'],
      group: 'Analitik',
    },
    {
      id: 'logs',
      label: 'Ölçüm Kayıtları',
      description: 'Geçmiş ve sertifikalar',
      icon: <History className="h-4 w-4" />,
      badge: String(logCount),
      allowedRoles: ['admin', 'quality_engineer', 'operator', 'auditor'],
      group: 'Kalite',
    },
    {
      id: 'users',
      label: 'Kullanıcılar & Roller',
      description: 'Ekip ve roller',
      icon: <Users className="h-4 w-4" />,
      allowedRoles: ['admin'],
      group: 'Yönetim',
    },
    {
      id: 'subscription',
      label: 'Abonelik',
      description: 'Paket ve faturalandırma',
      icon: <CreditCard className="h-4 w-4" />,
      badge: company.planId.toUpperCase(),
      allowedRoles: ['admin'],
      group: 'Yönetim',
    },
  ];

  const visibleItems = navItems.filter(item => item.allowedRoles.includes(currentUser.role));
  const mobileItems = (['work','operator','logs','overview'] as NavTab[]).map(id=>visibleItems.find(item=>item.id===id)).filter((item):item is NavItem=>!!item).slice(0,3);
  const groups: NavItem['group'][] = ['Operasyon', 'Kalite', 'Analitik', 'Yönetim'];

  const initials = currentUser.name
    .split(' ')
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

  const renderSidebar = (mobile = false) => (
    <Sidebar className={`rq-navigation flex h-full flex-col ${collapsed && !mobile ? 'is-collapsed' : ''}`}>
      <div className="rq-brand-row flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div className="rq-nav-label min-w-0">
            <div className="text-lg font-black tracking-tight text-white">Ritim Quality</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{company.name}</div>
          </div>
        </div>
        <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white lg:hidden" aria-label="Menüyü kapat">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {groups.map(group => {
          const groupItems = visibleItems.filter(item => item.group === group);
          if (!groupItems.length) return null;
          return (
            <div key={group} className="mb-3 last:mb-0">
              <div className="rq-nav-group mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">{group}</div>
              <div className="space-y-1">
                {groupItems.map(item => {
                  const active = item.id === activeTab;
                  return (
                    <button
                      key={item.id}
                      aria-current={active ? 'page' : undefined}
                      title={item.label}
                      aria-label={item.label}
                      id={`${mobile ? 'mobile-nav-tab' : 'nav-tab'}-${item.id}`}
                      type="button"
                      onClick={() => { onTabChange(item.id); setMobileOpen(false); }}
                      className={`rq-nav-item ${active ? 'is-active' : ''}`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white/15 text-white' : 'bg-slate-900 text-slate-500 group-hover:bg-slate-800 group-hover:text-blue-400'}`}>{item.icon}</span>
                      <span className="rq-nav-label min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">{item.label}</span>
                      </span>
                      {item.badge ? (
                        <span className={`rq-nav-meta rounded-md px-1.5 py-0.5 text-[9px] font-black ${active ? 'bg-white/15 text-white' : 'bg-slate-900 text-slate-500'}`}>{item.badge}</span>
                      ) : (
                        <ChevronRight className={`rq-nav-meta h-3.5 w-3.5 ${active ? 'text-blue-200' : 'text-slate-700 group-hover:text-slate-500'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="rq-nav-footer border-t border-slate-800 p-3"><IconButton label={collapsed?'Menüyü genişlet':'Menüyü daralt'} onClick={onToggleCollapse} aria-expanded={!collapsed} className="rq-collapse hidden lg:inline-flex">{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</IconButton><button type="button" onClick={()=>{onTabChange('settings');setMobileOpen(false);}} className="rq-nav-label w-full rounded-lg p-3 text-left text-sm text-slate-400">Kişisel ayarlar</button></div>
    </Sidebar>
  );

  const activeItem = navItems.find(item => item.id === activeTab);

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Menüyü aç">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-slate-900">{activeItem?.label || (activeTab==='settings'?'Ayarlar':'Bildirimler')}</div>
            <div className="truncate text-[10px] text-slate-500">Ritim Quality</div>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-black text-white">{initials}</div>
      </div>

      <div className="fixed inset-y-0 left-0 z-50 hidden lg:block">{renderSidebar()}</div>

      <nav aria-label="Mobil gezinme" className="quality-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white px-2 pt-1 text-slate-800 lg:hidden" style={{paddingBottom:'max(.5rem, env(safe-area-inset-bottom))'}}>
        {mobileItems.map(item=><button key={item.id} type="button" onClick={()=>onTabChange(item.id)} aria-current={activeTab===item.id?'page':undefined} className={'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs '+(activeTab===item.id?'bg-slate-100 text-slate-950 font-bold':'')}>{item.icon}<span>{item.id==='operator'?'Ölçüm':item.id==='logs'?'Kayıtlar':item.id==='work'?'Aksiyonlar':'Ana sayfa'}</span></button>)}
        <button type="button" onClick={()=>setMobileOpen(true)} aria-expanded={mobileOpen} className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs"><Menu className="h-5 w-5"/>Diğer</button>
      </nav>
      <Modal open={mobileOpen} title="Gezinme" onClose={() => setMobileOpen(false)} className="rq-mobile-navigation">
        <div className="quality-mobile-menu">{renderSidebar(true)}</div>
      </Modal>
    </>
  );
};
