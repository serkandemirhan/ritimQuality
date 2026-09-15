import { Product, ControlPlan, InspectionLog } from '../types';

// Engineering CAD drawing blueprints as SVG data URIs
export const SHAFT_BUSHING_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="0.5"/>
    </pattern>
    <linearGradient id="metalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="50%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>
  
  <!-- Blueprint Background -->
  <rect width="800" height="500" fill="#090d16" />
  <rect width="800" height="500" fill="url(#grid)" />

  <!-- Drawing Frame & Title Block -->
  <rect x="20" y="20" width="760" height="460" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.8"/>
  <rect x="520" y="380" width="260" height="100" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
  <line x1="520" y1="415" x2="780" y2="415" stroke="#38bdf8" stroke-width="1"/>
  <line x1="520" y1="445" x2="780" y2="445" stroke="#38bdf8" stroke-width="1"/>
  <line x1="640" y1="415" x2="640" y2="480" stroke="#38bdf8" stroke-width="1"/>
  <text x="530" y="402" fill="#94a3b8" font-family="monospace" font-size="11">PARÇA: TAHRIK SAFT BURCU</text>
  <text x="530" y="433" fill="#38bdf8" font-family="monospace" font-size="11">KOD: PRD-2026-AUT01</text>
  <text x="650" y="433" fill="#94a3b8" font-family="monospace" font-size="11">ÖLÇEK: 1:1</text>
  <text x="530" y="465" fill="#94a3b8" font-family="monospace" font-size="11">MALZEME: 16MnCr5</text>
  <text x="650" y="465" fill="#38bdf8" font-family="monospace" font-size="11">REV: v1.1 (AKTIF)</text>

  <!-- Centerline -->
  <line x1="100" y1="230" x2="700" y2="230" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="16,4,4,4" opacity="0.8"/>

  <!-- Bushing Main Body (Cross Section Upper Half) -->
  <path d="M 180 130 L 220 130 L 220 160 L 580 160 L 580 180 L 180 180 Z" fill="url(#metalGrad)" stroke="#38bdf8" stroke-width="2"/>
  
  <!-- Bushing Main Body (Cross Section Lower Half) -->
  <path d="M 180 280 L 580 280 L 580 300 L 220 300 L 220 330 L 180 330 Z" fill="url(#metalGrad)" stroke="#38bdf8" stroke-width="2"/>

  <!-- Hatching lines for cut section -->
  <g stroke="#0284c7" stroke-width="1" opacity="0.6">
    <line x1="190" y1="130" x2="240" y2="180" />
    <line x1="210" y1="130" x2="260" y2="180" />
    <line x1="250" y1="160" x2="270" y2="180" />
    <line x1="290" y1="160" x2="310" y2="180" />
    <line x1="330" y1="160" x2="350" y2="180" />
    <line x1="370" y1="160" x2="390" y2="180" />
    <line x1="410" y1="160" x2="430" y2="180" />
    <line x1="450" y1="160" x2="470" y2="180" />
    <line x1="490" y1="160" x2="510" y2="180" />
    <line x1="530" y1="160" x2="550" y2="180" />
    <line x1="570" y1="160" x2="590" y2="180" />

    <line x1="190" y1="280" x2="240" y2="330" />
    <line x1="210" y1="280" x2="260" y2="330" />
    <line x1="250" y1="280" x2="270" y2="300" />
    <line x1="290" y1="280" x2="310" y2="300" />
    <line x1="330" y1="280" x2="350" y2="300" />
    <line x1="370" y1="280" x2="390" y2="300" />
    <line x1="410" y1="280" x2="430" y2="300" />
    <line x1="450" y1="280" x2="470" y2="300" />
    <line x1="490" y1="280" x2="510" y2="300" />
    <line x1="530" y1="280" x2="550" y2="300" />
    <line x1="570" y1="280" x2="590" y2="300" />
  </g>

  <!-- Chamfer lines -->
  <line x1="180" y1="135" x2="185" y2="130" stroke="#38bdf8" stroke-width="2"/>
  <line x1="575" y1="160" x2="580" y2="165" stroke="#38bdf8" stroke-width="2"/>
  <line x1="575" y1="300" x2="580" y2="295" stroke="#38bdf8" stroke-width="2"/>

  <!-- Dimension Line: Dış Çap Ø32 -->
  <line x1="150" y1="130" x2="150" y2="330" stroke="#f59e0b" stroke-width="1.5"/>
  <polygon points="150,130 146,142 154,142" fill="#f59e0b"/>
  <polygon points="150,330 146,318 154,318" fill="#f59e0b"/>
  <line x1="140" y1="130" x2="180" y2="130" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3,3"/>
  <line x1="140" y1="330" x2="180" y2="330" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3,3"/>
  <text x="60" y="235" fill="#f59e0b" font-family="monospace" font-size="14" font-weight="bold">Ø 48.00 ±0.05</text>

  <!-- Dimension Line: Gövde Dış Çap Ø32 -->
  <line x1="610" y1="160" x2="610" y2="300" stroke="#38bdf8" stroke-width="1.5"/>
  <polygon points="610,160 606,172 614,172" fill="#38bdf8"/>
  <polygon points="610,300 606,288 614,288" fill="#38bdf8"/>
  <text x="620" y="235" fill="#38bdf8" font-family="monospace" font-size="13">Ø 32.00 ±0.02</text>

  <!-- Dimension Line: İç Delik Çapı Ø20 -->
  <line x1="380" y1="180" x2="380" y2="280" stroke="#10b981" stroke-width="1.5"/>
  <polygon points="380,180 376,192 384,192" fill="#10b981"/>
  <polygon points="380,280 376,268 384,268" fill="#10b981"/>
  <text x="390" y="235" fill="#10b981" font-family="monospace" font-size="13">Ø 20.00 +0.03/-0.01</text>

  <!-- Dimension Line: Toplam Boy 75mm -->
  <line x1="180" y1="80" x2="580" y2="80" stroke="#e2e8f0" stroke-width="1.5"/>
  <polygon points="180,80 192,76 192,84" fill="#e2e8f0"/>
  <polygon points="580,80 568,76 568,84" fill="#e2e8f0"/>
  <line x1="180" y1="70" x2="180" y2="130" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3"/>
  <line x1="580" y1="70" x2="580" y2="160" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3"/>
  <text x="340" y="72" fill="#e2e8f0" font-family="monospace" font-size="14" font-weight="bold">L = 75.00 ±0.08</text>

  <!-- Chamfer Leader Callout -->
  <path d="M 578 162 L 640 120 L 710 120" fill="none" stroke="#a855f7" stroke-width="1.5"/>
  <text x="645" y="112" fill="#a855f7" font-family="monospace" font-size="12">1.5 x 45° ±1°</text>

  <!-- Surface Roughness Leader -->
  <path d="M 450 160 L 450 120 L 480 120" fill="none" stroke="#ec4899" stroke-width="1.5"/>
  <text x="485" y="125" fill="#ec4899" font-family="monospace" font-size="12">Ra 0.80 ±0.20 µm</text>
