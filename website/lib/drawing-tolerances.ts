import type {SourceText} from './drawing-demo';

export type DrawingRules={unit:string;isoClass:'f'|'m'|'c'|'v'|null;isoNote:string;holeNote:string};
export function drawingRules(sources:SourceText[]):DrawingRules{
  const reliable=sources.filter(s=>s.origin!=='ocr'||(s.confidence??0)>=85);
  const text=reliable.map(s=>s.text).join(' ');
  const unit=text.match(/(?:birim|units?|(?:all )?dimensions(?: are)? in|t[üu]m\s+[öo]l[çc][üu]ler)\s*[:=]?\s*(mm|inch|inches)\b/i)?.[1]?.toLowerCase();
  const isoNotes=reliable.filter(s=>/\bISO\s*2768(?:\s*-\s*1)?\s*[-–]\s*[fmcv](?:[HKL])?\b/i.test(s.text));
  const classes=new Set(isoNotes.map(s=>s.text.match(/\bISO\s*2768(?:\s*-\s*1)?\s*[-–]\s*([fmcv])(?:[HKL])?\b/i)![1].toLowerCase()));
  return {unit:unit==='mm'?'mm':unit?'inch':'',isoClass:classes.size===1?[...classes][0] as DrawingRules['isoClass']:null,isoNote:isoNotes[0]?.text.trim()||'',holeNote:sources.find(s=>/hole\s+cent|delik\s+merkez/i.test(s.text))?.text.trim()||''};
}

// ISO 2768-1:1989, Tables 1 and 2. Only applicable when explicitly referenced
// on the drawing. Angles need shorter-side length and are not inferred here.
// https://www.eurotools.eu/sub/eurotools.eu/images/downloads/General_Tolerance_Standard_ISO-2768-1pdf.pdf
const bands=[3,6,30,120,400,1000,2000,4000];
const linear={f:[.05,.05,.1,.15,.2,.3,.5,null],m:[.1,.1,.2,.3,.5,.8,1.2,2],c:[.2,.3,.5,.8,1.2,2,3,4],v:[null,.5,1,1.5,2.5,4,6,8]};
export function isoTolerance(nominal:number,cls:NonNullable<DrawingRules['isoClass']>,kind:'linear'|'edge'){
  if(nominal<.5||!Number.isFinite(nominal))return null;
  if(kind==='edge')return (cls==='f'||cls==='m'?[.2,.5,1]:[.4,1,2])[nominal<=3?0:nominal<=6?1:2];
  const index=bands.findIndex(max=>nominal<=max);return index<0?null:linear[cls][index];
}
