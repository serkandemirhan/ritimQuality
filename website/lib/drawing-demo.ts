import {drawingRules,isoTolerance} from './drawing-tolerances';
import {metadataRegions,inMetadata} from './drawing-regions';
import {reportFields,type ReportMetadata} from './report-metadata';
export type SourceText = {id:number; text:string; x:number; y:number; width:number; height:number; confidence?:number; origin?:'ocr'; rotation?:number};
export type ControlPoint = {
  id:string; name:string; original:string; nominal:number; lower:number|null; upper:number|null;
  unit:string; x:number|null; y:number|null; source:'text'|'ocr'|'ai'; reviewed:boolean; toleranceSource?:string;
};
export type DemoReading = {value:number; note:string; kind:'manual'|'simulated'; rawInput?:string};
export type DemoDocument = {name:string; pages:number; width:number; height:number; preview:string; sources:SourceText[]; points:ControlPoint[]; extraction?:'text'|'ocr'; warning?:string};
export const MAX_MANUAL = 5;
export const MAX_POINTS = 50;
export type ParsedMeasurement={value:number;rawInput:string;canonical:string};
export function parseMeasurementInput(raw:string):ParsedMeasurement|null {
  const rawInput=raw.trim();
  if(!/^[+-]?\d+(?:[.,]\d+)?$/.test(rawInput))return null;
  // Measurement inputs use a single comma OR period as the decimal separator.
  // Thousands separators are intentionally unsupported because values such as
  // 12.312 are otherwise ambiguous. Internal values are always plain numbers.
  const canonical=rawInput.replace(',','.');
  const value=Number(canonical);
  return Number.isFinite(value)?{value,rawInput,canonical}:null;
}
export function numeric(raw:string):number|null {return parseMeasurementInput(raw)?.value??null;}
export function verdict(value:number,p:ControlPoint) {
  if(p.lower===null||p.upper===null||p.lower>p.upper||!p.unit)return 'unknown';
  return value>=p.lower&&value<=p.upper?'pass':'fail';
}
export function displayNumber(n:number|null){return n===null?'—':n.toLocaleString('tr-TR',{useGrouping:false,maximumFractionDigits:8});}
const round=(n:number)=>Number(n.toFixed(8));