</svg>
`)}`;

export const FLANGE_BODY_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <pattern id="grid2" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="0.5"/>
    </pattern>
  </defs>
  
  <rect width="800" height="500" fill="#090d16" />
  <rect width="800" height="500" fill="url(#grid2)" />

  <rect x="20" y="20" width="760" height="460" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.8"/>
  <rect x="520" y="380" width="260" height="100" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
  <line x1="520" y1="415" x2="780" y2="415" stroke="#38bdf8" stroke-width="1"/>
  <line x1="520" y1="445" x2="780" y2="445" stroke="#38bdf8" stroke-width="1"/>
  <line x1="640" y1="415" x2="640" y2="480" stroke="#38bdf8" stroke-width="1"/>
  <text x="530" y="402" fill="#94a3b8" font-family="monospace" font-size="11">PARÇA: CNC FLANS GOVDESI</text>
  <text x="530" y="433" fill="#38bdf8" font-family="monospace" font-size="11">KOD: PRD-2026-FLN02</text>
  <text x="650" y="433" fill="#94a3b8" font-family="monospace" font-size="11">ÖLÇEK: 1:1</text>
  <text x="530" y="465" fill="#94a3b8" font-family="monospace" font-size="11">MALZEME: AlSi10Mg</text>
  <text x="650" y="465" fill="#38bdf8" font-family="monospace" font-size="11">REV: v2.0 (AKTIF)</text>

  <!-- Left: Front View (Circle) -->
  <g transform="translate(230, 230)">
    <!-- Centerlines -->
    <line x1="-140" y1="0" x2="140" y2="0" stroke="#ef4444" stroke-width="1" stroke-dasharray="10,3,3,3"/>
    <line x1="0" y1="-140" x2="0" y2="140" stroke="#ef4444" stroke-width="1" stroke-dasharray="10,3,3,3"/>
    
    <!-- Outer Flange Circle -->
    <circle cx="0" cy="0" r="110" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
    
    <!-- Pitch Circle Diameter (PCD) -->
    <circle cx="0" cy="0" r="85" fill="none" stroke="#f59e0b" stroke-width="1" stroke-dasharray="6,4"/>
    
    <!-- Bolt Holes (4x Ø10) -->
    <circle cx="0" cy="-85" r="10" fill="#090d16" stroke="#f59e0b" stroke-width="1.5"/>
    <circle cx="85" cy="0" r="10" fill="#090d16" stroke="#f59e0b" stroke-width="1.5"/>
    <circle cx="0" cy="85" r="10" fill="#090d16" stroke="#f59e0b" stroke-width="1.5"/>
    <circle cx="-85" cy="0" r="10" fill="#090d16" stroke="#f59e0b" stroke-width="1.5"/>

    <!-- Center Bore -->
    <circle cx="0" cy="0" r="45" fill="#090d16" stroke="#10b981" stroke-width="2"/>
  </g>

  <!-- Right: Side Cross Section View -->
  <g transform="translate(430, 120)">
    <!-- Centerline -->
    <line x1="-20" y1="110" x2="160" y2="110" stroke="#ef4444" stroke-width="1" stroke-dasharray="10,3,3,3"/>
    
    <!-- Flange Side Profile -->
    <path d="M 0 0 L 25 0 L 25 65 L 120 65 L 120 155 L 25 155 L 25 220 L 0 220 Z" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
    <!-- Center Bore Void -->
    <rect x="0" y="65" width="120" height="90" fill="#090d16" stroke="#10b981" stroke-width="1.5"/>
    
    <!-- Bolt hole voids -->
    <rect x="0" y="15" width="25" height="20" fill="#090d16" stroke="#f59e0b" stroke-width="1"/>
    <rect x="0" y="185" width="25" height="20" fill="#090d16" stroke="#f59e0b" stroke-width="1"/>
  </g>

  <!-- Annotations / Dimensions -->
  <text x="90" y="80" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold">#1: Dış Çap Ø110 ±0.10</text>
  <text x="90" y="410" fill="#f59e0b" font-family="monospace" font-size="13">#2: PCD Cıvata Dairesi Ø85 ±0.05</text>
  <text x="210" y="235" fill="#10b981" font-family="monospace" font-size="13">#3: Merkez Delik Ø45H7 (+0.025/0)</text>
  <text x="430" y="90" fill="#e2e8f0" font-family="monospace" font-size="13">#4: Flanş Et Kalınlığı 25 ±0.08</text>
  <text x="460" y="270" fill="#ec4899" font-family="monospace" font-size="13">#5: Toplam Boy L=120 ±0.15</text>
