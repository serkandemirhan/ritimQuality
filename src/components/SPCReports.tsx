import React, { useState, useMemo } from 'react';
import { Product, ControlPlan, InspectionLog, SPCMetric } from '../types';
import { SPCEngine } from '../services/spcEngine';
import { 
  TrendingUp, 
  Activity, 
  BarChart3, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ShieldAlert, 
  Lightbulb, 
  Filter, 
  Download,
  Calendar,
  Layers,
  Award
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  LineChart,
  Line,
  Cell
} from 'recharts';

interface SPCReportsProps {
  products: Product[];
  controlPlans: ControlPlan[];
  inspectionLogs: InspectionLog[];
}

export const SPCReports: React.FC<SPCReportsProps> = ({
  products,
  controlPlans,
  inspectionLogs,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedCharId, setSelectedCharId] = useState<string>('');

  // Optional Filters
  const [operatorFilter, setOperatorFilter] = useState<string>('all');
  const [lotFilter, setLotFilter] = useState<string>('all');

  // Filter plans for this product
  const productPlans = useMemo(() => {
    return controlPlans.filter(cp => cp.productId === selectedProductId);
  }, [controlPlans, selectedProductId]);

  // Current active plan
  const currentPlan = useMemo(() => {
    if (selectedPlanId) {
      return productPlans.find(cp => cp.id === selectedPlanId) || productPlans[0];
    }
    return productPlans.find(cp => cp.isActive) || productPlans[0];
  }, [productPlans, selectedPlanId]);

  // Set default characteristic
  const characteristics = currentPlan?.characteristics || [];
  const activeChar = useMemo(() => {
    if (selectedCharId) {
      return characteristics.find(c => c.id === selectedCharId) || characteristics[0];
    }
    return characteristics[0];
  }, [characteristics, selectedCharId]);

  // Unique operators and lots for filter dropdowns
  const operatorsList = useMemo(() => {
    const set = new Set<string>();
    inspectionLogs.forEach(l => {
      if (l.productId === selectedProductId) set.add(l.operatorName);
    });
    return Array.from(set);
  }, [inspectionLogs, selectedProductId]);

  const lotsList = useMemo(() => {
    const set = new Set<string>();
    inspectionLogs.forEach(l => {
      if (l.productId === selectedProductId) set.add(l.lotNumber);
    });
    return Array.from(set);
  }, [inspectionLogs, selectedProductId]);

  // Calculate SPC metric for active characteristic
  const spcMetric: SPCMetric | null = useMemo(() => {
    if (!activeChar) return null;
    return SPCEngine.calculateMetric(activeChar, inspectionLogs, {
      operator: operatorFilter === 'all' ? undefined : operatorFilter,
      lotNumber: lotFilter === 'all' ? undefined : lotFilter,
    });
  }, [activeChar, inspectionLogs, operatorFilter, lotFilter]);

  // Calculate all metrics for the whole plan summary table
  const allPlanMetrics = useMemo(() => {
    if (!currentPlan) return [];
    return SPCEngine.calculateAllForPlan(currentPlan, inspectionLogs);
  }, [currentPlan, inspectionLogs]);

  // Diagnosis
  const diagnosis = spcMetric ? SPCEngine.generateDiagnosis(spcMetric) : null;

  // Formatting helpers
  const getCpkBadge = (cpk: number) => {
    if (cpk >= 1.67) {
      return {
        label: 'Mükemmel (6 Sigma)',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        color: 'text-emerald-600',
      };
    }
    if (cpk >= 1.33) {
      return {
        label: 'Yetenekli (IATF Standardı)',
        bg: 'bg-blue-50 text-blue-800 border-blue-200',
        color: 'text-blue-600',
      };
    }
    if (cpk >= 1.00) {
      return {
        label: 'Kabul Edilebilir / Kritik',
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        color: 'text-amber-600',
      };
    }
    return {
      label: 'Yetersiz Süreç (Hatalı)',
      bg: 'bg-rose-50 text-rose-800 border-rose-200',
      color: 'text-rose-600',
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </span>
              İstatistiksel Süreç Kontrolü (SPC) & Cp / Cpk Yetenek Raporu
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ISO 9001 & IATF 16949 standartlarında süreç yeterliliği, standart sapma, histogram dağılımı ve X-bar kontrol grafikleri.
            </p>
          </div>
        </div>

        {/* Filters Matrix */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Parça / Ürün
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                setSelectedPlanId('');
                setSelectedCharId('');
              }}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Kontrol Planı Revizyonu
            </label>
            <select
              value={currentPlan?.id || ''}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
            >
              {productPlans.map(cp => (
                <option key={cp.id} value={cp.id}>
                  {cp.version} {cp.isActive ? '(Aktif)' : `(${cp.status})`} - {cp.revisionDate}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Karakteristik / Ölçüm Noktası
            </label>
            <select
              value={activeChar?.id || ''}
              onChange={(e) => setSelectedCharId(e.target.value)}
              className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-bold text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
            >
              {characteristics.map(c => (
                <option key={c.id} value={c.id}>
                  #{c.pointNo} - {c.name} ({c.nominal} ±{c.tolUpper} {c.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Parti / Lot Filtresi
            </label>
            <select
              value={lotFilter}
              onChange={(e) => setLotFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
            >
              <option value="all">Tüm Partiler ({lotsList.length} Parti)</option>
              {lotsList.map(lot => (
                <option key={lot} value={lot}>{lot}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {spcMetric ? (
        <>
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cpk Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Süreç Yetenek Endeksi (Cpk)
                </span>
                <Award className={`w-5 h-5 ${getCpkBadge(spcMetric.cpk).color}`} />
              </div>

              <div className="my-3">
                <div className="text-3xl font-black font-mono text-slate-900 flex items-baseline gap-2">
                  <span>{spcMetric.cpk.toFixed(2)}</span>
                  <span className="text-xs font-medium text-slate-400">
                    (Cp: {spcMetric.cp.toFixed(2)})
                  </span>
                </div>
                <div className={`mt-2 text-[11px] font-bold px-3 py-1 rounded-full border inline-block ${getCpkBadge(spcMetric.cpk).bg}`}>
                  {getCpkBadge(spcMetric.cpk).label}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex justify-between font-mono">
                <span>Cpu: {spcMetric.cpu.toFixed(2)}</span>
                <span>Cpl: {spcMetric.cpl.toFixed(2)}</span>
                <span>Ppk: {spcMetric.ppk.toFixed(2)}</span>
              </div>
            </div>

            {/* Mean & Deviation */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Süreç Ortalaması (X̄)
                </span>
                <Activity className="w-5 h-5 text-blue-600" />
              </div>

              <div className="my-3">
                <div className="text-3xl font-black font-mono text-blue-600">
                  {spcMetric.mean.toFixed(4)} <span className="text-xs text-slate-400 font-normal">{spcMetric.unit}</span>
                </div>
                <div className="text-xs text-slate-600 font-mono mt-1 flex items-center gap-1.5 font-medium">
                  <span>Nom: {spcMetric.nominal}</span>
                  <span className={`font-bold ${
                    Math.abs(spcMetric.mean - spcMetric.nominal) < 0.005 ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    ({(spcMetric.mean - spcMetric.nominal) > 0 ? `+${(spcMetric.mean - spcMetric.nominal).toFixed(4)}` : (spcMetric.mean - spcMetric.nominal).toFixed(4)})
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex justify-between font-mono">
                <span>LSL: {spcMetric.lsl}</span>
                <span>USL: {spcMetric.usl}</span>
              </div>
            </div>

            {/* Standard Deviation */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Standart Sapma (s / σ)
                </span>
                <BarChart3 className="w-5 h-5 text-indigo-600" />
              </div>

              <div className="my-3">
                <div className="text-3xl font-black font-mono text-indigo-600">
                  {spcMetric.stdDev.toFixed(4)} <span className="text-xs text-slate-400 font-normal">{spcMetric.unit}</span>
                </div>
                <div className="text-xs text-slate-500 font-mono mt-1">
                  Dağılım Aralığı (R): {spcMetric.range.toFixed(4)} {spcMetric.unit}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex justify-between font-mono">
                <span>Min: {spcMetric.min}</span>
                <span>Max: {spcMetric.max}</span>
              </div>
            </div>

            {/* Sample Size & Defect Rate */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Toplam Ölçülen Adet (N)
                </span>
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>

              <div className="my-3">
                <div className="text-3xl font-black font-mono text-emerald-600">
                  {spcMetric.count} <span className="text-xs text-slate-400 font-normal">Numune</span>
                </div>
                <div className="text-xs font-mono mt-1">
                  Hata Oranı:{' '}
                  <span className={`font-bold ${spcMetric.outOfSpecCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    %{spcMetric.outOfSpecRate.toFixed(2)} ({spcMetric.outOfSpecCount} adet)
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex justify-between font-mono">
                <span>UCL: {spcMetric.controlLimits.ucl}</span>
                <span>LCL: {spcMetric.controlLimits.lcl}</span>
              </div>
            </div>
          </div>

          {/* Actionable Engineering Diagnosis Box */}
          {diagnosis && (
            <div className={`border rounded-2xl p-4.5 shadow-xs flex items-start gap-3.5 ${
              diagnosis.severity === 'success'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : diagnosis.severity === 'warning'
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-rose-50/70 border-rose-200 text-rose-950'
            }`}>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs shrink-0">
                <Lightbulb className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1 text-xs space-y-1">
                <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span>{diagnosis.title}</span>
                </div>
                <p className="text-slate-700 leading-relaxed font-medium">
                  {diagnosis.summary}
                </p>
                <div className="pt-1 text-slate-900 font-bold flex items-center gap-1.5">
                  <span className="text-amber-600">Tavsiye Edilen Aksiyon:</span>
                  <span>{diagnosis.action}</span>
                </div>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Chart 1: Histogram & Normal Distribution vs Tolerances */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Frekans Dağılımı & Normal Dağılım Histogramı
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ölçüm frekanslarının LSL ({spcMetric.lsl}) ve USL ({spcMetric.usl}) tolerans sınırlarına göre dağılımı.
                  </p>
                </div>
              </div>

              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spcMetric.histogramBins} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="midpoint"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={(val) => Number(val).toFixed(2)}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(val, name, item) => [`${val} Numune`, `Aralık: ${item.payload.rangeLabel}`]}
                    />
                    {/* Reference Lines */}
                    <ReferenceLine x={spcMetric.lsl} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: `LSL ${spcMetric.lsl}`, fill: '#f43f5e', fontSize: 10, fontWeight: 'bold' }} />
                    <ReferenceLine x={spcMetric.nominal} stroke="#2563eb" strokeDasharray="3 3" label={{ value: `Nominal ${spcMetric.nominal}`, fill: '#2563eb', fontSize: 10, fontWeight: 'bold' }} />
                    <ReferenceLine x={spcMetric.usl} stroke="#10b981" strokeDasharray="4 4" label={{ value: `USL ${spcMetric.usl}`, fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} />
                    <ReferenceLine x={spcMetric.mean} stroke="#f59e0b" strokeWidth={2} label={{ value: `X̄ ${spcMetric.mean.toFixed(3)}`, fill: '#f59e0b', fontSize: 10, fontWeight: 'bold' }} />
                    
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {spcMetric.histogramBins.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isOutOfSpec ? '#e11d48' : '#2563eb'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Sequential X-bar Control Trend Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    X-bar Kontrol Trend Grafiği (Zaman Serisi)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ölçümlerin parti ve zamana göre kontrol limitleri (UCL / LCL) içindeki kararlılığı.
                  </p>
                </div>
              </div>

              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={spcMetric.historyValues.map((h, i) => ({
                      index: i + 1,
                      value: h.value,
                      lot: h.lotNumber,
                      status: h.status,
                      operator: h.operator,
                    }))}
                    margin={{ top: 20, right: 20, left: -10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="index" stroke="#94a3b8" fontSize={11} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      domain={[
                        Number((Math.min(spcMetric.lsl, spcMetric.min) - 0.01).toFixed(3)),
                        Number((Math.max(spcMetric.usl, spcMetric.max) + 0.01).toFixed(3)),
                      ]}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(val, name, item) => [
                        `${val} ${spcMetric.unit}`,
                        `Parti: ${item.payload.lot} | Operatör: ${item.payload.operator}`
                      ]}
                    />
                    {/* Control & Spec Limits */}
                    <ReferenceLine y={spcMetric.usl} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `USL ${spcMetric.usl}`, fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
                    <ReferenceLine y={spcMetric.lsl} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `LSL ${spcMetric.lsl}`, fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
                    <ReferenceLine y={spcMetric.nominal} stroke="#2563eb" strokeDasharray="2 2" />
                    <ReferenceLine y={spcMetric.controlLimits.cl} stroke="#f59e0b" label={{ value: `CL ${spcMetric.controlLimits.cl}`, fill: '#f59e0b', fontSize: 10, fontWeight: 'bold' }} />

                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ r: 3.5, fill: '#2563eb' }}
                      activeDot={{ r: 6, fill: '#f59e0b' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">X̄-R Alt Grup Analizi</h3><p className="mt-1 text-xs text-slate-500">{spcMetric.xbarR.subgroupCount} alt grup · n={spcMetric.xbarR.subgroupSize}</p><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-blue-50 p-2"><b>X̄̄</b><div>{spcMetric.xbarR.xbarbar}</div></div><div className="rounded-xl bg-emerald-50 p-2"><b>X̄ UCL/LCL</b><div>{spcMetric.xbarR.xbarUcl} / {spcMetric.xbarR.xbarLcl}</div></div><div className="rounded-xl bg-amber-50 p-2"><b>R̄ · R UCL</b><div>{spcMetric.xbarR.rbar} · {spcMetric.xbarR.rUcl}</div></div></div><div className="mt-3 h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={spcMetric.xbarR.points}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="timestamp" hide/><YAxis domain={['auto','auto']}/><Tooltip/><Line dataKey="mean" name="X̄" stroke="#2563eb" dot={false}/><Line dataKey="range" name="R" stroke="#f59e0b" dot={false}/><ReferenceLine y={spcMetric.xbarR.xbarUcl} stroke="#ef4444" strokeDasharray="3 3"/><ReferenceLine y={spcMetric.xbarR.xbarLcl} stroke="#ef4444" strokeDasharray="3 3"/></LineChart></ResponsiveContainer></div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">I-MR Bireysel Analiz</h3><p className="mt-1 text-xs text-slate-500">Ardışık bireysel ölçümler ve hareketli aralık</p><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-blue-50 p-2"><b>I UCL</b><div>{spcMetric.imr.individualUcl}</div></div><div className="rounded-xl bg-blue-50 p-2"><b>I LCL</b><div>{spcMetric.imr.individualLcl}</div></div><div className="rounded-xl bg-violet-50 p-2"><b>MR̄ · MR UCL</b><div>{spcMetric.imr.movingRangeAverage} · {spcMetric.imr.movingRangeUcl}</div></div></div><div className="mt-3 h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={spcMetric.imr.points}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="timestamp" hide/><YAxis domain={['auto','auto']}/><Tooltip/><Line dataKey="value" name="I" stroke="#7c3aed" dot={false}/><Line dataKey="movingRange" name="MR" stroke="#0f766e" dot={false}/><ReferenceLine y={spcMetric.imr.individualUcl} stroke="#ef4444" strokeDasharray="3 3"/><ReferenceLine y={spcMetric.imr.individualLcl} stroke="#ef4444" strokeDasharray="3 3"/></LineChart></ResponsiveContainer></div></div>
            </div>

            {/* Whole Control Plan Characteristics Capability Matrix Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  {currentPlan?.version} Kontrol Planı - Tüm Karakteristikler Yetenek Matrisi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bu parçaya ait tüm ölçüm noktalarının Cp, Cpk, ortalama sapma ve kabul durumlarının toplu analizi.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 font-mono uppercase text-[11px] bg-slate-50">
                    <th className="p-3.5 font-bold">No</th>
                    <th className="p-3.5 font-bold font-sans">Karakteristik Adı</th>
                    <th className="p-3.5 font-bold">Nominal & Tol</th>
                    <th className="p-3.5 font-bold">Ölçüm</th>
                    <th className="p-3.5 font-bold">Ortalama (X̄)</th>
                    <th className="p-3.5 font-bold">Std Sapma (s)</th>
                    <th className="p-3.5 font-bold">Cp</th>
                    <th className="p-3.5 font-bold">Cpk</th>
                    <th className="p-3.5 font-bold">Hata %</th>
                    <th className="p-3.5 font-bold text-right font-sans">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {allPlanMetrics.map((m) => {
                    const badge = getCpkBadge(m.cpk);
                    const isSelected = activeChar?.id === m.characteristicId;

                    return (
                      <tr
                        key={m.characteristicId}
                        onClick={() => setSelectedCharId(m.characteristicId)}
                        className={`hover:bg-slate-50 cursor-pointer transition ${
                          isSelected ? 'bg-blue-50/60 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        <td className="p-3.5">
                          <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[11px]">
                            {m.pointNo}
                          </span>
                        </td>
                        <td className="p-3.5 font-sans font-bold text-slate-900">
                          {m.characteristicName}
                        </td>
                        <td className="p-3.5 text-slate-500 font-medium">
                          {m.nominal} [{m.lsl} ~ {m.usl}] {m.unit}
                        </td>
                        <td className="p-3.5 font-bold">{m.count}</td>
                        <td className="p-3.5 text-blue-600 font-bold">{m.mean.toFixed(3)}</td>
                        <td className="p-3.5 text-indigo-600 font-bold">{m.stdDev.toFixed(4)}</td>
                        <td className="p-3.5 font-semibold">{m.cp.toFixed(2)}</td>
                        <td className={`p-3.5 font-black text-sm ${badge.color}`}>
                          {m.cpk.toFixed(2)}
                        </td>
                        <td className="p-3.5">
                          <span className={m.outOfSpecRate > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                            %{m.outOfSpecRate.toFixed(1)}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-sans">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
          <Activity className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-800">Henüz Yeterli Ölçüm Kaydı Bulunmuyor</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Seçili ürün ve karakteristik için henüz kaydedilmiş ölçüm verisi yok. Operatör Terminali'nden ölçüm yaparak veya örnek verileri yükleyerek grafikleri görebilirsiniz.
          </p>
        </div>
      )}
    </div>
  );
};
