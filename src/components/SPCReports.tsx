import {chartColors, chartAxis, chartTooltip, chartDate} from './ui/chartTheme';
import {Card, Field, Select, MetricCard, DataTable, Badge, Button, EmptyState, ToleranceBand} from './ui';
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

  return <div className="space-y-5 rq-spc-workspace">
    <Card><div className="rq-spc-filters"><Field label="Parça / ürün"><Select value={selectedProductId} onChange={event=>{setSelectedProductId(event.target.value);setSelectedPlanId('');setSelectedCharId('');setOperatorFilter('all');setLotFilter('all');}}>{products.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</Select></Field><Field label="Kontrol planı revizyonu"><Select value={currentPlan?.id||''} onChange={event=>{setSelectedPlanId(event.target.value);setSelectedCharId('');}}>{productPlans.map(p=><option key={p.id} value={p.id}>{p.version} · {p.isActive?'Aktif':p.status}</option>)}</Select></Field><Field label="Karakteristik"><Select value={activeChar?.id||''} onChange={event=>setSelectedCharId(event.target.value)}>{characteristics.map(c=><option key={c.id} value={c.id}>#{c.pointNo} · {c.name}</option>)}</Select></Field><Field label="Parti / lot"><Select value={lotFilter} onChange={event=>setLotFilter(event.target.value)}><option value="all">Tüm partiler</option>{lotsList.map(lot=><option key={lot} value={lot}>{lot||'Belirtilmedi'}</option>)}</Select></Field><Field label="Operatör"><Select value={operatorFilter} onChange={event=>setOperatorFilter(event.target.value)}><option value="all">Tüm operatörler</option>{operatorsList.map(name=><option key={name}>{name}</option>)}</Select></Field></div></Card>
    {spcMetric?<>
      <div className="rq-metrics-row"><MetricCard label="Cp · Süreç yeteneği" value={spcMetric.cp.toFixed(2)} detail={'Cpu '+spcMetric.cpu.toFixed(2)+' · Cpl '+spcMetric.cpl.toFixed(2)}/><MetricCard label="Cpk · Merkezlenmiş yetenek" value={spcMetric.cpk.toFixed(2)} detail={getCpkBadge(spcMetric.cpk).label} tone={spcMetric.cpk<1?'danger':spcMetric.cpk<1.33?'warning':'success'}/><MetricCard label={'Ortalama · '+spcMetric.unit} value={spcMetric.mean.toFixed(4)} detail={'Hedeften sapma: '+(spcMetric.mean-spcMetric.nominal).toFixed(4)}/><MetricCard label="Standart sapma · s" value={spcMetric.stdDev.toFixed(4)} detail={'Min '+spcMetric.min+' · Max '+spcMetric.max}/><MetricCard label="Numune sayısı" value={spcMetric.count} detail={spcMetric.outOfSpecCount+' NOK · %'+spcMetric.outOfSpecRate.toFixed(2)} tone={spcMetric.outOfSpecCount?'danger':'neutral'}/></div>
      <Card><div className="rq-chart-heading"><div><span className="rq-eyebrow">ÖLÇÜM TRENDİ</span><h2 className="rq-section-title">{activeChar?.name}</h2><p className="rq-helper">Kronolojik bireysel ölçümler · Spesifikasyon ve hesaplanan kontrol sınırları</p></div><ToleranceBand nominal={spcMetric.nominal} lsl={spcMetric.lsl} usl={spcMetric.usl} unit={spcMetric.unit}/></div>
        <div className="rq-spc-main-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={spcMetric.historyValues.map((h,i)=>({...h,index:i+1}))} margin={{top:24,right:90,left:12,bottom:16}}><CartesianGrid vertical={false} stroke={chartColors.grid}/><XAxis {...chartAxis} dataKey="index" fontSize={11} stroke="#77859a"/><YAxis {...chartAxis} width={65} fontSize={11} stroke="#77859a" domain={[Math.min(spcMetric.min,spcMetric.lsl,spcMetric.controlLimits.lcl)-(spcMetric.usl-spcMetric.lsl)*.15,Math.max(spcMetric.max,spcMetric.usl,spcMetric.controlLimits.ucl)+(spcMetric.usl-spcMetric.lsl)*.15]} tickFormatter={value=>Number(value).toFixed(3)}/><Tooltip {...chartTooltip} labelFormatter={value=>'Ölçüm #'+value} formatter={(value,name,item)=>[String(value)+' '+spcMetric.unit,item.payload.status==='fail'?'NOK · '+item.payload.lotNumber:'Ölçüm · '+item.payload.lotNumber]}/>
        <ReferenceLine y={spcMetric.usl} stroke={chartColors.specification} strokeDasharray="4 4" label={{value:'USL '+spcMetric.usl,position:'right',fontSize:10,fill:'#be2846'}}/><ReferenceLine y={spcMetric.lsl} stroke={chartColors.specification} strokeDasharray="4 4" label={{value:'LSL '+spcMetric.lsl,position:'right',fontSize:10,fill:'#be2846'}}/><ReferenceLine y={spcMetric.nominal} stroke={chartColors.target} label={{value:'Hedef',position:'right',fontSize:10}}/><ReferenceLine y={spcMetric.controlLimits.ucl} stroke={chartColors.control} strokeDasharray="2 4" label={{value:'UCL',position:'right',dy:-10,fontSize:10,fill:'#93641a'}}/><ReferenceLine y={spcMetric.controlLimits.lcl} stroke={chartColors.control} strokeDasharray="2 4" label={{value:'LCL',position:'right',dy:12,fontSize:10,fill:'#93641a'}}/>
        <Line type="linear" dataKey="value" name="Ölçülen" stroke={chartColors.measurement} strokeWidth={1.5} isAnimationActive={false} activeDot={{r:6}} dot={(props:any)=>{const {cx,cy,payload}=props;const nok=payload.value<spcMetric.lsl||payload.value>spcMetric.usl;return <g key={payload.index}>{nok?<path d={`M${cx-4},${cy-4}L${cx+4},${cy+4}M${cx+4},${cy-4}L${cx-4},${cy+4}`} stroke={chartColors.specification} strokeWidth={2}/>:<circle cx={cx} cy={cy} r={3} fill="#315d91"/>}</g>;}}/></LineChart></ResponsiveContainer></div><p className="rq-helper m-0">● Ölçüm · × NOK / spesifikasyon dışı · USL / LSL: spesifikasyon · UCL / LCL: kontrol sınırları</p>
      </Card>
      <div className="rq-analytics-grid"><Card><h2 className="rq-section-title">Ölçüm dağılımı</h2><p className="rq-helper">Spesifikasyon dışındaki aralıklar kırmızı gösterilir.</p><div className="rq-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={spcMetric.histogramBins} margin={{top:20,right:24,left:0,bottom:16}}><CartesianGrid vertical={false} stroke={chartColors.grid}/><XAxis {...chartAxis} dataKey="midpoint" type="number" domain={['dataMin','dataMax']} fontSize={10} tickFormatter={value=>Number(value).toFixed(2)}/><YAxis {...chartAxis} fontSize={11}/><Tooltip {...chartTooltip} formatter={(value,name,item)=>[String(value)+' numune',item.payload.rangeLabel]}/><ReferenceLine x={spcMetric.lsl} ifOverflow="extendDomain" stroke={chartColors.specification} strokeDasharray="4 4" label={{value:'LSL',fontSize:10}}/><ReferenceLine x={spcMetric.usl} ifOverflow="extendDomain" stroke={chartColors.specification} strokeDasharray="4 4" label={{value:'USL',fontSize:10}}/><ReferenceLine x={spcMetric.nominal} ifOverflow="extendDomain" stroke={chartColors.target}/><Bar dataKey="count" isAnimationActive={false} radius={[3,3,0,0]}>{spcMetric.histogramBins.map((bin,i)=><Cell key={i} fill={bin.isOutOfSpec?'#be2846':'#526f94'}/>)}</Bar></BarChart></ResponsiveContainer></div></Card>
      {diagnosis&&<Card><Badge tone={diagnosis.severity==='success'?'success':diagnosis.severity==='warning'?'warning':'danger'}>Süreç değerlendirmesi</Badge><h2 className="rq-section-title mt-4">{diagnosis.title}</h2><p className="rq-helper">{diagnosis.summary}</p><h3 className="rq-section-title">Önerilen aksiyon</h3><p className="rq-helper">{diagnosis.action}</p><dl className="rq-properties"><div><dt>Dağılım aralığı (R)</dt><dd>{spcMetric.range.toFixed(4)} {spcMetric.unit}</dd></div><div><dt>Kontrol merkezi (CL)</dt><dd>{spcMetric.controlLimits.cl}</dd></div></dl></Card>}</div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rq-card"><h3 className="font-bold text-slate-900">X̄-R Alt Grup Analizi</h3><p className="mt-1 text-xs text-slate-500">{spcMetric.xbarR.subgroupCount} alt grup · n={spcMetric.xbarR.subgroupSize}</p><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-blue-50 p-2"><b>X̄̄</b><div>{spcMetric.xbarR.xbarbar}</div></div><div className="rounded-xl bg-emerald-50 p-2"><b>X̄ UCL/LCL</b><div>{spcMetric.xbarR.xbarUcl} / {spcMetric.xbarR.xbarLcl}</div></div><div className="rounded-xl bg-amber-50 p-2"><b>R̄ · R UCL</b><div>{spcMetric.xbarR.rbar} · {spcMetric.xbarR.rUcl}</div></div></div><div className="mt-3 h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={spcMetric.xbarR.points}><CartesianGrid vertical={false} stroke={chartColors.grid}/><XAxis {...chartAxis} dataKey="timestamp" hide/><YAxis {...chartAxis} domain={['auto','auto']}/><Tooltip {...chartTooltip} labelFormatter={chartDate}/><Line isAnimationActive={false} dataKey="mean" name="X̄" stroke={chartColors.measurement} dot={false}/><Line isAnimationActive={false} dataKey="range" name="R" stroke={chartColors.range} dot={false}/><ReferenceLine y={spcMetric.xbarR.xbarUcl} stroke={chartColors.control} strokeDasharray="3 3"/><ReferenceLine y={spcMetric.xbarR.xbarLcl} stroke={chartColors.control} strokeDasharray="3 3"/></LineChart></ResponsiveContainer></div></div>
              <div className="rq-card"><h3 className="font-bold text-slate-900">I-MR Bireysel Analiz</h3><p className="mt-1 text-xs text-slate-500">Ardışık bireysel ölçümler ve hareketli aralık</p><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-blue-50 p-2"><b>I UCL</b><div>{spcMetric.imr.individualUcl}</div></div><div className="rounded-xl bg-blue-50 p-2"><b>I LCL</b><div>{spcMetric.imr.individualLcl}</div></div><div className="rounded-xl bg-violet-50 p-2"><b>MR̄ · MR UCL</b><div>{spcMetric.imr.movingRangeAverage} · {spcMetric.imr.movingRangeUcl}</div></div></div><div className="mt-3 h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={spcMetric.imr.points}><CartesianGrid vertical={false} stroke={chartColors.grid}/><XAxis {...chartAxis} dataKey="timestamp" hide/><YAxis {...chartAxis} domain={['auto','auto']}/><Tooltip {...chartTooltip} labelFormatter={chartDate}/><Line isAnimationActive={false} dataKey="value" name="I" stroke={chartColors.measurement} dot={false}/><Line isAnimationActive={false} dataKey="movingRange" name="MR" stroke={chartColors.range} dot={false}/><ReferenceLine y={spcMetric.imr.individualUcl} stroke={chartColors.control} strokeDasharray="3 3"/><ReferenceLine y={spcMetric.imr.individualLcl} stroke={chartColors.control} strokeDasharray="3 3"/></LineChart></ResponsiveContainer></div></div>
            </div>


      <section><h2 className="rq-section-title mb-3">{currentPlan?.version} · Karakteristik yetenek matrisi</h2><p className="rq-helper">Planın tüm kayıtları; üstteki parti ve operatör filtreleri ana grafiğe uygulanır.</p><DataTable label="Karakteristik yetenek matrisi"><thead><tr><th>Karakteristik</th><th>Nominal / sınırlar</th><th>N</th><th>Ortalama</th><th>s</th><th>Cp</th><th>Cpk</th><th>NOK %</th><th>Durum</th></tr></thead><tbody>{allPlanMetrics.map(m=><tr key={m.characteristicId} aria-selected={activeChar?.id===m.characteristicId}><td><Button variant="ghost" onClick={()=>setSelectedCharId(m.characteristicId)}>#{m.pointNo} {m.characteristicName}</Button></td><td className="rq-technical">{m.nominal}<small>{m.lsl} – {m.usl} {m.unit}</small></td><td className="rq-technical">{m.count}</td><td className="rq-technical">{m.mean.toFixed(4)}</td><td className="rq-technical">{m.stdDev.toFixed(4)}</td><td className="rq-technical">{m.cp.toFixed(2)}</td><td className="rq-technical">{m.cpk.toFixed(2)}</td><td className="rq-technical">{m.outOfSpecRate.toFixed(1)}</td><td><Badge tone={m.cpk<1?'danger':m.cpk<1.33?'warning':'success'}>{getCpkBadge(m.cpk).label}</Badge></td></tr>)}</tbody></DataTable></section>
    </>:<EmptyState title="Analiz için yeterli ölçüm bulunamadı" description="Seçili karakteristik ve filtreler için hesaplanabilir sayısal ölçümler gereklidir. Parti veya operatör filtresini değiştirin."/>}
  </div>;
};