</svg>
`)}`;

export const CONNECTOR_HOUSING_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <pattern id="grid3" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="0.5"/>
    </pattern>
  </defs>
  
  <rect width="800" height="500" fill="#090d16" />
  <rect width="800" height="500" fill="url(#grid3)" />

  <rect x="20" y="20" width="760" height="460" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.8"/>
  <rect x="520" y="380" width="260" height="100" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
  <line x1="520" y1="415" x2="780" y2="415" stroke="#38bdf8" stroke-width="1"/>
  <line x1="520" y1="445" x2="780" y2="445" stroke="#38bdf8" stroke-width="1"/>
  <line x1="640" y1="415" x2="640" y2="480" stroke="#38bdf8" stroke-width="1"/>
  <text x="530" y="402" fill="#94a3b8" font-family="monospace" font-size="11">PARÇA: PLASTIK KONNEKTOR</text>
  <text x="530" y="433" fill="#38bdf8" font-family="monospace" font-size="11">KOD: PRD-2026-PLAS03</text>
  <text x="650" y="433" fill="#94a3b8" font-family="monospace" font-size="11">ÖLÇEK: 2:1</text>
  <text x="530" y="465" fill="#94a3b8" font-family="monospace" font-size="11">MALZEME: PA66-GF30</text>
  <text x="650" y="465" fill="#38bdf8" font-family="monospace" font-size="11">REV: v1.0 (AKTIF)</text>

  <!-- Main Body Isometric / 2D View -->
  <g transform="translate(160, 140)">
    <rect x="0" y="0" width="340" height="180" rx="10" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
    <rect x="20" y="20" width="300" height="140" rx="6" fill="#090d16" stroke="#64748b" stroke-width="1.5"/>
    
    <!-- Snap Tabs (Tırnaklar) -->
    <path d="M 60 0 L 70 -20 L 110 -20 L 120 0 Z" fill="#334155" stroke="#f59e0b" stroke-width="1.5"/>
    <path d="M 220 0 L 230 -20 L 270 -20 L 280 0 Z" fill="#334155" stroke="#f59e0b" stroke-width="1.5"/>
    
    <!-- Internal Pin Slots -->
    <circle cx="80" cy="90" r="14" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>
    <circle cx="170" cy="90" r="14" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>
    <circle cx="260" cy="90" r="14" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>
  </g>

  <!-- Dimension references -->
  <text x="180" y="80" fill="#f59e0b" font-family="monospace" font-size="13" font-weight="bold">#1: Geçme Tırnak Aralığı 160.00 ±0.05</text>
  <text x="180" y="360" fill="#38bdf8" font-family="monospace" font-size="13">#2: Dış Gövde Genişliği 340.00 ±0.15</text>
  <text x="320" y="225" fill="#10b981" font-family="monospace" font-size="13">#3: Pin Yuvası Çapı Ø28.00 ±0.03</text>
  <text x="40" y="230" fill="#ec4899" font-family="monospace" font-size="13">#4: Et Kalınlığı 20.00 ±0.05</text>
