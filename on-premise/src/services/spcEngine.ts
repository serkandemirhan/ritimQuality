import { Characteristic, ControlPlan, InspectionLog, SPCMetric } from '../types';

export const SPCEngine = {
  calculateMetric: (
    char: Characteristic,
    logs: InspectionLog[],
    filterOptions?: {
      startDate?: string;
      endDate?: string;
      operator?: string;
      lotNumber?: string;
      machineNo?: string;
    }
  ): SPCMetric | null => {
    // 1. Filter logs
    let filteredLogs = logs.filter(l => {
      // Check if this log has measurements for this characteristic
      const hasValue = l.samples.some(s => typeof s.values[char.id] === 'number');
      return hasValue;
    });

    if (filterOptions) {
      if (filterOptions.startDate) {
        filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) >= new Date(filterOptions.startDate!));
      }
      if (filterOptions.endDate) {
        filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) <= new Date(filterOptions.endDate!));
      }
      if (filterOptions.operator) {
        filteredLogs = filteredLogs.filter(l => l.operatorName === filterOptions.operator);
      }
      if (filterOptions.lotNumber) {
        filteredLogs = filteredLogs.filter(l => l.lotNumber === filterOptions.lotNumber);
      }
      if (filterOptions.machineNo) {
        filteredLogs = filteredLogs.filter(l => l.machineNo === filterOptions.machineNo);
      }
    }

    // 2. Extract values and chronological history
    const historyValues: SPCMetric['historyValues'] = [];
    const values: number[] = [];

    // Sort by timestamp ascending for trend analysis
    filteredLogs
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .forEach(log => {
        log.samples.forEach(sample => {
          const val = sample.values[char.id];
          if (typeof val === 'number' && !isNaN(val)) {
            values.push(val);
            const status = sample.statuses[char.id] || (val >= char.lsl && val <= char.usl ? 'pass' : 'fail');
            historyValues.push({
              timestamp: log.timestamp,
              lotNumber: log.lotNumber,
              operator: log.operatorName,
              sampleIndex: sample.sampleIndex,
              value: val,
              status: status === 'empty' ? 'pass' : status,
            });
          }
        });
      });

    const count = values.length;
    if (count < 2 || !Number.isFinite(char.usl) || !Number.isFinite(char.lsl) || char.usl <= char.lsl) return null;

    // 3. Calculate Mean (Ortalama)
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const mean = sum / count;

    // 4. Calculate Standard Deviation (Standart Sapma s)
    let stdDev = 0;
    if (count > 1) {
      const squaredDiffs = values.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0);
      stdDev = Math.sqrt(squaredDiffs / (count - 1));
    } else {
      stdDev = 0.0001; // Avoid division by zero
    }

    // Protect against zero stdDev
    if (stdDev === 0) return null;
    const effectiveStdDev = stdDev;

    // 5. Min, Max, Range
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    let withinSquaredDiffs=0; let withinDegreesOfFreedom=0;
    filteredLogs.forEach(log=>{const subgroup=log.samples.map(sample=>sample.values[char.id]).filter((value):value is number=>typeof value==='number');if(subgroup.length>1){const subgroupMean=subgroup.reduce((sum,value)=>sum+value,0)/subgroup.length;withinSquaredDiffs+=subgroup.reduce((sum,value)=>sum+(value-subgroupMean)**2,0);withinDegreesOfFreedom+=subgroup.length-1;}});
    const withinStdDev=withinDegreesOfFreedom>0?Math.sqrt(withinSquaredDiffs/withinDegreesOfFreedom):effectiveStdDev;
    if(withinDegreesOfFreedom>0 && withinStdDev===0)return null;
    const effectiveWithinStdDev=withinStdDev;

    // 6. Capability Indices (Cp, Cpk, Cpu, Cpl, Pp, Ppk)
    const tolerance = char.usl - char.lsl;
    const cp = tolerance / (6 * effectiveWithinStdDev);
    const cpu = (char.usl - mean) / (3 * effectiveWithinStdDev);
    const cpl = (mean - char.lsl) / (3 * effectiveWithinStdDev);
    const cpk = Math.min(cpu, cpl);

    // Pp / Ppk (Total standard deviation)
    const totalSquaredDiffs = values.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0);
    const populationStdDev = stdDev;
    const pp = tolerance / (6 * populationStdDev);
    const ppu = (char.usl - mean) / (3 * populationStdDev);
    const ppl = (mean - char.lsl) / (3 * populationStdDev);
    const ppk = Math.min(ppu, ppl);

    // 7. Out of Spec Count & Rate
    const outOfSpecCount = values.filter(v => v < char.lsl || v > char.usl).length;
    const outOfSpecRate = (outOfSpecCount / count) * 100;

    const subgroupPoints=filteredLogs.map(log=>{
      const subgroup=log.samples.map(sample=>sample.values[char.id]).filter((value):value is number=>typeof value==='number');
      if(!subgroup.length)return null;
      const subgroupMean=subgroup.reduce((sum,value)=>sum+value,0)/subgroup.length;
      return {timestamp:log.timestamp,mean:subgroupMean,range:Math.max(...subgroup)-Math.min(...subgroup),size:subgroup.length};
    }).filter((point):point is {timestamp:string;mean:number;range:number;size:number}=>Boolean(point));
    const subgroupSize=Math.max(1,Math.round(subgroupPoints.reduce((sum,point)=>sum+point.size,0)/(subgroupPoints.length||1)));
    const constants:Record<number,{a2:number;d3:number;d4:number}>={2:{a2:1.88,d3:0,d4:3.267},3:{a2:1.023,d3:0,d4:2.574},4:{a2:.729,d3:0,d4:2.282},5:{a2:.577,d3:0,d4:2.114},6:{a2:.483,d3:0,d4:2.004},7:{a2:.419,d3:.076,d4:1.924},8:{a2:.373,d3:.136,d4:1.864},9:{a2:.337,d3:.184,d4:1.816},10:{a2:.308,d3:.223,d4:1.777}};
    const constant=constants[Math.min(10,Math.max(2,subgroupSize))]||constants[5];
    const xbarbar=subgroupPoints.reduce((sum,point)=>sum+point.mean,0)/(subgroupPoints.length||1);
    const rbar=subgroupPoints.reduce((sum,point)=>sum+point.range,0)/(subgroupPoints.length||1);
    const movingRanges=values.slice(1).map((value,index)=>Math.abs(value-values[index]));
    const movingRangeAverage=movingRanges.reduce((sum,value)=>sum+value,0)/(movingRanges.length||1);

    // 8. Capability Status Category
    let capabilityStatus: SPCMetric['capabilityStatus'] = 'incapable';
    if (cpk >= 1.67) {
      capabilityStatus = 'excellent';
    } else if (cpk >= 1.33) {
      capabilityStatus = 'capable';
    } else if (cpk >= 1.00) {
      capabilityStatus = 'acceptable';
    } else {
      capabilityStatus = 'incapable';
    }

    // 9. Control Limits for X-bar chart (3 Sigma limits)
    const ucl = Number((mean + 2.66 * movingRangeAverage).toFixed(4));
    const lcl = Number((mean - 2.66 * movingRangeAverage).toFixed(4));
    const cl = Number(mean.toFixed(4));

    // 10. Generate Histogram Bins with Gaussian distribution fit
    const binCount = 9;
    const dataMin = Math.min(min, char.lsl - effectiveStdDev);
    const dataMax = Math.max(max, char.usl + effectiveStdDev);
    const binWidth = (dataMax - dataMin) / binCount || 0.01;

    const histogramBins: SPCMetric['histogramBins'] = [];
    for (let i = 0; i < binCount; i++) {
      const binStart = dataMin + i * binWidth;
      const binEnd = binStart + binWidth;
      const midpoint = (binStart + binEnd) / 2;

      const binItems = values.filter(v => (i === binCount - 1 ? (v >= binStart && v <= binEnd) : (v >= binStart && v < binEnd)));
      const isOutOfSpec = midpoint < char.lsl || midpoint > char.usl;

      histogramBins.push({
        rangeLabel: `${binStart.toFixed(3)} - ${binEnd.toFixed(3)}`,
        midpoint: Number(midpoint.toFixed(3)),
        count: binItems.length,
        isOutOfSpec,
      });
    }

    return {
      characteristicId: char.id,
      characteristicName: char.name,
      pointNo: char.pointNo,
      unit: char.unit,
      nominal: char.nominal,
      usl: char.usl,
      lsl: char.lsl,
      count,
      mean: Number(mean.toFixed(4)),
      stdDev: Number(stdDev.toFixed(4)),
      min: Number(min.toFixed(4)),
      max: Number(max.toFixed(4)),
      range: Number(range.toFixed(4)),
      cp: Number(cp.toFixed(2)),
      cpk: Number(cpk.toFixed(2)),
      cpu: Number(cpu.toFixed(2)),
      cpl: Number(cpl.toFixed(2)),
      pp: Number(pp.toFixed(2)),
      ppk: Number(ppk.toFixed(2)),
      outOfSpecCount,
      outOfSpecRate: Number(outOfSpecRate.toFixed(2)),
      capabilityStatus,
      historyValues,
      histogramBins,
      controlLimits: {
        ucl,
        lcl,
        cl,
      },
      xbarR: {
        subgroupCount: subgroupPoints.length, subgroupSize,
        xbarbar: Number(xbarbar.toFixed(4)), rbar: Number(rbar.toFixed(4)),
        xbarUcl: Number((xbarbar + constant.a2 * rbar).toFixed(4)), xbarLcl: Number((xbarbar - constant.a2 * rbar).toFixed(4)),
        rUcl: Number((constant.d4 * rbar).toFixed(4)), rLcl: Number((constant.d3 * rbar).toFixed(4)),
        points: subgroupPoints.map(point => ({ timestamp: point.timestamp, mean: Number(point.mean.toFixed(4)), range: Number(point.range.toFixed(4)) })),
      },
      imr: {
        individualUcl: Number((mean + 2.66 * movingRangeAverage).toFixed(4)), individualLcl: Number((mean - 2.66 * movingRangeAverage).toFixed(4)),
        movingRangeAverage: Number(movingRangeAverage.toFixed(4)), movingRangeUcl: Number((3.267 * movingRangeAverage).toFixed(4)),
        points: historyValues.map((point, index) => ({ timestamp: point.timestamp, value: point.value, movingRange: index === 0 ? null : Number(Math.abs(point.value - historyValues[index - 1].value).toFixed(4)) })),
      },
    };
  },

  // Calculate SPC metrics for all characteristics of a control plan
  calculateAllForPlan: (plan: ControlPlan, logs: InspectionLog[]): SPCMetric[] => {
    const metrics: SPCMetric[] = [];
    plan.characteristics.forEach(char => {
      const metric = SPCEngine.calculateMetric(char, logs.filter(log=>log.controlPlanId===plan.id && log.controlPlanVersion===plan.version));
      if (metric) {
        metrics.push(metric);
      }
    });
    return metrics;
  },

  // Generate automated industrial quality diagnosis & recommendation
  generateDiagnosis: (metric: SPCMetric): {
    title: string;
    summary: string;
    action: string;
    severity: 'success' | 'warning' | 'danger' | 'info';
  } => {
    const offset = metric.mean - metric.nominal;
    const isShiftedHigh = offset > (metric.usl - metric.nominal) * 0.4;
    const isShiftedLow = offset < -(metric.nominal - metric.lsl) * 0.4;

    if (metric.cpk >= 1.67) {
      return {
        title: 'Yüksek hesaplanan süreç yeteneği',
        summary: `Cpk = ${metric.cpk.toFixed(2)} ile süreç tolerans sınırlarının çok merkezinde çalışıyor. Sonuç, kullanılan örneklem ve dağılım varsayımlarına bağlıdır.`,
        action: 'Mevcut tezgah parametrelerini ve takım ömürlerini standart operasyon prosedürü (SOP) olarak koruyun.',
        severity: 'success',
      };
    } else if (metric.cpk >= 1.33) {
      if (isShiftedHigh || isShiftedLow) {
        const direction = isShiftedHigh ? 'üst toleransa doğru (+)' : 'alt toleransa doğru (-)';
        return {
          title: 'Yetenekli Ancak Merkez Kayması Var',
          summary: `Cp = ${metric.cp.toFixed(2)}, Cpk = ${metric.cpk.toFixed(2)}. Süreç toleransları karşılayabiliyor ancak ortalama ${direction} ${Math.abs(offset).toFixed(3)} ${metric.unit} sapmış.`,
          action: `Tezgah takım boyu / ofsetini (Work Offset) ${isShiftedHigh ? '-' : '+'}${Math.abs(offset).toFixed(3)} ${metric.unit} ayarlayarak ortalamayı nominale çekiniz.`,
          severity: 'warning',
        };
      }
      return {
        title: 'Hesaplanan süreç yeteneği yeterli aralıkta',
        summary: `Cpk = ${metric.cpk.toFixed(2)} seviyesinde ve otomotiv/endüstriyel kabul kriterlerini (≥ 1.33) tam olarak sağlamaktadır.`,
        action: 'Periyodik numune ölçüm sıklığını koruyun. Kararlılığı kontrol grafikleriyle ayrıca doğrulayın.',
        severity: 'success',
      };
    } else if (metric.cpk >= 1.00) {
      return {
        title: 'Kritik Sınırda Süreç (1.00 ≤ Cpk < 1.33)',
        summary: `Cpk = ${metric.cpk.toFixed(2)}. Süreç dağılımı tolerans sınırlarına çok yakın. En ufak sıcaklık veya takım aşınmasında hurda riski doğabilir.`,
        action: 'Numune kontrol sıklığını %100 veya saat başına çıkarın. Kesici takım aşınmasını ve fikstür rijitliğini kontrol edin.',
        severity: 'warning',
      };
    } else {
      return {
        title: 'YETERSİZ SÜREÇ (Cpk < 1.00 - Hata Riski Yüksek)',
        summary: `Cpk = ${metric.cpk.toFixed(2)}, Hata Oranı: %${metric.outOfSpecRate.toFixed(1)}. Süreç tolerans aralığının dışına taşmaktadır.`,
        action: 'DURDUR VE İNCELE: 8D Kök Neden Analizi başlatın. Tezgaha bakım yapın, fikstür boşluklarını ve hammadde sertlik homojenliğini kontrol edin.',
        severity: 'danger',
      };
    }
  },
};
