import type { Characteristic, ControlPlan, InspectionLog, SampleMeasurement, SPCMetric } from '../types';
import {formatSpcMeasurement} from './spcFormat';

export interface SPCFilters { startDate?:string; endDate?:string; operator?:string; lotNumber?:string; machineNo?:string; }

/** Every consumer uses the exact product, plan and immutable revision scope. */
export function selectPlanLogs(plan:ControlPlan,logs:InspectionLog[]):InspectionLog[]{
  return logs.filter(log=>log.productId===plan.productId&&log.controlPlanId===plan.id&&log.controlPlanVersion===plan.version);
}
function validValue(sample:SampleMeasurement,id:string):number|null{
  const value=sample.values[id],status=sample.statuses[id];
  return typeof value==='number'&&Number.isFinite(value)&&['pass','warning','fail'].includes(status)?value:null;
}
const average=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/values.length;
const extremes=(values:number[])=>values.reduce((result,value)=>({min:Math.min(result.min,value),max:Math.max(result.max,value)}),{min:Infinity,max:-Infinity});
const ratio=(numerator:number,denominator:number):number|null=>{if(!(denominator>0))return null;const value=numerator/denominator;return Number.isFinite(value)?value:null;};
const constants:Record<number,{a2:number;d3:number;d4:number}>={2:{a2:1.88,d3:0,d4:3.267},3:{a2:1.023,d3:0,d4:2.574},4:{a2:.729,d3:0,d4:2.282},5:{a2:.577,d3:0,d4:2.114},6:{a2:.483,d3:0,d4:2.004},7:{a2:.419,d3:.076,d4:1.924},8:{a2:.373,d3:.136,d4:1.864},9:{a2:.337,d3:.184,d4:1.816},10:{a2:.308,d3:.223,d4:1.777}};

