import {RoleMatrix} from './RoleMatrix';
import {Badge, Button, DataTable, Field, FilterBar, FormSection, IconButton, Input, MetricCard, Modal, PageActions, Select, SearchInput, StatusBadge} from './ui';
import React, { useMemo, useState } from 'react';
import { Edit3, Eye, HardHat, LogIn, Shield, Sparkles, Trash2, UserPlus } from 'lucide-react';
import { User, UserRole } from '../types';

interface UserManagerProps {
  users: User[];
  currentUser: User;
  onUserSelect: (userId: string) => void;
  onSaveUser: (user: User) => void | Promise<boolean | void>;
  onDeleteUser: (userId: string) => void;
}

const ROLE_INFO: Record<UserRole, { label: string; icon: React.ReactNode }> = {
  admin: {
    label: 'Yönetici',
    icon: <Shield className="h-4 w-4" />,
  },
  quality_engineer: {
    label: 'Kalite Uzmanı',
    icon: <Sparkles className="h-4 w-4" />,
  },
  operator: {
    label: 'Operatör',
    icon: <HardHat className="h-4 w-4" />,
  },
  auditor: {
    label: 'Denetçi',
    icon: <Eye className="h-4 w-4" />,
  },
};

const emptyUser = (): Partial<User> => ({
  id: `usr-${Date.now()}`,
  name: '', email: '', role: 'operator', department: '', stationOrMachine: '',
  status: 'active', lastLogin: 'Henüz giriş yapmadı', pinCode: '',
});

