import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Edit3, Eye, HardHat, Search, Shield, Sparkles, Trash2, UserPlus, Users, X } from 'lucide-react';
import { User, UserRole } from '../types';

interface UserManagerProps {
  users: User[];
  currentUser: User;
  onSaveUser: (user: User) => void | Promise<boolean | void>;
  onDeleteUser: (userId: string) => void;
}

const ROLE_INFO: Record<UserRole, { label: string; description: string; className: string; icon: React.ReactNode }> = {
  admin: { label: 'Yönetici', description: 'Kullanıcıları, kurum ayarlarını ve tüm kalite kayıtlarını yönetir.', className: 'border-violet-200 bg-violet-50 text-violet-700', icon: <Shield className="h-4 w-4" /> },
  quality_engineer: { label: 'Kalite Mühendisi', description: 'Kontrol planlarını, ölçümleri ve SPC analizlerini yönetir.', className: 'border-blue-200 bg-blue-50 text-blue-700', icon: <Sparkles className="h-4 w-4" /> },
  operator: { label: 'Operatör', description: 'Atandığı istasyonda ölçüm girişi yapar ve sonuçları görüntüler.', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: <HardHat className="h-4 w-4" /> },
  auditor: { label: 'Denetçi', description: 'Kalite kayıtlarını, raporları ve izlenebilirlik verilerini inceler.', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: <Eye className="h-4 w-4" /> },
};

const emptyUser = (): Partial<User> => ({
  id: `usr-${Date.now()}`, name: '', email: '', role: 'operator', department: '', stationOrMachine: '',
  status: 'active', lastLogin: 'Henüz giriş yapmadı', pinCode: '',
});

