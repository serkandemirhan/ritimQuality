import { pendingStore, sessionScope } from './pendingInspections';
const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'qualitrack_onprem_access_token';

export interface AuthInput { email: string; password: string; }

class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('qualitrack-auth-expired'));
    }
    throw new ApiError(body.error || 'İstek tamamlanamadı.', response.status, body.code);
  }
  return body as T;
}

const pending = pendingStore(TOKEN_KEY);
export const OnPremApi = {
  pushConfig: () => request('/push/config'),
  subscribePush: (body:unknown) => request('/push/subscriptions',{method:'POST',body:JSON.stringify(body)}),
  unsubscribePush: () => request('/push/subscriptions',{method:'DELETE'}),
  work: () => request('/work'),
  auditLogs: () => request('/audit-logs'),
  updateCase: (id:string,body:unknown) => request('/cases/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(body)}),
  readNotification: (id:number) => request('/notifications/'+id+'/read',{method:'PATCH'}),
  createTask: (body:unknown) => request('/tasks',{method:'POST',body:JSON.stringify(body)}),
  completeTask: (id:string,note:string) => request('/tasks/'+encodeURIComponent(id)+'/complete',{method:'POST',body:JSON.stringify({note})}),
  reviewInspection: (id:string,status:'approved'|'rejected',reason:string) => request('/approvals/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({status,reason})}),
  organization: () => request('/organization'),
  createOrganization: (body:unknown) => request('/organization',{method:'POST',body:JSON.stringify(body)}),
  scope: () => sessionScope(TOKEN_KEY),
  pendingInspections: pending.list,
  hasSession: () => Boolean(localStorage.getItem(TOKEN_KEY)),
  logout: async () => {
    try { await request('/push/subscriptions',{method:'DELETE'}); const registration=await navigator.serviceWorker?.getRegistration();await (await registration?.pushManager.getSubscription())?.unsubscribe(); } catch { /* The local session must still be closed when offline. */ }
    localStorage.removeItem(TOKEN_KEY); for(const key of Object.keys(localStorage)) if(key.startsWith('qualitrack_onprem_') && !key.includes(':pending:') && !key.includes(':draft:') && !key.includes(':preferences:') && key !== TOKEN_KEY) localStorage.removeItem(key); },
  login: async (input: AuthInput) => {
    const result = await request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(input) });
    localStorage.setItem(TOKEN_KEY, result.token);
    return result;
  },
  bootstrap: () => request<{
    company: Record<string, unknown>; users: Record<string, unknown>[];
    products: unknown[]; controlPlans: unknown[]; inspectionLogs: unknown[];
    currentUserId: string;
  }>('/bootstrap'),
  saveProduct: (value: { id: string }) => request(`/products/${encodeURIComponent(value.id)}`, { method: 'PUT', body: JSON.stringify(value) }),
  deleteProduct: (id: string) => request(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  saveControlPlan: (value: { id: string }) => request(`/control-plans/${encodeURIComponent(value.id)}`, { method: 'PUT', body: JSON.stringify(value) }),
  deleteControlPlan: (id: string) => request(`/control-plans/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  saveInspectionLog: (value: { id: string }) => pending.save(value, () => request('/inspection-logs', { method: 'POST', body: JSON.stringify(value) })),
  uploadEvidence: (value: { fileName: string; mimeType: string; kind: 'photo' | 'video' | 'file'; dataUrl: string }) =>
    request<{ id: string; fileName: string; mimeType: string; kind: 'photo' | 'video' | 'file'; url: string; createdAt: string }>('/media', { method: 'POST', body: JSON.stringify(value) }),
  openEvidence: async (id: string) => {
    const token=localStorage.getItem(TOKEN_KEY);
    const response=await fetch(`${API_URL}/media/${encodeURIComponent(id)}`,{headers:token?{Authorization:`Bearer ${token}`}:{}});
    if(!response.ok) throw new ApiError('Kanıt dosyası açılamadı.',response.status);
    const url=URL.createObjectURL(await response.blob()); window.open(url,'_blank','noopener,noreferrer'); setTimeout(()=>URL.revokeObjectURL(url),60_000);
  },
  voidInspectionLog: (id: string, reason: string) => request(`/inspection-logs/${encodeURIComponent(id)}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
  saveCompany: (value: unknown) => request('/company', { method: 'PATCH', body: JSON.stringify(value) }),
  saveUser: (value: { id: string; pinCode?: string }) => request('/users', { method: 'POST', body: JSON.stringify({ ...value, password: value.pinCode }) }),
  deleteUser: (id: string) => request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
