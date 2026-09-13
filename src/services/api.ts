import { pendingStore, sessionScope } from './pendingInspections';
import type { BillingPeriod, SubscriptionPlanId } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'qualitrack_access_token';

export interface AuthInput { workspace: string; email: string; password: string; }
export interface RegisterInput extends AuthInput { companyName: string; name: string; }

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
export const SaasApi = {
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
    localStorage.removeItem(TOKEN_KEY); for(const key of Object.keys(localStorage)) if(key.startsWith('qualitrack_') && !key.includes(':pending:') && !key.includes(':draft:') && !key.includes(':preferences:') && key !== TOKEN_KEY) localStorage.removeItem(key); },
  login: async (input: AuthInput) => {
    const result = await request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(input) });
    localStorage.setItem(TOKEN_KEY, result.token);
    return result;
  },
  register: async (input: RegisterInput) => {
    const result = await request<{ token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(input) });
    localStorage.setItem(TOKEN_KEY, result.token);
    return result;
  },
  bootstrap: () => request<{
    company: Record<string, unknown>; users: Record<string, unknown>[];
    products: unknown[]; controlPlans: unknown[]; inspectionLogs: unknown[];
    currentUserId: string;
    usage: { control_plans: number; users: number; monthly_measurements: number };
  }>('/bootstrap'),
  saveProduct: (value: { id: string }) => request(`/products/${encodeURIComponent(value.id)}`, { method: 'PUT', body: JSON.stringify(value) }),
  deleteProduct: (id: string) => request(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  saveControlPlan: (value: { id: string }) => request(`/control-plans/${encodeURIComponent(value.id)}`, { method: 'PUT', body: JSON.stringify(value) }),
  deleteControlPlan: (id: string) => request(`/control-plans/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  saveInspectionLog: (value: { id: string }) => pending.save(value, () => request('/inspection-logs', { method: 'POST', body: JSON.stringify(value) })),
  uploadEvidence: (value: { fileName: string; mimeType: string; kind: 'photo' | 'video' | 'file'; dataUrl: string }) =>
    request<{ id: string; fileName: string; mimeType: string; kind: 'photo' | 'video' | 'file'; url: string; createdAt: string }>('/media', { method: 'POST', body: JSON.stringify(value) }),
  uploadFile: async (file: File) => {
    const config = await request<{provider:'local'|'supabase';maxBytes:number}>('/media/config');
    if (!file.size || file.size > config.maxBytes) throw new Error(`Dosya en fazla ${config.maxBytes / 1024 / 1024} MB olabilir.`);
    if (config.provider === 'local') {
      const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
      return SaasApi.uploadEvidence({fileName:file.name,mimeType:file.type,kind:file.type.startsWith('image/')?'photo':file.type.startsWith('video/')?'video':'file',dataUrl});
    }
    const upload = await request<{id:string;uploadUrl:string}>('/media/uploads',{method:'POST',body:JSON.stringify({fileName:file.name,mimeType:file.type,size:file.size})});
    // The bytes go directly to Supabase, avoiding Vercel's request-size limit.
    const body = new FormData();body.append('cacheControl','3600');body.append('',file);
    const result=await fetch(upload.uploadUrl,{method:'PUT',headers:{'x-upsert':'false'},body});
    if(!result.ok)throw new Error('Dosya depolamaya yüklenemedi. Yeniden deneyin.');
    return request<{id:string;fileName:string;mimeType:string;kind:'photo'|'video'|'file';url:string;createdAt:string}>(`/media/uploads/${encodeURIComponent(upload.id)}/complete`,{method:'POST'});
  },
  mediaUrl: async (id: string) => {
    const token=localStorage.getItem(TOKEN_KEY);
    const response=await fetch(`${API_URL}/media/${encodeURIComponent(id)}`,{headers:token?{Authorization:`Bearer ${token}`}:{}});
    if(!response.ok)throw new ApiError('Dosya açılamadı.',response.status);
    if(response.headers.get('Content-Type')?.includes('application/json'))return (await response.json() as {downloadUrl:string}).downloadUrl;
    return URL.createObjectURL(await response.blob());
  },
  openEvidence: async (id: string) => {
    const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
    try{const url=await SaasApi.mediaUrl(id);if(popup)popup.location.replace(url);else window.location.assign(url);if(url.startsWith('blob:'))setTimeout(()=>URL.revokeObjectURL(url),60_000);}
    catch(error){popup?.close();alert(error instanceof Error?error.message:'Dosya açılamadı.');}
  },
  voidInspectionLog: (id: string, reason: string) => request(`/inspection-logs/${encodeURIComponent(id)}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
  saveCompany: (value: unknown) => request('/company', { method: 'PATCH', body: JSON.stringify(value) }),
  saveUser: (value: { id: string; pinCode?: string }) => request('/users', { method: 'POST', body: JSON.stringify({ ...value, password: value.pinCode }) }),
  deleteUser: (id: string) => request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  checkout: async (planId: SubscriptionPlanId, billingPeriod: BillingPeriod) => {
    const result = await request<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ planId, billingPeriod }) });
    window.location.assign(result.url);
  },
  openBillingPortal: async () => {
    const result = await request<{ url: string }>('/billing/portal', { method: 'POST' });
    window.location.assign(result.url);
  },
};
