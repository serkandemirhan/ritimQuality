import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
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
} from 'lucide-react';
import { TenantCompany, User, UserRole } from '../types';

export type NavTab = 'overview' | 'organization' | 'work' | 'operator' | 'control-plans' | 'products' | 'spc' | 'logs' | 'users' | 'subscription' | 'cases' | 'approvals' | 'notifications' | 'settings';

interface NavbarProps {
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
  group: 'Genel Bakış' | 'Operasyon' | 'Kalite Yönetimi' | 'Yönetim';
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
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
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navItems: NavItem[] = [
    {id:'overview',label:'Genel Bakış',description:'Kalite performansı',icon:<BarChart3 className="h-4 w-4"/>,allowedRoles:['admin','quality_engineer','auditor'],group:'Genel Bakış'},
    {id:'organization',label:'Organizasyon',description:'Tesis, bölüm ve istasyon',icon:<Building2 className="h-4 w-4"/>,allowedRoles:['admin'],group:'Yönetim'},
    {id:'settings',label:'Ayarlar',description:'Tercihler ve veri yönetimi',icon:<Settings2 className="h-4 w-4"/>,allowedRoles:['admin'],group:'Yönetim'},
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
      group: 'Kalite Yönetimi',
    },
    {
      id: 'products',
      label: 'Ürünler',
      description: 'Parça ve teknik resimler',
      icon: <Package className="h-4 w-4" />,
      badge: String(productCount),
      allowedRoles: ['admin', 'quality_engineer'],
      group: 'Kalite Yönetimi',
    },
    {
      id: 'spc',
      label: 'SPC Analizi',
      description: 'Proses yetenek raporları',
      icon: <BarChart3 className="h-4 w-4" />,
      allowedRoles: ['admin', 'quality_engineer', 'auditor'],
      group: 'Kalite Yönetimi',
    },
    {
      id: 'logs',
      label: 'Ölçüm Kayıtları',
      description: 'Geçmiş ve sertifikalar',
      icon: <History className="h-4 w-4" />,
      badge: String(logCount),
      allowedRoles: ['admin', 'quality_engineer', 'operator', 'auditor'],
      group: 'Kalite Yönetimi',
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

  const visibleItems = navItems.filter(item => item.allowedRoles.includes(currentUser.role) && item.id!=='subscription');
  const groups: NavItem['group'][] = ['Genel Bakış', 'Operasyon', 'Kalite Yönetimi', 'Yönetim'];

  const initials = currentUser.name
    .split(' ')
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

  const sidebar = (
    <aside className="flex h-full w-[280px] flex-col border-r border-slate-800 bg-slate-950 text-slate-100 shadow-2xl lg:shadow-none">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950/40">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
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
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">{group}</div>
              <div className="space-y-1">
                {groupItems.map(item => {
                  const active = item.id === activeTab || item.id==='work'&&['cases','approvals'].includes(activeTab);
                  return (
                    <button
                      key={item.id}
                      aria-current={active ? 'page' : undefined}
                      title={item.description}
                      id={`nav-tab-${item.id}`}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left transition ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white/15 text-white' : 'bg-slate-900 text-slate-500 group-hover:bg-slate-800 group-hover:text-blue-400'}`}>{item.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">{item.label}</span>
                      </span>
                      {item.badge ? (
                        <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${active ? 'bg-white/15 text-white' : 'bg-slate-900 text-slate-500'}`}>{item.badge}</span>
                      ) : (
                        <ChevronRight className={`h-3.5 w-3.5 ${active ? 'text-blue-200' : 'text-slate-700 group-hover:text-slate-500'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3"><button type="button" onClick={()=>onTabChange('settings')} className="w-full rounded-lg p-3 text-left text-sm text-slate-400">Kişisel ayarlar</button></div>
    </aside>
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

      <div className="fixed inset-y-0 left-0 z-50 hidden lg:block">{sidebar}</div>

      <nav aria-label="Mobil gezinme" className="quality-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white px-2 pt-1 text-slate-800 lg:hidden" style={{paddingBottom:'max(.5rem, env(safe-area-inset-bottom))'}}>
        {visibleItems.filter(item=>['operator','logs','work','spc'].includes(item.id)).slice(0,3).map(item=><button key={item.id} type="button" onClick={()=>onTabChange(item.id)} aria-current={activeTab===item.id?'page':undefined} className={'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs '+(activeTab===item.id?'bg-blue-100 text-blue-800 font-bold':'')}>{item.icon}<span>{item.id==='operator'?'Ölçüm':item.id==='logs'?'Kayıtlar':item.id==='work'?'Aksiyonlar':'SPC'}</span></button>)}
        <button type="button" onClick={()=>setMobileOpen(true)} aria-expanded={mobileOpen} className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs"><Menu className="h-5 w-5"/>Diğer</button>
      </nav>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Menüyü kapat" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
          <div className="quality-mobile-menu relative h-full w-[280px] max-w-full animate-in slide-in-from-left duration-200">{sidebar}</div>
        </div>
      )}
    </>
  );
};
