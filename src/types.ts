export type CriticalClass = 'critical' | 'major' | 'minor';
export type CharacteristicType = 'numeric' | 'ok_nok' | 'single_select' | 'multi_select';
export type EvidencePolicy = 'none' | 'optional' | 'required_on_fail' | 'always_required';
export type MeasurementSource = 'manual' | 'gauge' | 'import' | 'cmm';

export type MeasurementUnit = 'mm' | 'µm' | '°' | 'N' | 'Ra' | 'kg' | 'bar' | 'adet';

export type MeasurementTool = 
  | 'Dijital Kumpas 0.01'
  | 'Mikrometre 0.001'
  | 'CMM 3D Ölçüm Cihazı'
  | 'Mihengir / Yükseklik Mastarı'
  | 'Profil Projeksiyon / Optik'
  | 'Yüzey Pürüzlülük (Surftest)'
  | 'Geçer / Geçmez Tampon Mastar'
  | 'Torkmetre'
  | 'Sertlik Ölçüm Cihazı (HRC/HB)'
  | 'Diğer Ölçüm Aleti';

export interface PinCoordinate {
  x: number; // 0-100%
  y: number; // 0-100%
}

export interface Characteristic {
  id: string;
  pointNo: number; // 1, 2, 3...
  name: string; // e.g. "Dış Çap (ØA)", "Toplam Boy (L)"
  nominal: number; // e.g. 32.00
  tolUpper: number; // e.g. 0.05 (+0.05)
  tolLower: number; // e.g. -0.05 (-0.05) or 0.05
  usl: number; // nominal + tolUpper
  lsl: number; // nominal - Math.abs(tolLower)
  unit: MeasurementUnit;
  tool: MeasurementTool;
  sampleSize: string; // e.g. "5 Adet"
  frequency: string; // e.g. "100%", "Saat başı", "Parti başı"
  criticalClass: CriticalClass;
  pin: PinCoordinate;
  description?: string;
  type?: CharacteristicType;
  options?: string[];
  rejectedOptions?: string[];
  evidencePolicy?: EvidencePolicy;
}

export interface ControlPlan {
  requiresApproval?: boolean;
  id: string;
  productId: string;
  version: string; // e.g. "v1.0", "v1.1", "v2.0"
  revisionDate: string;
  revisionNote: string;
  isActive: boolean; // Is default active version for operator
  status: 'active' | 'draft' | 'archived';
  author: string;
  approvedBy: string;
  drawingImageUrl: string;
  defaultSampleCount?: number;
  characteristics: Characteristic[];
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  code: string; // Parça Kodu (e.g. "PRD-2024-001")
  name: string; // Parça Adı (e.g. "Otomotiv Şaft Burcu")
  customer: string; // Müşteri / Proje Adı
  revision?: string;
  material: string; // Malzeme (e.g. "AISI 4140 Çelik")
  category: string; // Kategori (e.g. "Talaşlı İmalat", "Plastik Enjeksiyon")
  description: string;
  defaultDrawingUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type MeasurementValue = number | string | string[] | boolean | null;

export interface EvidenceAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  kind: 'photo' | 'video' | 'file';
  url: string;
  createdAt: string;
}

export interface SampleMeasurement {
  sampleIndex: number; // 1, 2, 3, 4, 5
  values: Record<string, MeasurementValue>; // characteristicId -> measured/selected value
  statuses: Record<string, 'pass' | 'warning' | 'fail' | 'empty'>;
  evidence?: Record<string, EvidenceAttachment[]>;
}

export interface InspectionLog {
  controlPlanSnapshot?: ControlPlan;
  operatorUserId?: string;
  id: string;
  sessionCode: string; // e.g. "INS-20260815-001"
  productId: string;
  productCode: string;
  productName: string;
  productRevision?: string;
  controlPlanId: string;
  controlPlanVersion: string;
  operatorName: string;
  lotNumber: string; // Parti / Şarj No
  orderNumber: string; // İş Emri No
  serialNumber?: string;
  machineNo: string; // Tezgah / İstasyon No
  source?: MeasurementSource;
  equipmentId?: string;
  programName?: string;
  originalSourceFile?: EvidenceAttachment;
  sampleCount: number;
  overallStatus: 'pass' | 'warning' | 'fail';
  totalPointsChecked: number;
  failedPointsCount: number;
  warningPointsCount: number;
  timestamp: string;
  notes?: string;
  samples: SampleMeasurement[];
}

export interface SPCMetric {
  characteristicId: string;
  characteristicName: string;
  pointNo: number;
  unit: MeasurementUnit;
  nominal: number;
  usl: number;
  lsl: number;
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  range: number;
  cp: number;
  cpk: number;
  cpu: number;
  cpl: number;
  pp: number;
  ppk: number;
  outOfSpecCount: number;
  outOfSpecRate: number; // Percentage 0 - 100
  capabilityStatus: 'excellent' | 'capable' | 'acceptable' | 'incapable';
  historyValues: {
    timestamp: string;
    lotNumber: string;
    operator: string;
    sampleIndex: number;
    value: number;
    status: 'pass' | 'warning' | 'fail';
  }[];
  histogramBins: {
    rangeLabel: string;
    midpoint: number;
    count: number;
    isOutOfSpec: boolean;
  }[];
  controlLimits: {
    ucl: number; // Upper Control Limit
    lcl: number; // Lower Control Limit
    cl: number;  // Central Line (Mean)
  };
  xbarR: {
    subgroupCount: number;
    subgroupSize: number;
    xbarbar: number;
    rbar: number;
    xbarUcl: number;
    xbarLcl: number;
    rUcl: number;
    rLcl: number;
    points: { timestamp: string; mean: number; range: number }[];
  };
  imr: {
    individualUcl: number;
    individualLcl: number;
    movingRangeAverage: number;
    movingRangeUcl: number;
    points: { timestamp: string; value: number; movingRange: number | null }[];
  };
}

/* =========================================================================
   SaaS Multi-Tenant, User Roles & Subscription Types
   ========================================================================= */

export type UserRole = 'admin' | 'quality_engineer' | 'operator' | 'auditor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  stationOrMachine?: string; // e.g. "CNC Torna İstasyon #01"
  status: 'active' | 'suspended';
  lastLogin: string;
  avatarUrl?: string;
  pinCode?: string;
}

export type SubscriptionPlanId = 'starter' | 'pro' | 'enterprise';
export type BillingPeriod = 'monthly' | 'annual';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  monthlyPrice: number; // TRY
  annualPrice: number; // TRY/year
  maxControlPlans: number;
  maxOperators: number;
  maxMonthlyMeasurements: number;
  features: string[];
  badge: string;
  isPopular?: boolean;
}

export interface TenantCompany {
  id: string;
  name: string;
  legalName: string;
  taxNumber: string;
  taxOffice: string;
  industry: string;
  facilityLocation: string;
  contactEmail: string;
  contactPhone: string;
  planId: SubscriptionPlanId;
  subscriptionStatus: 'active' | 'trial' | 'past_due' | 'canceled';
  subscriptionRenewsAt: string;
  billingPeriod: BillingPeriod;
  licenseKey: string;
  createdAt: string;
}