export const UserManager: React.FC<UserManagerProps> = ({ users, currentUser, onUserSelect, onSaveUser, onDeleteUser }) => {
  const [saving,setSaving]=useState(false);
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
      return (!query || searchable.includes(query))
        && (roleFilter === 'all' || user.role === roleFilter)
        && (statusFilter === 'all' || user.status === statusFilter);
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const openCreate = () => { setEditingUser(null); setFormData(emptyUser()); setIsFormOpen(true); };
  const openEdit = (user: User) => { setEditingUser(user); setFormData({ ...user }); setIsFormOpen(true); };
  const closeForm = () => { setIsFormOpen(false); setEditingUser(null); };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name?.trim() || !formData.email?.trim()) return;
    if(saving)return;
    setSaving(true);
    try {
    const saved = await onSaveUser({
      id: formData.id || `usr-${Date.now()}`,
      name: formData.name.trim(), email: formData.email.trim(), role: formData.role || 'operator',
      department: formData.department?.trim() || 'Genel', stationOrMachine: formData.stationOrMachine?.trim() || '',
      status: formData.status || 'active', lastLogin: formData.lastLogin || 'Henüz giriş yapmadı',
      pinCode: formData.pinCode?.trim() || undefined, avatarUrl: formData.avatarUrl,
    });
    if(saved!==false)closeForm();
    } finally {setSaving(false);}
  };

  const deleteUser = (user: User) => {
    if (user.id === currentUser.id || users.length <= 1) return;
    if (window.confirm(`${user.name} adlı kullanıcı silinsin mi?`)) onDeleteUser(user.id);
  };

  return <div className="space-y-5">
    <div className="rq-metrics-row"><MetricCard label="Kullanıcı" value={users.length}/><MetricCard label="Aktif hesap" value={users.filter(user=>user.status==='active').length} tone="success"/><MetricCard label="Pasif hesap" value={users.filter(user=>user.status!=='active').length}/></div>
    <FilterBar><SearchInput value={searchTerm} onChange={event=>setSearchTerm(event.target.value)} placeholder="İsim, e-posta veya bölüm ara" aria-label="Kullanıcı ara"/><Select value={roleFilter} onChange={event=>setRoleFilter(event.target.value as 'all'|UserRole)} aria-label="Role göre filtrele"><option value="all">Tüm roller</option>{(Object.keys(ROLE_INFO) as UserRole[]).map(role=><option key={role} value={role}>{ROLE_INFO[role].label}</option>)}</Select><Select value={statusFilter} onChange={event=>setStatusFilter(event.target.value as 'all'|User['status'])} aria-label="Duruma göre filtrele"><option value="all">Tüm durumlar</option><option value="active">Aktif</option><option value="suspended">Pasif</option></Select><Button variant="primary" onClick={openCreate}><UserPlus size={16}/>Kullanıcı ekle</Button></FilterBar>
    <DataTable label="Kullanıcılar ve hesap erişimi"><thead><tr><th>Kullanıcı / e-posta</th><th>Rol</th><th>Bölüm / istasyon</th><th>Durum</th><th>Son giriş</th><th>İşlemler</th></tr></thead><tbody>{filteredUsers.map(user=>{const role=ROLE_INFO[user.role];const isCurrent=user.id===currentUser.id;return <tr key={user.id}><td><strong>{user.name}</strong>{isCurrent&&<Badge tone="info">Siz</Badge>}<small>{user.email}</small></td><td><Badge>{role.icon}{role.label}</Badge></td><td>{user.department||'Genel'}<small className="rq-technical">{user.stationOrMachine||'İstasyon atanmamış'}</small></td><td><StatusBadge status={user.status} label={user.status==='active'?'Aktif':'Pasif'}/></td><td className="rq-technical">{user.lastLogin||'—'}</td><td><PageActions>{!isCurrent&&user.status==='active'&&<IconButton label="Bu kullanıcıya geç" onClick={()=>onUserSelect(user.id)}><LogIn size={16}/></IconButton>}<IconButton label="Düzenle" onClick={()=>openEdit(user)}><Edit3 size={16}/></IconButton><IconButton label={isCurrent?'Aktif kullanıcı silinemez':'Sil'} variant="danger" disabled={isCurrent||users.length<=1} onClick={()=>deleteUser(user)}><Trash2 size={16}/></IconButton></PageActions></td></tr>;})}{!filteredUsers.length&&<tr><td colSpan={6}>Aramanızla eşleşen kullanıcı bulunamadı.</td></tr>}</tbody></DataTable>
    <p className="rq-helper">{filteredUsers.length} kullanıcı gösteriliyor</p>
    <RoleMatrix/>
    <Modal open={isFormOpen} title={editingUser?'Kullanıcıyı düzenle':'Yeni kullanıcı'} onClose={closeForm} busy={saving}>
      <form onSubmit={submitForm} className="space-y-5"><fieldset disabled={saving} className="space-y-5">
        <FormSection title="Kimlik bilgileri"><Field label="Ad soyad"><Input autoFocus required value={formData.name||''} onChange={event=>setFormData({...formData,name:event.target.value})}/></Field><Field label="E-posta"><Input required type="email" value={formData.email||''} onChange={event=>setFormData({...formData,email:event.target.value})}/></Field></FormSection>
        <FormSection title="Rol ve hesap"><Field label="Rol"><Select value={formData.role||'operator'} onChange={event=>setFormData({...formData,role:event.target.value as UserRole})}>{(Object.keys(ROLE_INFO) as UserRole[]).map(role=><option key={role} value={role}>{ROLE_INFO[role].label}</option>)}</Select></Field><Field label="Hesap durumu"><Select value={formData.status||'active'} onChange={event=>setFormData({...formData,status:event.target.value as User['status']})}><option value="active">Aktif</option><option value="suspended">Pasif</option></Select></Field><Field label="Bölüm"><Input value={formData.department||''} onChange={event=>setFormData({...formData,department:event.target.value})}/></Field><Field label="İstasyon / Tezgâh"><Input value={formData.stationOrMachine||''} onChange={event=>setFormData({...formData,stationOrMachine:event.target.value})}/></Field></FormSection>
        <Field label="Geçici şifre" hint="Yeni kullanıcı için en az 10 karakter."><Input type="password" autoComplete="new-password" required={!editingUser} minLength={10} maxLength={128} value={formData.pinCode||''} onChange={event=>setFormData({...formData,pinCode:event.target.value})}/></Field>
        <PageActions><Button onClick={closeForm}>İptal</Button><Button type="submit" variant="primary" loading={saving}>{editingUser?'Kaydet':'Kullanıcı oluştur'}</Button></PageActions>
      </fieldset></form>
    </Modal>
  </div>;
};