// Conservative fallback: only explicit dimension syntax. Bare title-block numbers,
// dates, scales, thread designations and inferred general tolerances are excluded.
export function extractDimensions(sources:SourceText[]):ControlPoint[] {
  const points:ControlPoint[]=[];
  const num='\\d+(?:[.,]\\d+)?';
  const symmetric=new RegExp(`^\\s*(?:\\d+\\s*[xX×]\\s*)?([Ø⌀øRr]?)\\s*(${num})\\s*(?:±|\\+\\s*[/]\\s*-)\\s*(${num})\\s*(mm|in|inch|°)?\\s*$`);
  const asymmetric=new RegExp(`^\\s*([Ø⌀øRr]?)\\s*(${num})\\s*([+-]${num})\\s*[/ ]\\s*([+-]${num})\\s*(mm|in|inch|°)?\\s*$`);
  const diameter=new RegExp(`^\\s*(?:\\d+\\s*[xX×]\\s*)?([Ø⌀øRr])\\s*(${num})\\s*(mm|in|inch)?\\s*(?:THRU|THROUGH)?\\s*$`,'i');
  const bare=new RegExp(`^(${num})\\s*(mm|inch|°)?$`);
  const rules=drawingRules(sources),defaultUnit=rules.unit;
  const excluded=metadataRegions(sources);
  for(const source of sources){
    if(inMetadata(source,excluded))continue;
    const text=source.text.replace(/[−–]/g,'-').trim();
    if(source.origin==='ocr'&&(source.confidence??0)<85)continue;
    const sym=text.match(symmetric),asym=text.match(asymmetric),dia=text.match(diameter);
    // OCR bare numbers are only candidates in the drawing area, never title/notes
    // regions. They have NO inferred tolerance and require explicit review.
    // Opposite-direction OCR can read 80 as 08. Do not turn such ambiguous
    // leading-zero integers into a different nominal dimension.
    const standalone=source.origin==='ocr'&&source.y<72&&source.x>2&&source.x<96&&!/^0\d/.test(text)?text.match(bare):null;
    const match=sym||asym||dia||(standalone?['','',''+standalone[1]]:null);if(!match)continue;
    const nominal=numeric(match[2]);if(nominal===null)continue;
    let lower:number|null=null,upper:number|null=null;
    if(sym){const tol=numeric(sym[3])!;lower=round(nominal-tol);upper=round(nominal+tol);}
    if(asym){const a=numeric(asym[3])!,b=numeric(asym[4])!;lower=round(nominal+Math.min(a,b));upper=round(nominal+Math.max(a,b));}
    const unit=(sym?.[4]||asym?.[5]||dia?.[3]||standalone?.[2]||defaultUnit).replace(/^in$/,'inch');
    const name=/[Ø⌀ø]/.test(match[1])?'Çap':/[Rr]/.test(match[1])?'Yarıçap':unit==='°'?'Açı':'Uzunluk';
    let toleranceSource=sym||asym?'Ölçünün yanında belirtilen tolerans':'';
    if(lower===null&&rules.isoClass&&unit==='mm'&&(name==='Uzunluk'||name==='Çap')){
      const tolerance=isoTolerance(nominal,rules.isoClass,'linear');
      if(tolerance!==null){lower=round(nominal-tolerance);upper=round(nominal+tolerance);toleranceSource=`ISO 2768-${rules.isoClass} · Genel doğrusal tolerans ±${displayNumber(tolerance)} mm`;}
    }
    const existing=source.origin==='ocr'?points.find(p=>p.nominal===nominal&&p.x!==null&&p.y!==null&&Math.abs(p.x-(source.x+source.width/2))<1.5&&Math.abs(p.y-(source.y+source.height/2))<1.5):undefined;
    if(existing){
      // A later rotated pass may recover the tiny explicit tolerance missed by
      // the first pass. Never keep a general tolerance over that direct reading.
      if((sym||asym)&&existing.toleranceSource!=='Ölçünün yanında belirtilen tolerans')Object.assign(existing,{original:source.text,lower,upper,toleranceSource,unit});
      continue;
    }
    points.push({id:`point-${points.length+1}`,name:`${name} ${displayNumber(nominal)}`,original:source.text,nominal,lower,upper,unit,x:source.x+source.width/2,y:source.y+source.height/2,source:source.origin==='ocr'?'ocr':'text',reviewed:false,toleranceSource});
    if(points.length===MAX_POINTS)break;
  }
  return points;
}

export function csvReport(points:ControlPoint[],readings:Record<string,DemoReading>,metadata?:ReportMetadata) {
  const cell=(value:unknown)=>{
    const text=String(value??'');
    const safe=typeof value==='string'&&/^[=+\-@\t\r]/.test(text)?"'"+text:text;
    return '"'+safe.replace(/"/g,'""')+'"';
  };
  const rows=points.map((p,i)=>{const r=readings[p.id];return [i+1,p.name,p.original,p.nominal,p.lower,p.upper,p.unit,r?.value,r?.kind==='simulated'?'Otomatik örnek':r?'Kullanıcı girişi':'Ölçülmedi',r?.kind==='simulated'?'Değerlendirilmez':r?({pass:'Uygun',fail:'Uygunsuz',unknown:'Tolerans eksik'}[verdict(r.value,p)]):'—',r?.note];});
  const header=metadata?[['Ritim Quality','Demo ölçüm raporu'],...reportFields.map(([key,label])=>[label,metadata[key]]),[]]:[];
  return '\uFEFF'+[...header,['No','Kontrol noktası','Çizimdeki ifade','Nominal','Alt sınır','Üst sınır','Birim','Değer','Veri türü','Sonuç','Not'],...rows].map(row=>row.map(cell).join(';')).join('\r\n');
}
