import { Product, ControlPlan, InspectionLog, User, TenantCompany, SubscriptionPlanId } from '../types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_CONTROL_PLANS, 
  generateRealisticInspectionLogs, 
  INITIAL_USERS, 
  INITIAL_COMPANY
} from '../data/mockData';
import { SaasApi } from './api';

const STORAGE_KEYS = {
  PRODUCTS: 'qualitrack_products_v1',
  CONTROL_PLANS: 'qualitrack_control_plans_v1',
  INSPECTION_LOGS: 'qualitrack_inspection_logs_v1',
  APP_SETTINGS: 'qualitrack_settings_v1',
  USERS: 'qualitrack_users_v1',
  CURRENT_USER_ID: 'qualitrack_current_user_id_v1',
  COMPANY: 'qualitrack_company_v1',
};

export interface AppSettings {
  companyName: string;
  facilityName: string;
  enableSoundAlerts: boolean;
  theme: 'dark' | 'light';
  autoAdvanceInput: boolean;
  defaultSampleCount: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  companyName: 'Demirhan Hassas Makina & Kalıp A.Ş.',
  facilityName: 'Bursa Organize Sanayi Fabrikası - Kalite Laboratuvarı',
  enableSoundAlerts: true,
  theme: 'dark',
  autoAdvanceInput: true,
  defaultSampleCount: 5,
};


