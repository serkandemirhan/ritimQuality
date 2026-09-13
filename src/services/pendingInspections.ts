import type { InspectionLog } from '../types';

export interface PendingInspection { log: InspectionLog; error?: string; }
export function sessionScope(tokenKey: string): string {
  const token = localStorage.getItem(tokenKey);
  if (!token) throw new Error('Oturum açmanız gerekiyor.');
  const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const claims = JSON.parse(atob(part));
  return `${claims.tenantId}:${claims.userId}`;
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
        localStorage.setItem(storageKey, JSON.stringify(current.map(item => item.log.id === log.id ? {...item,error:error instanceof Error ? error.message : 'Bağlantı kurulamadı.'} : item))); notify();
        throw error;
      }
    },
  };
}