export const SPCEngine = {
  calculateMetric:(char:Characteristic,logs:InspectionLog[],filters:SPCFilters={}):SPCMetric|null=>{
    if(!Number.isFinite(char.usl)||!Number.isFinite(char.lsl)||char.usl<=char.lsl)return null;
    const groups=logs.filter(log=>
      (!filters.startDate||new Date(log.timestamp)>=new Date(filters.startDate))&&
      (!filters.endDate||new Date(log.timestamp)<=new Date(filters.endDate))&&
      (!filters.operator||log.operatorName===filters.operator)&&
      (!filters.lotNumber||log.lotNumber===filters.lotNumber)&&
      (!filters.machineNo||log.machineNo===filters.machineNo)
    ).slice().sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime())
      .map(log=>({log,samples:log.samples.flatMap(sample=>{const value=validValue(sample,char.id);return value===null?[]:[{sample,value}];})}))
      .filter(group=>group.samples.length>0);
    const historyValues:SPCMetric['historyValues']=groups.flatMap(({log,samples})=>samples.map(({sample,value})=>({
      timestamp:log.timestamp,lotNumber:log.lotNumber,operator:log.operatorName,sampleIndex:sample.sampleIndex,value,
      status:value<char.lsl||value>char.usl?'fail':sample.statuses[char.id]==='warning'?'warning':'pass'
    })));
    const values=historyValues.map(point=>point.value),count=values.length;
    if(!count)return null;
    const mean=average(values),{min,max}=extremes(values),range=max-min;
    const stdDev=count>1?Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/(count-1)):0;
    let withinSquares=0,withinDof=0;
    const subgroupPoints=groups.map(({log,samples})=>{
      const subgroup=samples.map(item=>item.value),groupMean=average(subgroup),limits=extremes(subgroup);
      if(subgroup.length>1){withinSquares+=subgroup.reduce((sum,value)=>sum+(value-groupMean)**2,0);withinDof+=subgroup.length-1;}
      return {timestamp:log.timestamp,mean:groupMean,range:limits.max-limits.min,size:subgroup.length};
    });
    const withinStdDev=withinDof>0?Math.sqrt(withinSquares/withinDof):stdDev;
    const tolerance=char.usl-char.lsl,cp=ratio(tolerance,6*withinStdDev),cpu=ratio(char.usl-mean,3*withinStdDev),cpl=ratio(mean-char.lsl,3*withinStdDev);
    const cpk=cpu===null||cpl===null?null:Math.min(cpu,cpl);
    const pp=ratio(tolerance,6*stdDev),ppu=ratio(char.usl-mean,3*stdDev),ppl=ratio(mean-char.lsl,3*stdDev),ppk=ppu===null||ppl===null?null:Math.min(ppu,ppl);
    const capabilityUnavailableReason=cpk!==null?null:count<2?'Süreç yeteneği için en az iki geçerli ölçüm gereklidir.':'Alt grup / ölçüm yayılımı sıfır; Cp ve Cpk hesaplanamadı. Ölçüm çözünürlüğünü ve tekrarları inceleyin.';
    const capabilityStatus:SPCMetric['capabilityStatus']=cpk===null?'unavailable':cpk>=1.67?'excellent':cpk>=1.33?'capable':cpk>=1?'acceptable':'incapable';
    const outOfSpecCount=values.filter(value=>value<char.lsl||value>char.usl).length;
    const movingRanges=values.slice(1).map((value,index)=>Math.abs(value-values[index]));
    const movingRangeAverage=movingRanges.length?average(movingRanges):0;
    const ucl=mean+2.66*movingRangeAverage,lcl=mean-2.66*movingRangeAverage;
    const sizes=new Set(subgroupPoints.map(point=>point.size)),subgroupSize=subgroupPoints[0].size;
    const constant=sizes.size===1?constants[subgroupSize]:undefined;
    const xbarRUnavailableReason=subgroupPoints.length<2?'X̄-R için en az iki alt grup gereklidir.':sizes.size!==1?'Alt grup boyutları farklı. X̄-R hesaplanmadı; I-MR analizini kullanın.':subgroupSize===1?'Tek numuneli oturumlar için I-MR analizi kullanılır.':!constant?'X̄-R yalnızca eşit büyüklükte 2–10 numuneli alt gruplar için desteklenir.':null;
    const xbarbar=average(subgroupPoints.map(point=>point.mean)),rbar=average(subgroupPoints.map(point=>point.range));
    const dataMin=Math.min(min,char.lsl-stdDev),dataMax=Math.max(max,char.usl+stdDev),binWidth=(dataMax-dataMin)/9;
    const histogramBins:SPCMetric['histogramBins']=Array.from({length:9},(_,i)=>{
      const start=dataMin+i*binWidth,end=i===8?dataMax:dataMin+(i+1)*binWidth,midpoint=start+(end-start)/2;
      return {rangeLabel:formatSpcMeasurement(start,char)+' – '+formatSpcMeasurement(end,char),midpoint,
        count:values.filter(value=>value>=start&&(i===8?value<=end:value<end)).length,isOutOfSpec:midpoint<char.lsl||midpoint>char.usl};
    });
    return {characteristicId:char.id,characteristicName:char.name,pointNo:char.pointNo,unit:char.unit,precision:char.precision,nominal:char.nominal,lsl:char.lsl,usl:char.usl,
      count,mean,stdDev,min,max,range,cp,cpk,cpu,cpl,pp,ppk,capabilityStatus,capabilityUnavailableReason,outOfSpecCount,outOfSpecRate:outOfSpecCount/count*100,
      historyValues,histogramBins,controlLimits:{ucl,lcl,cl:mean},xbarRUnavailableReason,
      xbarR:xbarRUnavailableReason||!constant?null:{subgroupCount:subgroupPoints.length,subgroupSize,xbarbar,rbar,xbarUcl:xbarbar+constant.a2*rbar,xbarLcl:xbarbar-constant.a2*rbar,rUcl:constant.d4*rbar,rLcl:constant.d3*rbar,points:subgroupPoints.map(({timestamp,mean,range})=>({timestamp,mean,range}))},
      imr:{individualUcl:ucl,individualLcl:lcl,movingRangeAverage,movingRangeUcl:3.267*movingRangeAverage,points:historyValues.map((point,index)=>({timestamp:point.timestamp,value:point.value,movingRange:index===0?null:movingRanges[index-1]}))}
    };
  },
  calculateAllForPlan:(plan:ControlPlan,logs:InspectionLog[]):SPCMetric[]=>{
    const scoped=selectPlanLogs(plan,logs);
    return plan.characteristics.flatMap(char=>{const metric=SPCEngine.calculateMetric(char,scoped);return metric?[metric]:[];});
  },
  // Generate automated industrial quality diagnosis & recommendation
  generateDiagnosis: (metric: SPCMetric): {
    title: string;
    summary: string;
    action: string;
    severity: 'success' | 'warning' | 'danger' | 'info';
  } => {
    if(metric.cpk===null||metric.cp===null)return {title:'Süreç yeteneği hesaplanamadı',summary:metric.capabilityUnavailableReason||'Yeterli yayılım yok.',action:'Numune geçmişini ve ölçüm çözünürlüğünü inceleyin.',severity:'info'};
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
          summary: `Cp = ${metric.cp.toFixed(2)}, Cpk = ${metric.cpk.toFixed(2)}. Süreç toleransları karşılayabiliyor ancak ortalama ${direction} ${formatSpcMeasurement(Math.abs(offset),metric)} ${metric.unit} sapmış.`,
          action: `Tezgah takım boyu / ofsetini (Work Offset) ${isShiftedHigh ? '-' : '+'}${formatSpcMeasurement(Math.abs(offset),metric)} ${metric.unit} ayarlayarak ortalamayı nominale çekiniz.`,
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