</svg>
`)}`;

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    code: 'PRD-2026-AUT01',
    name: 'Otomotiv Tahrik Şaftı Burcu',
    customer: 'Bosch / Oyak Renault',
    material: '16MnCr5 Sementasyon Çeliği',
    category: 'Talaşlı İmalat (CNC Torna & Taşlama)',
    description: 'Şanzıman tahrik mili yataklama burcu. Yüksek hassasiyetli taşlanmış dış çap ve honlanmış iç delik.',
    defaultDrawingUrl: SHAFT_BUSHING_SVG,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-14T14:30:00.000Z',
  },
  {
    id: 'prod-002',
    code: 'PRD-2026-FLN02',
    name: 'CNC Alüminyum Flanş Gövdesi',
    customer: 'Arçelik / Hidrolik Sistemler',
    material: 'AlSi10Mg Alüminyum Döküm',
    category: 'CNC 5 Eksen İşleme',
    description: 'Yüksek basınç sızdırmazlık flanşı. Cıvata PCD daireleri ve H7 toleranslı merkezleme faturası.',
    defaultDrawingUrl: FLANGE_BODY_SVG,
    createdAt: '2026-08-03T10:00:00.000Z',
    updatedAt: '2026-08-12T09:15:00.000Z',
  },
  {
    id: 'prod-003',
    code: 'PRD-2026-PLAS03',
    name: 'Plastik Konnektör Gövdesi',
    customer: 'Schneider Electric',
    material: 'PA66-GF30 (%30 Cam Elyaf Takviyeli Poliamid)',
    category: 'Plastik Enjeksiyon',
    description: 'Elektrik klemens gövdesi. Geçmeli kilit tırnakları ve pin merkezleme yuvaları.',
    defaultDrawingUrl: CONNECTOR_HOUSING_SVG,
    createdAt: '2026-08-05T11:20:00.000Z',
    updatedAt: '2026-08-10T16:45:00.000Z',
  }
];