export const UserManager: React.FC<UserManagerProps> = ({ users, currentUser, onSaveUser, onDeleteUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | User['status']>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>(emptyUser());
  const [isFormOpen, setIsFormOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return users.filter((user) => {
      const searchable = [user.name, user.email, user.department, user.stationOrMachine].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
      return (!query || searchable.includes(query)) && (roleFilter === 'all' || user.role === roleFilter) && (statusFilter === 'all' || user.status === statusFilter);
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const openCreate = () => { setEditingUser(null); setFormData(emptyUser()); setIsFormOpen(true); };
  const openEdit = (user: User) => { setEditingUser(user); setFormData({ ...user, pinCode: '' }); setIsFormOpen(true); };
  const closeForm = () => { setIsFormOpen(false); setEditingUser(null); };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name?.trim() || !formData.email?.trim() || (!editingUser && !formData.pinCode)) return;
    const saved = await onSaveUser({
      id: formData.id || `usr-${Date.now()}`,
      name: formData.name.trim(), email: formData.email.trim(), role: formData.role || 'operator',
      department: formData.department?.trim() || 'Genel', stationOrMachine: formData.stationOrMachine?.trim() || '',
      status: formData.status || 'active', lastLogin: formData.lastLogin || 'Henüz giriş yapmadı',
      pinCode: formData.pinCode?.trim() || undefined, avatarUrl: formData.avatarUrl,
    });
    if(saved!==false)closeForm();
  };

  const deleteUser = (user: User) => {
    if (user.id === currentUser.id || users.length <= 1) return;
    if (window.confirm(`${user.name} adlı kullanıcı silinsin mi?`)) onDeleteUser(user.id);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /><h2 className="text-lg font-black text-slate-900">Kullanıcı yönetimi</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{users.length}</span></div>
            <p className="mt-1 text-sm text-slate-500">Kullanıcıları, rollerini ve hesap durumlarını tek ekrandan yönetin.</p>
          </div>
          <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"><UserPlus className="h-4 w-4" />Kullanıcı ekle</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(260px,1fr)_200px_170px]">
          <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="İsim, e-posta veya bölüm ara" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'all' | UserRole)} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500" aria-label="Role göre filtrele"><option value="all">Tüm roller</option>{(Object.keys(ROLE_INFO) as UserRole[]).map((role) => <option key={role} value={role}>{ROLE_INFO[role].label}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | User['status'])} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500" aria-label="Duruma göre filtrele"><option value="all">Tüm durumlar</option><option value="active">Aktif</option><option value="suspended">Pasif</option></select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Kullanıcı</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Bölüm / İstasyon</th><th className="px-4 py-3">Durum</th><th className="px-5 py-3 text-right">İşlemler</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const role = ROLE_INFO[user.role]; const isCurrent = user.id === currentUser.id;
                return (
                  <tr key={user.id} className="text-sm text-slate-700 transition hover:bg-slate-50/80">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-black text-slate-600">{user.name.slice(0, 2).toLocaleUpperCase('tr-TR')}</div><div className="min-w-0"><div className="flex items-center gap-2 font-bold text-slate-900"><span className="truncate">{user.name}</span>{isCurrent && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Siz</span>}</div><div className="truncate text-xs text-slate-500">{user.email}</div></div></div></td>
                    <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${role.className}`}>{role.icon}{role.label}</span></td>
                    <td className="px-4 py-4"><div className="font-semibold text-slate-700">{user.department || 'Genel'}</div><div className="mt-0.5 text-xs text-slate-500">{user.stationOrMachine || 'İstasyon atanmamış'}</div></td>
                    <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 text-xs font-bold ${user.status === 'active' ? 'text-emerald-700' : 'text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />{user.status === 'active' ? 'Aktif' : 'Pasif'}</span></td>
                    <td className="px-5 py-4"><div className="flex items-center justify-end gap-1"><button type="button" onClick={() => openEdit(user)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Düzenle"><Edit3 className="h-4 w-4" /></button><button type="button" onClick={() => deleteUser(user)} disabled={isCurrent || users.length <= 1} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30" title={isCurrent ? 'Aktif kullanıcı silinemez' : 'Sil'}><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && <div className="px-5 py-12 text-center text-sm text-slate-500">Aramanızla eşleşen kullanıcı bulunamadı.</div>}
        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{filteredUsers.length} kullanıcı gösteriliyor</div>
      </section>

      <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-bold text-slate-800"><span className="flex items-center gap-2"><Shield className="h-4 w-4 text-blue-600" />Roller ne yapabilir?</span><ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" /></summary>
        <div className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(ROLE_INFO) as UserRole[]).map((roleKey) => { const role = ROLE_INFO[roleKey]; return <div key={roleKey} className="rounded-xl border border-slate-200 p-4"><div className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-bold ${role.className}`}>{role.icon}{role.label}</div><p className="mt-3 text-xs leading-5 text-slate-500">{role.description}</p></div>; })}</div>
      </details>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && closeForm()}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"><div><h3 className="font-black text-slate-900">{editingUser ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı'}</h3><p className="mt-0.5 text-xs text-slate-500">Temel bilgileri ve erişim rolünü belirleyin.</p></div><button type="button" onClick={closeForm} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Kapat"><X className="h-5 w-5" /></button></div>
            <form onSubmit={submitForm} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700 sm:col-span-2">Ad soyad<input autoFocus required type="text" value={formData.name || ''} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Örn. Ayşe Yılmaz" /></label>
                <label className="text-xs font-bold text-slate-700 sm:col-span-2">E-posta<input required type="email" value={formData.email || ''} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="ayse@firma.com" /></label>
                <label className="text-xs font-bold text-slate-700">Rol<select value={formData.role || 'operator'} onChange={(event) => setFormData({ ...formData, role: event.target.value as UserRole })} className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500">{(Object.keys(ROLE_INFO) as UserRole[]).map((role) => <option key={role} value={role}>{ROLE_INFO[role].label}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700">Hesap durumu<select value={formData.status || 'active'} onChange={(event) => setFormData({ ...formData, status: event.target.value as User['status'] })} className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"><option value="active">Aktif</option><option value="suspended">Pasif</option></select></label>
                <label className="text-xs font-bold text-slate-700">Bölüm<input type="text" value={formData.department || ''} onChange={(event) => setFormData({ ...formData, department: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500" placeholder="Örn. Kalite" /></label>
                <label className="text-xs font-bold text-slate-700">İstasyon / Tezgâh<input type="text" value={formData.stationOrMachine || ''} onChange={(event) => setFormData({ ...formData, stationOrMachine: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500" placeholder="Örn. CNC-02" /></label>
                <label className="text-xs font-bold text-slate-700 sm:col-span-2">{editingUser ? 'Yeni parola' : 'Geçici parola'} <span className="font-normal text-slate-400">{editingUser && '(değişmeyecekse boş bırakın)'}</span><input required={!editingUser} type="password" autoComplete="new-password" minLength={10} maxLength={128} value={formData.pinCode || ''} onChange={(event) => setFormData({ ...formData, pinCode: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500" placeholder="En az 10 karakter" /></label>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-5"><button type="button" onClick={closeForm} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">İptal</button><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><CheckCircle2 className="h-4 w-4" />{editingUser ? 'Kaydet' : 'Kullanıcı oluştur'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
