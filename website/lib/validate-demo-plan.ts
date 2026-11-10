import {extractDimensions,type ControlPoint,type SourceText} from './drawing-demo';
import {inMetadata,metadataRegions} from './drawing-regions';

/** Provider output is a draft. Check metadata exclusions and use direct source
 * tolerances over a model's general-tolerance inference for the same feature. */
export function validateAnalyzedPoints(raw:unknown,sources:SourceText[]):ControlPoint[]{
  if(!Array.isArray(raw)||raw.length>50)throw Error('Analiz yanıtı doğrulanamadı.');
  const regions=metadataRegions(sources),canonical=extractDimensions(sources);
  return raw.flatMap((p:Record<string,unknown>,index:number):ControlPoint[]=>{
    const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
    if(!p||typeof p.name!=='string'||p.name.length>200||typeof p.original!=='string'||p.original.length>1000||!finite(p.nominal)||typeof p.unit!=='string'||!['mm','inch','°','µm',''].includes(p.unit))throw Error('Analiz yanıtı doğrulanamadı.');
    const source=sources.find(s=>s.id===p.sourceId);
    const x=source?source.x+source.width/2:finite(p.x)&&p.x>=0&&p.x<=100?p.x:null;
    const y=source?source.y+source.height/2:finite(p.y)&&p.y>=0&&p.y<=100?p.y:null;
    if(source&&inMetadata(source,regions)||x!==null&&y!==null&&inMetadata({id:0,text:'',x,y,width:0,height:0},regions))return [];
    const direct=source?canonical.find(c=>c.toleranceSource==='Ölçünün yanında belirtilen tolerans'&&c.x!==null&&c.y!==null&&Math.abs(c.x-(source.x+source.width/2))<.1&&Math.abs(c.y-(source.y+source.height/2))<.1):undefined;
    if(direct&&direct.nominal!==p.nominal)return [];
    const lower=direct?direct.lower:finite(p.lower)?p.lower:null,upper=direct?direct.upper:finite(p.upper)?p.upper:null;
    const limitsValid=lower!==null&&upper!==null&&lower<=upper;
    return [{id:`point-${index+1}`,name:p.name,original:direct?.original||p.original,nominal:p.nominal,lower:limitsValid?lower:null,upper:limitsValid?upper:null,unit:direct?.unit||p.unit,x,y,source:'ai',reviewed:false,toleranceSource:direct?.toleranceSource||'Yapay zekâ taslağı · Çizimden doğrulayın'}];
  });
}
