import type {UserRole,ControlPlan,MeasurementSource} from '../types';
export const ROLE_LABELS:Record<UserRole,string>={admin:'Yönetici',quality_engineer:'Kalite Uzmanı',operator:'Operatör',auditor:'Denetçi'};
export const PLAN_STATUS_LABELS:Record<ControlPlan['status'],string>={draft:'Taslak',active:'Aktif',archived:'Arşiv'};
export const SOURCE_LABELS:Record<MeasurementSource,string>={manual:'Manuel',gauge:'Ölçüm cihazı',import:'Dosyadan aktarım',cmm:'CMM'};
