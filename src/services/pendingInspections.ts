import type { InspectionLog } from '../types';

export interface PendingInspection { log: InspectionLog; error?: string; }
export function sessionScope(tokenKey: string): string {
  const token = localStorage.getItem(tokenKey);
  if (!token) throw new Error('Oturum açmanız gerekiyor.');
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error();
    const part = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part));
    if (typeof claims.tenantId !== 'string' || !claims.tenantId ||
        typeof claims.userId !== 'string' || !claims.userId ||
        (claims.exp !== undefined && (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()))) throw new Error();
    return `${claims.tenantId}:${claims.userId}`;
  } catch {
    throw new Error('Oturumunuz geçersiz veya süresi dolmuş. Lütfen yeniden giriş yapın.');
  }
}
export function hasValidSession(tokenKey: string): boolean {
  try { sessionScope(tokenKey); return true; } catch { return false; }
}
export function pendingStore(tokenKey: string) {
  const key = () => `${tokenKey}:pending:${sessionScope(tokenKey)}`;
  const notify = () => window.dispatchEvent(new Event('quality-pending-changed'));
  const list = (): PendingInspection[] => {
    try { return JSON.parse(localStorage.getItem(key()) || '[]'); } catch { return []; }
  };
  return {
    list,
    async save(log: { id: string }, send: () => Promise<unknown>) {
      const storageKey = key();
      const entries = list();
      const previous = entries.find(item => item.log.id === log.id);
      if (previous && JSON.stringify(previous.log) !== JSON.stringify(log)) throw new Error('Bekleyen kayıt değiştirilemez. Önce kayıt gönderimini tamamlayın.');
      if (!previous) entries.push({ log: log as InspectionLog });
      localStorage.setItem(storageKey, JSON.stringify(entries)); notify();
      try {
        const result = await send();
        const current: PendingInspection[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
        localStorage.setItem(storageKey, JSON.stringify(current.filter(item => item.log.id !== log.id))); notify();
        return result;
      } catch (error) {
        const current: PendingInspection[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const rejected=error instanceof Error && (error as Error & {code?:string}).code==='INSPECTION_REJECTED_UNSAVED';
        localStorage.setItem(storageKey, JSON.stringify(rejected ? current.filter(item=>item.log.id!==log.id) : current.map(item => item.log.id === log.id ? {...item,error:error instanceof Error ? error.message : 'Bağlantı kurulamadı.'} : item))); notify();
        throw error;
      }
    },
  };
}
