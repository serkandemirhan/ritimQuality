import type {SourceText} from './drawing-demo';
type Region={left:number;top:number;right:number;bottom:number};
const plain=(text:string)=>text.toLocaleUpperCase('tr-TR').replaceAll('İ','I').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const categories=[/\bREV(?:ISION|IZYON)?\b/,/DRAWN BY|DESIGNED BY|CIZEN|TASARLAYAN/,/MATERIAL|MALZEME/,/DRAWING (?:NO|DESCRIPTION)|RESIM ACIKLAMASI|PART\/ASSEMBLY|PARCA\/MONTAJ/,/PAGE NR|SHEET|SAYFA NO/,/APPROVAL|ONAY|CHECK BY/,/PDM CODE|PDM KODU|ANTET/];

/** Infer metadata regions from labelled fields, not a fixed bottom-of-page crop.
 * Sources remain available to unit/tolerance-note extraction. */
export function metadataRegions(sources:SourceText[]):Region[]{
  const regions:Region[]=[];
  const anchors=sources.flatMap(s=>{const category=categories.findIndex(r=>r.test(plain(s.text)));return category<0?[]:[{...s,category}];});
  const footer=anchors.filter(s=>s.y>65);
  if(new Set(footer.map(s=>s.category)).size>=3)regions.push({left:Math.max(0,Math.min(...footer.map(s=>s.x))-2),top:Math.min(...footer.map(s=>s.y))-1,right:100,bottom:100});
  for(const header of anchors.filter(s=>s.category===0)){
    // Revision values are below (or just to the right of) their own field label.
    regions.push({left:header.x-1,top:header.y-.3,right:header.x+Math.max(4,header.width)+1,bottom:header.y+header.height+4});
  }
  const table=sources.filter(s=>/\b(?:FINE\s*\(F\)|MEDIUM|COARSE\s*\([CV]\))/.test(plain(s.text))&&s.y>65);
  const tableClasses=new Set(table.flatMap(s=>plain(s.text).match(/FINE\s*\(F\)|MEDIUM|COARSE\s*\([CV]\)/g)||[]));
  if(tableClasses.size>=2)regions.push({left:Math.min(...table.map(s=>s.x))-4,top:Math.min(...table.map(s=>s.y))-2,right:Math.max(...table.map(s=>s.x+s.width))+4,bottom:100});
  return regions;
}
export function inMetadata(source:SourceText,regions:Region[]){const x=source.x+source.width/2,y=source.y+source.height/2;return regions.some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom);}

/** Text widths follow the text baseline, including rotated dimension strings. */
export function textBounds(t:number[],width:number,pageWidth:number,pageHeight:number){
  const length=Math.hypot(t[0],t[1])||1,dx=t[0]/length*width,dy=t[1]/length*width;
  const xs=[t[4],t[4]+dx,t[4]+t[2],t[4]+dx+t[2]],ys=[t[5],t[5]+dy,t[5]+t[3],t[5]+dy+t[3]];
  return {x:Math.min(...xs)/pageWidth*100,y:Math.min(...ys)/pageHeight*100,width:(Math.max(...xs)-Math.min(...xs))/pageWidth*100,height:(Math.max(...ys)-Math.min(...ys))/pageHeight*100,rotation:Math.round(Math.atan2(t[1],t[0])*180/Math.PI)};
}
