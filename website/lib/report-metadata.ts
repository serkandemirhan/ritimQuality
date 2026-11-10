import type {SourceText} from './drawing-demo';

export const reportFields=[
  ['partName','Parça adı'],['partNumber','Parça / stok kodu'],['customer','Müşteri'],
  ['drawingNumber','Teknik resim no'],['revision','Revizyon'],['material','Malzeme'],
  ['orderNumber','Sipariş no'],['lotNumber','Lot / seri no'],['sampleNumber','Numune no'],
  ['inspector','Ölçümü yapan'],['instrument','Ölçüm cihazı'],['reportNumber','Rapor no'],['reportDate','Rapor tarihi'],
] as const;
export type ReportField=typeof reportFields[number][0];
export type ReportMetadata=Record<ReportField,string>;

/** Example header values belong to the demo, never to drawing extraction. */
export function withDemoMetadata(value:ReportMetadata):ReportMetadata{
  const defaults:ReportMetadata={
    partName:'Örnek iş parçası (Demo)',partNumber:'PRC-001 (Demo)',
    customer:'Örnek İmalat A.Ş. (Demo)',drawingNumber:'TR-001 (Demo)',
    revision:'A (Demo)',material:'Alüminyum 6061 (Demo)',
    orderNumber:'SIP-001 (Demo)',lotNumber:'LOT-001 (Demo)',sampleNumber:'NUM-001 (Demo)',
    inspector:'Örnek kalite operatörü (Demo)',instrument:'Dijital kumpas (Demo)',
    reportNumber:'DEMO-001',reportDate:new Date().toLocaleDateString('sv-SE'),
  };
  return Object.fromEntries(reportFields.map(([key])=>[key,value[key]?.trim()?value[key]:defaults[key]])) as ReportMetadata;
}
const labels:Partial<Record<ReportField,RegExp>>={
  partName:/^(?:parça adı|parca adi|part name|title|başlık|teknik resim açıklaması|drawing description)$/i,
  partNumber:/^(?:parça kodu|parca kodu|part number|part no\.?|part\/assembly code|parça\/montaj kodu)$/i,
  customer:/^(?:müşteri|musteri|customer|client)(?: adı| name)?$/i,
  drawingNumber:/^(?:drawing (?:no\.?|number)|dwg\.? no\.?|teknik resim no|resim no|drawing)$/i,
  revision:/^(?:rev\.?|revision(?: no\.?)?|revizyon(?: no)?)$/i,
  material:/^(?:material|malzeme)$/i,
};
const isLabel=(value:string)=>Object.values(labels).some(pattern=>pattern!.test(value.trim()));
export function initialReportMetadata(sources:SourceText[],now=new Date()):ReportMetadata{
  const result=Object.fromEntries(reportFields.map(([key])=>[key,''])) as ReportMetadata;
  const reliable=sources.filter(s=>s.origin!=='ocr'||(s.confidence??0)>=85);
  for(const [field,pattern] of Object.entries(labels)){
    for(const source of reliable){
      const text=source.text.trim(),split=text.match(/^(.{2,50}?)\s*[:：]\s*(.+)$/);
      if(split&&pattern.test(split[1])){result[field as ReportField]=split[2].trim().slice(0,200);break;}
      if(!pattern.test(text))continue;
      const next=reliable.filter(s=>s!==source&&s.y>=source.y+source.height*.7&&s.y-source.y<5&&Math.abs(s.x-source.x)<Math.max(2,source.width*.3)&&!isLabel(s.text)&&!/[±]|\b(?:units|scale|date|legal owner)\b/i.test(s.text))
        .sort((a,b)=>(a.y-source.y)+Math.abs(a.x-source.x)-(b.y-source.y)-Math.abs(b.x-source.x))[0];
      if(next){result[field as ReportField]=next.text.trim().slice(0,200);break;}
    }
  }
  result.reportDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  result.reportNumber=`DEMO-${result.reportDate.replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  return result;
}