export const StorageService = {
  hydrateFromApi: async (): Promise<void> => {
    if (!SaasApi.hasSession()) return;
    const data = await SaasApi.bootstrap();
    const raw = data.company as Record<string, unknown>;
    const company: TenantCompany = {
      id: String(raw.id), name: String(raw.name || ''), legalName: String(raw.legal_name || raw.name || ''),
      taxNumber: String(raw.tax_number || ''), taxOffice: String(raw.tax_office || ''), industry: String(raw.industry || ''),
      facilityLocation: String(raw.facility_location || ''), contactEmail: String(raw.contact_email || ''),
      contactPhone: String(raw.contact_phone || ''), planId: raw.plan_id as SubscriptionPlanId,
      subscriptionStatus: raw.subscription_status as TenantCompany['subscriptionStatus'],
      subscriptionRenewsAt: raw.subscription_renews_at ? String(raw.subscription_renews_at).slice(0, 10) : String(raw.trial_ends_at || '').slice(0, 10),
      billingPeriod: raw.billing_period as TenantCompany['billingPeriod'],
      licenseKey: `QT-${String(raw.id).slice(0, 8).toUpperCase()}`,
      createdAt: String(raw.created_at || new Date().toISOString()),
    };
    const users: User[] = data.users.map(rawUser => ({
      id: String(rawUser.id), name: String(rawUser.name), email: String(rawUser.email), role: rawUser.role as User['role'],
      department: String(rawUser.department || ''), stationOrMachine: rawUser.station_or_machine ? String(rawUser.station_or_machine) : undefined,
      status: rawUser.status as User['status'], lastLogin: String(rawUser.last_login_at || ''),
    }));
    localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(company));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(data.products));
    localStorage.setItem(STORAGE_KEYS.CONTROL_PLANS, JSON.stringify(data.controlPlans));
    localStorage.setItem(STORAGE_KEYS.INSPECTION_LOGS, JSON.stringify(data.inspectionLogs));
    const currentUserId = String(data.currentUserId || '');
    if (currentUserId) localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, currentUserId);
  },

  reportSyncError: (error: unknown): void => {
    const message = error instanceof Error ? error.message : 'Sunucu senkronizasyonu başarısız.';
    window.dispatchEvent(new CustomEvent('qualitrack-sync-error', { detail: message }));
  },

  // Initialize storage with sample data if empty
  init: () => {
    if (!localStorage.getItem(STORAGE_KEYS.APP_SETTINGS)) localStorage.setItem(STORAGE_KEYS.APP_SETTINGS,JSON.stringify(DEFAULT_SETTINGS));
  },

  // Users & Team Management
  getUsers: (): User[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveUser: async (user: User): Promise<void> => {
    if (!SaasApi.hasSession()) throw new Error('Oturum açmanız gerekiyor.');
    await SaasApi.saveUser(user);
    user = {...user, pinCode:undefined};
    const users = StorageService.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

  },

  deleteUser: async (userId: string): Promise<void> => {
    if (!SaasApi.hasSession()) throw new Error('Oturum açmanız gerekiyor.');
    await SaasApi.deleteUser(userId);
    const users = StorageService.getUsers().filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

  },

  getCurrentUser: (): User => {
    const users = StorageService.getUsers();
    const curId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    return users.find(u => u.id === curId) || users[0] || INITIAL_USERS[0];
  },

  setCurrentUser: (userId: string): void => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, userId);
  },

  // Company Tenant & Subscription
  getCompany: (): TenantCompany => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COMPANY);
      return data ? JSON.parse(data) : INITIAL_COMPANY;
    } catch {
      return INITIAL_COMPANY;
    }
  },

  saveCompany: async (company: TenantCompany): Promise<void> => {
    if (!SaasApi.hasSession()) throw new Error('Oturum açmanız gerekiyor.');
    await SaasApi.saveCompany(company);
    localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(company));

  },

  // Products
  getProducts: (): Product[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveProduct: async (product: Product): Promise<void> => {
    if (!SaasApi.hasSession()) throw new Error('Oturum açmanız gerekiyor.');
    await SaasApi.saveProduct(product);
    const products = StorageService.getProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index >= 0) {
      products[index] = { ...product, updatedAt: new Date().toISOString() };
    } else {
      products.unshift({
        ...product,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));

  },

  deleteProduct: async (productId: string): Promise<void> => {
    if (!SaasApi.hasSession()) throw new Error('Oturum açmanız gerekiyor.');
    await SaasApi.deleteProduct(productId);
    const products = StorageService.getProducts().filter(p => p.id !== productId);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    localStorage.setItem(STORAGE_KEYS.CONTROL_PLANS, JSON.stringify(StorageService.getControlPlans().filter(plan => plan.productId !== productId)));

  },

  // Control Plans
  getControlPlans: (): ControlPlan[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONTROL_PLANS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  getControlPlansByProduct: (productId: string): ControlPlan[] => {
    return StorageService.getControlPlans().filter(cp => cp.productId === productId);
  },

  getActiveControlPlan: (productId: string): ControlPlan | undefined => {
    const plans = StorageService.getControlPlansByProduct(productId);
    return plans.find(cp => cp.isActive && cp.status === 'active');
  },

  saveControlPlan: async (plan: ControlPlan): Promise<void> => {
    if (!SaasApi.hasSession()) throw new Error('Oturum açmanız gerekiyor.');
    await SaasApi.saveControlPlan(plan);
    let plans = StorageService.getControlPlans();
    
    // If this plan is set to active, unset other plans for this product
    if (plan.isActive) {
      plans = plans.map(p => {
        if (p.productId === plan.productId && p.id !== plan.id) {
          return { ...p, isActive: false };
        }
        return p;
      });
    }

    const index = plans.findIndex(p => p.id === plan.id);
    if (index >= 0) {
      plans[index] = { ...plan, updatedAt: new Date().toISOString() };
    } else {
      plans.unshift({
        ...plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    localStorage.setItem(STORAGE_KEYS.CONTROL_PLANS, JSON.stringify(plans));

  },

  setActiveControlPlanVersion: async (planId: string): Promise<void> => {
    const plans = StorageService.getControlPlans();
    const targetPlan = plans.find(p => p.id === planId);
    if (!targetPlan) return;

    const updatedPlans = plans.map(p => {
      if (p.productId === targetPlan.productId) {
        return {
          ...p,
          isActive: p.id === planId,
          status: (p.id === planId ? 'active' : (p.status === 'active' ? 'archived' : p.status)) as 'active' | 'draft' | 'archived',
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });

    if (!SaasApi.hasSession()) throw new Error('Oturum açmanız gerekiyor.');
    await SaasApi.saveControlPlan(updatedPlans.find(plan => plan.id === planId)!);
    localStorage.setItem(STORAGE_KEYS.CONTROL_PLANS, JSON.stringify(updatedPlans));

  },

  deleteControlPlan: async (planId: string): Promise<void> => {
    if (!SaasApi.hasSession()) throw new Error('Oturum açmanız gerekiyor.');
    await SaasApi.deleteControlPlan(planId);
    const plans = StorageService.getControlPlans().filter(p => p.id !== planId);
    localStorage.setItem(STORAGE_KEYS.CONTROL_PLANS, JSON.stringify(plans));

  },

  // Inspection Logs
  getInspectionLogs: (): InspectionLog[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INSPECTION_LOGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveInspectionLog: async (log: InspectionLog): Promise<InspectionLog> => {
    if (!SaasApi.hasSession()) throw new Error('Ölçümü kaydetmek için giriş yapın.');
    const scope = SaasApi.scope();
    const confirmed = await SaasApi.saveInspectionLog(log) as InspectionLog;
    if (SaasApi.scope() !== scope) throw new Error('Oturum değişti. Kayıt önceki hesabınıza kaydedildi.');
    log = confirmed;
    const logs = StorageService.getInspectionLogs();
    const existingIndex = logs.findIndex(item => item.id === log.id);
    if (existingIndex >= 0) logs[existingIndex] = log; else logs.unshift(log);
    localStorage.setItem(STORAGE_KEYS.INSPECTION_LOGS, JSON.stringify(logs));
    return log;
  },

  deleteInspectionLog: async (logId: string): Promise<void> => {
    if (!SaasApi.hasSession()) throw new Error('Oturum açmanız gerekiyor.');
    await SaasApi.voidInspectionLog(logId, 'Ölçüm geçmişi ekranından kullanıcı tarafından geçersiz kılındı.');
    const logs = StorageService.getInspectionLogs().filter(l => l.id !== logId);
    localStorage.setItem(STORAGE_KEYS.INSPECTION_LOGS, JSON.stringify(logs));

  },

  // Settings
  getSettings: (): AppSettings => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings: (settings: AppSettings): void => {
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(settings));
  },

  // Export / Import
  exportAllData: (): string => {
    const payload = {
      version: '2.0-saas',
      exportedAt: new Date().toISOString(),
      company: StorageService.getCompany(),
      users: StorageService.getUsers(),
      products: StorageService.getProducts(),
      controlPlans: StorageService.getControlPlans(),
      inspectionLogs: StorageService.getInspectionLogs(),
      settings: StorageService.getSettings(),
    };
    return JSON.stringify(payload, null, 2);
  },

  importData: (jsonStr: string): boolean => {
    if (!import.meta.env.DEV) throw new Error('Sunucu verileri yalnızca yönetilen veritabanı geri yüklemesiyle değiştirilebilir.');
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.company) localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(parsed.company));
      if (parsed.users) localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(parsed.users));
      if (parsed.products) localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(parsed.products));
      if (parsed.controlPlans) localStorage.setItem(STORAGE_KEYS.CONTROL_PLANS, JSON.stringify(parsed.controlPlans));
      if (parsed.inspectionLogs) localStorage.setItem(STORAGE_KEYS.INSPECTION_LOGS, JSON.stringify(parsed.inspectionLogs));
      if (parsed.settings) localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(parsed.settings));
      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  },

  resetToDemo: (): void => {
    if (!import.meta.env.DEV) throw new Error('Demo sıfırlama üretimde kullanılamaz.');
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
    localStorage.setItem(STORAGE_KEYS.CONTROL_PLANS, JSON.stringify(INITIAL_CONTROL_PLANS));
    localStorage.setItem(STORAGE_KEYS.INSPECTION_LOGS, JSON.stringify(generateRealisticInspectionLogs()));
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(INITIAL_COMPANY));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, INITIAL_USERS[0].id);
  },
};