export const INITIAL_CONTROL_PLANS: ControlPlan[] = [
  {
    id: 'cp-001-v11',
    productId: 'prod-001',
    version: 'v1.1',
    revisionDate: '2026-08-10',
    revisionNote: 'Müşteri talebiyle Dış Çap taşlama toleransı ±0.03 mm yerine ±0.02 mm olarak daraltıldı.',
    isActive: true, // Default active for operator
    status: 'active',
    author: 'Demo Yönetici (Kalite Müdürü)',
    approvedBy: 'Ahmet Yılmaz (Üretim Direktörü)',
    drawingImageUrl: SHAFT_BUSHING_SVG,
    createdAt: '2026-08-10T09:00:00.000Z',
    updatedAt: '2026-08-14T14:30:00.000Z',
    characteristics: [
      {
        id: 'char-101',
        pointNo: 1,
        name: 'Gövde Dış Çapı (ØA)',
        nominal: 32.00,
        tolUpper: 0.02,
        tolLower: -0.02,
        usl: 32.02,
        lsl: 31.98,
        unit: 'mm',
        tool: 'Mikrometre 0.001',
        sampleSize: '5 Adet / Şarj',
        frequency: 'Her 2 saatte bir',
        criticalClass: 'critical',
        pin: { x: 76.5, y: 47.0 },
        description: 'CNC Taşlama sonrası ana yataklama çapı ölçümü.'
      },
      {
        id: 'char-102',
        pointNo: 2,
        name: 'İç Delik Çapı (ØB)',
        nominal: 20.00,
        tolUpper: 0.03,
        tolLower: -0.01,
        usl: 20.03,
        lsl: 19.99,
        unit: 'mm',
        tool: 'CMM 3D Ölçüm Cihazı',
        sampleSize: '3 Adet / Parti',
        frequency: 'Vardiya başı ve sonu',
        criticalClass: 'critical',
        pin: { x: 47.5, y: 47.0 },
        description: 'Honlama sonrası iç delik çapı ve ovallik kontrolü.'
      },
      {
        id: 'char-103',
        pointNo: 3,
        name: 'Toplam Parça Boyu (L)',
        nominal: 75.00,
        tolUpper: 0.08,
        tolLower: -0.08,
        usl: 75.08,
        lsl: 74.92,
        unit: 'mm',
        tool: 'Dijital Kumpas 0.01',
        sampleSize: '5 Adet / Kasa',
        frequency: '100% veya saat başı',
        criticalClass: 'major',
        pin: { x: 47.5, y: 16.0 },
        description: 'Alın tornalama sonrası toplam uzunluk kontrolü.'
      },
      {
        id: 'char-104',
        pointNo: 4,
        name: 'Flanş Baş Çapı (ØD)',
        nominal: 48.00,
        tolUpper: 0.05,
        tolLower: -0.05,
        usl: 48.05,
        lsl: 47.95,
        unit: 'mm',
        tool: 'Dijital Kumpas 0.01',
        sampleSize: '5 Adet / Şarj',
        frequency: 'Her saatte bir',
        criticalClass: 'major',
        pin: { x: 19.0, y: 47.0 },
        description: 'Ön fatura dış çapı.'
      },
      {
        id: 'char-105',
        pointNo: 5,
        name: 'Pah Açısı & Boyutu',
        nominal: 45.0,
        tolUpper: 1.0,
        tolLower: -1.0,
        usl: 46.0,
        lsl: 44.0,
        unit: '°',
        tool: 'Profil Projeksiyon / Optik',
        sampleSize: '2 Adet',
        frequency: 'Takım değişiminde',
        criticalClass: 'minor',
        pin: { x: 72.5, y: 24.0 },
        description: 'Giriş pahı açısı kontrolü.'
      },
      {
        id: 'char-106',
        pointNo: 6,
        name: 'Yüzey Pürüzlülüğü (Ra)',
        nominal: 0.80,
        tolUpper: 0.20,
        tolLower: -0.20,
        usl: 1.00,
        lsl: 0.60,
        unit: 'Ra',
        tool: 'Yüzey Pürüzlülük (Surftest)',
        sampleSize: '3 Adet / Parti',
        frequency: 'Taş bileme sonrası',
        criticalClass: 'major',
        pin: { x: 56.5, y: 24.5 },
        description: 'Taşlanmış silindirik dış yüzey pürüzlülük kontrolü.'
      }
    ]
  },
  {
    id: 'cp-001-v10',
    productId: 'prod-001',
    version: 'v1.0',
    revisionDate: '2026-08-01',
    revisionNote: 'İlk seri üretim onaylı kontrol planı devreye alındı.',
    isActive: false, // Old revision
    status: 'archived',
    author: 'Demo Yönetici',
    approvedBy: 'Ahmet Yılmaz',
    drawingImageUrl: SHAFT_BUSHING_SVG,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-10T09:00:00.000Z',
    characteristics: [
      {
        id: 'char-101-old',
        pointNo: 1,
        name: 'Gövde Dış Çapı (ØA)',
        nominal: 32.00,
        tolUpper: 0.03,
        tolLower: -0.03,
        usl: 32.03,
        lsl: 31.97,
        unit: 'mm',
        tool: 'Mikrometre 0.001',
        sampleSize: '5 Adet',
        frequency: 'Her 2 saatte bir',
        criticalClass: 'critical',
        pin: { x: 76.5, y: 47.0 },
      }
    ]
  },
  {
    id: 'cp-002-v20',
    productId: 'prod-002',
    version: 'v2.0',
    revisionDate: '2026-08-12',
    revisionNote: '5-Eksen işleme fikstürü revizyonu sonrası delik PCD toleransı güncellendi.',
    isActive: true,
    status: 'active',
    author: 'Burak Demir (Kalite Uzmanı)',
    approvedBy: 'Mehmet Kaya (Fabrika Müdürü)',
    drawingImageUrl: FLANGE_BODY_SVG,
    createdAt: '2026-08-12T09:15:00.000Z',
    updatedAt: '2026-08-12T09:15:00.000Z',
    characteristics: [
      {
        id: 'char-201',
        pointNo: 1,
        name: 'Flanş Dış Çapı (Ø110)',
        nominal: 110.00,
        tolUpper: 0.10,
        tolLower: -0.10,
        usl: 110.10,
        lsl: 109.90,
        unit: 'mm',
        tool: 'Dijital Kumpas 0.01',
        sampleSize: '5 Adet',
        frequency: 'Parti başı 5 adet',
        criticalClass: 'major',
        pin: { x: 28.5, y: 22.0 },
      },
      {
        id: 'char-202',
        pointNo: 2,
        name: 'PCD Cıvata Dairesi (Ø85)',
        nominal: 85.00,
        tolUpper: 0.05,
        tolLower: -0.05,
        usl: 85.05,
        lsl: 84.95,
        unit: 'mm',
        tool: 'CMM 3D Ölçüm Cihazı',
        sampleSize: '3 Adet',
        frequency: 'Vardiya başı',
        criticalClass: 'critical',
        pin: { x: 28.5, y: 82.0 },
      },
      {
        id: 'char-203',
        pointNo: 3,
        name: 'Merkez Delik Çapı (Ø45 H7)',
        nominal: 45.00,
        tolUpper: 0.025,
        tolLower: 0.00,
        usl: 45.025,
        lsl: 45.00,
        unit: 'mm',
        tool: 'Geçer / Geçmez Tampon Mastar',
        sampleSize: '100%',
        frequency: '100% Operatör kontrolü',
        criticalClass: 'critical',
        pin: { x: 28.5, y: 46.0 },
      },
      {
        id: 'char-204',
        pointNo: 4,
        name: 'Flanş Et Kalınlığı',
        nominal: 25.00,
        tolUpper: 0.08,
        tolLower: -0.08,
        usl: 25.08,
        lsl: 24.92,
        unit: 'mm',
        tool: 'Dijital Kumpas 0.01',
        sampleSize: '5 Adet',
        frequency: 'Saat başı',
        criticalClass: 'major',
        pin: { x: 57.0, y: 18.0 },
      }
    ]
  },
  {
    id: 'cp-003-v10',
    productId: 'prod-003',
    version: 'v1.0',
    revisionDate: '2026-08-05',
    revisionNote: 'Kalıp deneme baskısı (T1) onaylı kontrol planı.',
    isActive: true,
    status: 'active',
    author: 'Caner Özkan (Plastik Kalite Müh.)',
    approvedBy: 'Murat Eren (Kalite Direktörü)',
    drawingImageUrl: CONNECTOR_HOUSING_SVG,
    createdAt: '2026-08-05T11:20:00.000Z',
    updatedAt: '2026-08-10T16:45:00.000Z',
    characteristics: [
      {
        id: 'char-301',
        pointNo: 1,
        name: 'Geçme Tırnak Aralığı',
        nominal: 160.00,
        tolUpper: 0.05,
        tolLower: -0.05,
        usl: 160.05,
        lsl: 159.95,
        unit: 'mm',
        tool: 'Profil Projeksiyon / Optik',
        sampleSize: '5 Adet / Koli',
        frequency: 'Her 4 saatte bir',
        criticalClass: 'critical',
        pin: { x: 42.0, y: 16.0 },
      },
      {
        id: 'char-302',
        pointNo: 2,
        name: 'Dış Gövde Genişliği',
        nominal: 340.00,
        tolUpper: 0.15,
        tolLower: -0.15,
        usl: 340.15,
        lsl: 339.85,
        unit: 'mm',
        tool: 'Dijital Kumpas 0.01',
        sampleSize: '3 Adet',
        frequency: 'Vardiya başı',
        criticalClass: 'major',
        pin: { x: 42.0, y: 72.0 },
      },
      {
        id: 'char-303',
        pointNo: 3,
        name: 'Pin Yuvası Çapı (Ø28)',
        nominal: 28.00,
        tolUpper: 0.03,
        tolLower: -0.03,
        usl: 28.03,
        lsl: 27.97,
        unit: 'mm',
        tool: 'CMM 3D Ölçüm Cihazı',
        sampleSize: '5 Adet',
        frequency: 'Hammadde şarj değişiminde',
        criticalClass: 'critical',
        pin: { x: 42.0, y: 45.0 },
      }
    ]
  }
];

