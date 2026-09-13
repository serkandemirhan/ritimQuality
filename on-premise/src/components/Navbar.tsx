import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardCheck,
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
import { CompanyProfile, User, UserRole } from '../types';

export type NavTab = 'work' | 'operator' | 'control-plans' | 'products' | 'spc' | 'logs' | 'users';

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenBackupModal: () => void;
  onLogout: () => void;
  productCount: number;
  logCount: number;
  currentUser: User;
  company: CompanyProfile;
}

type NavItem = {
  id: NavTab;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  allowedRoles: UserRole[];
  group: 'Operasyon' | 'Kalite Yönetimi' | 'Yönetim';
};

const roleLabels: Record<UserRole, string> = {
  admin: 'Yönetici',
  quality_engineer: 'Kalite Mühendisi',
  operator: 'Operatör',
  auditor: 'Denetçi',
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
  const preferenceKey = 'quality:preferences:' + currentUser.id;
  const [hand,setHand] = useState<'left'|'right'>(()=>localStorage.getItem(preferenceKey)==='left'?'left':'right');
  useEffect(()=>{document.documentElement.dataset.hand=hand;localStorage.setItem(preferenceKey,hand);},[hand,preferenceKey]);

  useEffect(() => {
    setMobileOpen(false);
  }, [activeTab]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navItems: NavItem[] = [
    {id:'work',label:'İşlerim',description:'Bildirimler, uygunsuzluk ve onay',icon:<ClipboardCheck className="h-4 w-4"/>,allowedRoles:['admin','quality_engineer','operator','auditor'],group:'Operasyon'},
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
      label: 'Kullanıcılar',
      description: 'Ekip ve roller',
      icon: <Users className="h-4 w-4" />,
      allowedRoles: ['admin'],
      group: 'Yönetim',
    },
  ];

  const visibleItems = navItems.filter(item => item.allowedRoles.includes(currentUser.role));
  const groups: NavItem['group'][] = ['Operasyon', 'Kalite Yönetimi', 'Yönetim'];

  const initials = currentUser.name
    .split(' ')
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

  const sidebar = (
    <aside className="flex h-full w-[280px] flex-col border-r border-slate-800 bg-slate-950 text-slate-100 shadow-2xl lg:shadow-none">
      <div className="flex h-20 items-center justify-between border-b border-slate-800 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950/40">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-black tracking-tight text-white">Ritim Quality</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Kalite Yönetimi</div>
          </div>
        </div>
        <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white lg:hidden" aria-label="Menüyü kapat">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="border-b border-slate-800 px-4 py-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="flex items-start gap-2.5">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-slate-100" title={company.name}>{company.name}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">On-Premise Kurulum</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2"><label className="text-xs">Kullanılan el<select aria-label="Kullanılan el" value={hand} onChange={e=>setHand(e.target.value as 'left'|'right')} className="ml-3 rounded-lg bg-slate-800 p-2"><option value="right">Sağ el</option><option value="left">Sol el</option></select></label></div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map(group => {
          const groupItems = visibleItems.filter(item => item.group === group);
          if (!groupItems.length) return null;
          return (
            <div key={group} className="mb-5 last:mb-0">
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">{group}</div>
              <div className="space-y-1">
                {groupItems.map(item => {
                  const active = item.id === activeTab;
                  return (
                    <button
                      key={item.id}
                      id={`nav-tab-${item.id}`}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white/15 text-white' : 'bg-slate-900 text-slate-500 group-hover:bg-slate-800 group-hover:text-blue-400'}`}>{item.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">{item.label}</span>
                        <span className={`block truncate text-[10px] ${active ? 'text-blue-100' : 'text-slate-600 group-hover:text-slate-500'}`}>{item.description}</span>
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

      <div className="border-t border-slate-800 p-3">
        <button type="button" hidden={currentUser.role!=='admin'} onClick={onOpenBackupModal} className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-900 hover:text-slate-200">
          <Database className="h-4 w-4" />
          <span className="flex-1 text-left">Veri Yedeği</span>
          <Settings2 className="h-3.5 w-3.5" />
        </button>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
          <div className="flex items-center gap-2.5">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-black text-blue-300">{initials}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-slate-100">{currentUser.name}</div>
              <div className="truncate text-[10px] text-slate-500">{roleLabels[currentUser.role]}</div>
            </div>
            <button type="button" onClick={onLogout} className="rounded-lg p-2 text-slate-600 transition hover:bg-red-950/60 hover:text-red-400" title="Oturumu kapat" aria-label="Oturumu kapat">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
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
            <div className="truncate text-sm font-black text-slate-900">{activeItem?.label}</div>
            <div className="truncate text-[10px] text-slate-500">Ritim Quality</div>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-black text-white">{initials}</div>
      </div>

      <div className="fixed inset-y-0 left-0 z-50 hidden lg:block">{sidebar}</div>

      <nav aria-label="Mobil gezinme" className="quality-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white px-2 pt-1 text-slate-800 lg:hidden" style={{paddingBottom:'max(.5rem, env(safe-area-inset-bottom))'}}>
        {visibleItems.filter(item=>['operator','logs','work','spc'].includes(item.id)).slice(0,3).map(item=><button key={item.id} type="button" onClick={()=>onTabChange(item.id)} aria-current={activeTab===item.id?'page':undefined} className={'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs '+(activeTab===item.id?'bg-blue-100 text-blue-800 font-bold':'')}>{item.icon}<span>{item.id==='operator'?'Ölçüm':item.id==='logs'?'Kayıtlar':item.id==='work'?'İşlerim':'SPC'}</span></button>)}
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