// Helper to generate realistic historical inspection data with realistic normal distribution + small variations
export const generateRealisticInspectionLogs = (): InspectionLog[] => {
  const logs: InspectionLog[] = [];
  const operators = ['Operatör 01', 'Operatör 02', 'Operatör 03', 'Operatör 04', 'Operatör 05'];
  const machines = ['CNC Torna #01 (Doosan)', 'CNC Torna #02 (Mazak)', 'Taşlama #04 (Studer)', '5-Eksen Freze #02 (DMG Mori)'];

  // Base timestamps spread across the last 10 days
  const baseTime = new Date('2026-08-15T08:00:00Z').getTime();

  for (let i = 24; i >= 1; i--) {
    const timestamp = new Date(baseTime - i * 3600 * 1000 * 8).toISOString();
    const op = operators[i % operators.length];
    const mach = machines[i % machines.length];
    const lotNum = `LOT-2026-08${String(15 - Math.floor(i / 3)).padStart(2, '0')}-A`;
    const orderNum = `IE-884${20 + i}`;

    // Generate 5 samples per inspection run
    const samples = [1, 2, 3, 4, 5].map((sIdx) => {
      // Nominal values:
      // char-101: 32.00 ± 0.02 (USL 32.02, LSL 31.98)
      // char-102: 20.00 +0.03/-0.01 (USL 20.03, LSL 19.99)
      // char-103: 75.00 ± 0.08 (USL 75.08, LSL 74.92)
      // char-104: 48.00 ± 0.05 (USL 48.05, LSL 47.95)
      // char-105: 45.0 ± 1.0 (USL 46.0, LSL 44.0)
      // char-106: 0.80 ± 0.20 (USL 1.00, LSL 0.60)
      
      const v101 = Number((32.00 + (Math.sin(i * 1.5 + sIdx) * 0.012) + (Math.random() * 0.008 - 0.004)).toFixed(3));
      const v102 = Number((20.012 + (Math.cos(i * 1.2 + sIdx) * 0.009) + (Math.random() * 0.006 - 0.003)).toFixed(3));
      const v103 = Number((75.015 + (Math.sin(i * 0.9 + sIdx) * 0.035) + (Math.random() * 0.02 - 0.01)).toFixed(2));
      const v104 = Number((48.008 + (Math.cos(i * 1.1 + sIdx) * 0.022) + (Math.random() * 0.015 - 0.007)).toFixed(2));
      const v105 = Number((45.1 + (Math.random() * 0.6 - 0.3)).toFixed(1));
      const v106 = Number((0.78 + (Math.random() * 0.14 - 0.07)).toFixed(2));

      const values: Record<string, number> = {
        'char-101': v101,
        'char-102': v102,
        'char-103': v103,
        'char-104': v104,
        'char-105': v105,
        'char-106': v106,
      };

      const statuses: Record<string, 'pass' | 'warning' | 'fail' | 'empty'> = {
        'char-101': (v101 >= 31.98 && v101 <= 32.02) ? (v101 > 32.016 || v101 < 31.984 ? 'warning' : 'pass') : 'fail',
        'char-102': (v102 >= 19.99 && v102 <= 20.03) ? (v102 > 20.025 || v102 < 19.995 ? 'warning' : 'pass') : 'fail',
        'char-103': (v103 >= 74.92 && v103 <= 75.08) ? 'pass' : 'fail',
        'char-104': (v104 >= 47.95 && v104 <= 48.05) ? 'pass' : 'fail',
        'char-105': (v105 >= 44.0 && v105 <= 46.0) ? 'pass' : 'fail',
        'char-106': (v106 >= 0.60 && v106 <= 1.00) ? 'pass' : 'fail',
      };

      return {
        sampleIndex: sIdx,
        values,
        statuses,
      };
    });

    // Determine overall status
    let hasFail = false;
    let hasWarning = false;
    let failCount = 0;
    let warnCount = 0;

    samples.forEach(s => {
      Object.values(s.statuses).forEach(st => {
        if (st === 'fail') {
          hasFail = true;
          failCount++;
        }
        if (st === 'warning') {
          hasWarning = true;
          warnCount++;
        }
      });
    });

    const overallStatus: 'pass' | 'warning' | 'fail' = hasFail ? 'fail' : (hasWarning ? 'warning' : 'pass');

    logs.push({
      id: `log-2026-0815-${String(i).padStart(3, '0')}`,
      sessionCode: `INS-20260815-${String(i).padStart(3, '0')}`,
      productId: 'prod-001',
      productCode: 'PRD-2026-AUT01',
      productName: 'Otomotiv Tahrik Şaftı Burcu',
      controlPlanId: 'cp-001-v11',
      controlPlanVersion: 'v1.1',
      operatorName: op,
      lotNumber: lotNum,
      orderNumber: orderNum,
      machineNo: mach,
      sampleCount: 5,
      overallStatus,
      totalPointsChecked: 5 * 6,
      failedPointsCount: failCount,
      warningPointsCount: warnCount,
      timestamp,
      notes: hasFail ? 'Taşlama taşı soğutma sıvısı debisi ayarlandı.' : 'Seri üretim ölçümleri şartnameye uygundur.',
      samples,
    });
  }

  return logs;
};

/* =========================================================================
   SaaS Subscription Plans & Tenant Team Mock Data
   ========================================================================= */

import { SubscriptionPlan, User, TenantCompany } from '../types';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 1490,
    annualPrice: 14900,
    maxControlPlans: 5,
    maxOperators: 3,
    maxMonthlyMeasurements: 2500,
    features: [
      'Görsel Teknik Resim Etiketleme (5 Plan)',
      '3 Eşzamanlı Operatör İstasyonu',
      'Aylık 2.500 Ölçüm Kaydı',
      'Temel Tolerans & Uygunluk Kontrolü',
      'Standart Ölçüm Sertifikası (PDF / Yazdır)',
      'E-posta Destek',
    ],
    badge: 'Başlangıç',
    isPopular: false,
  },
  {
    id: 'pro',
    name: 'Professional',
    monthlyPrice: 3890,
    annualPrice: 38900,
    maxControlPlans: 50,
    maxOperators: 15,
    maxMonthlyMeasurements: 25000,
    features: [
      'Görsel Teknik Resim Etiketleme (50 Plan)',
      '15 Operatör Ölçüm İstasyonu & Vardiya',
      'Aylık 25.000 Ölçüm Kaydı',
      'İstatistiksel Süreç Kontrolü (SPC)',
      'Cp, Cpk, Pp, Ppk Otomatik Yetenek Analizi',
      'ISO 9001:2015 & IATF 16949 Kalite Sertifikaları',
      'Rol Tabanlı Kullanıcı & İzin Yönetimi',
      '7/24 Öncelikli Teknik Destek',
    ],
    badge: 'En Çok Tercih Edilen',
    isPopular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 8990,
    annualPrice: 89900,
    maxControlPlans: 9999,
    maxOperators: 9999,
    maxMonthlyMeasurements: 999999,
    features: [
      'Sınırsız Kontrol Planı & Revizyon Takibi',
      'Sınırsız Operatör ve Fabrika Hattı',
      'Sınırsız Aylık Ölçüm & Bulut Arşivleme',
      'Gelişmiş SPC ve Proses Yetenek Raporları',
      'Değiştirilemez Denetim İzi (Audit Log)',
      'Gelişmiş Rol ve Yetki Yönetimi',
      'Özel Kurulum ve Veri Aktarım Desteği',
      'Öncelikli Kurumsal Destek',
    ],
    badge: 'Kurumsal',
    isPopular: false,
  },
];

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-001',
    name: 'Operatör 01',
    email: 'operator01@example.com',
    role: 'operator',
    department: 'Talaşlı İmalat / Atölye',
    stationOrMachine: 'CNC Torna İstasyon #01',
    status: 'active',
    lastLogin: 'Şimdi aktif',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    pinCode: '1001',
  },
  {
    id: 'usr-002',
    name: 'Kalite Uzmanı',
    email: 'quality@example.com',
    role: 'quality_engineer',
    department: 'Kalite Güvence & Laboratuvar',
    stationOrMachine: 'CMM & Metroloji Odası',
    status: 'active',
    lastLogin: 'Bugün 08:45',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    pinCode: '2002',
  },
  {
    id: 'usr-003',
    name: 'Demo Yönetici',
    email: 'admin@example.com',
    role: 'admin',
    department: 'Genel Yönetim & Fabrika Müdürlüğü',
    stationOrMachine: 'Yönetim Merkezi',
    status: 'active',
    lastLogin: 'Bugün 09:12',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    pinCode: '9999',
  },
  {
    id: 'usr-004',
    name: 'Operatör 02',
    email: 'operator02@example.com',
    role: 'operator',
    department: 'Taşlama & Honlama Bölümü',
    stationOrMachine: 'Puntaşsız Taşlama #03',
    status: 'active',
    lastLogin: 'Dün 16:30',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    pinCode: '1004',
  },
  {
    id: 'usr-005',
    name: 'Demo Denetçi',
    email: 'auditor@example.com',
    role: 'auditor',
    department: 'IATF 16949 / ISO 9001 Dış Denetçi',
    stationOrMachine: 'Denetim Portalı',
    status: 'active',
    lastLogin: '12 Ağustos 2026',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    pinCode: '5005',
  },
];

export const INITIAL_COMPANY: TenantCompany = {
  id: 'tenant-demirhan-01',
  name: 'Demirhan Hassas Makina & Kalıp A.Ş.',
  legalName: 'Demirhan Hassas Makina Kalıp ve Otomotiv Yan San. Tic. A.Ş.',
  taxNumber: '2840591283',
  taxOffice: 'Bursa Nilüfer Vergi Dairesi',
  industry: 'Otomotiv Yan Sanayi & Hassas Talaşlı İmalat',
  facilityLocation: 'Bursa OSB 14. Cadde No: 28 Nilüfer / BURSA',
  contactEmail: 'kalite@demirhanmakina.com',
  contactPhone: '+90 (224) 441 80 90',
  planId: 'pro',
  subscriptionStatus: 'active',
  subscriptionRenewsAt: '2027-04-15',
  billingPeriod: 'annual',
  licenseKey: 'QUALITRACK-PRO-TR-2026-9812-4401',
  createdAt: '2025-04-15T09:00:00Z',
};
