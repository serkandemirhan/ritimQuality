export const sample={id:'rq-demo-shaft',name:'Kademeli mil',code:'RQ-ÖRNEK-01',revision:'A',sheet:{page:1,width:800,height:500},points:[
 {id:'diameter',number:1,name:'Büyük çap',nominal:32,lower:31.98,upper:32.02,unit:'mm',instrument:'Mikrometre',x:29,y:31},
 {id:'length',number:2,name:'Toplam boy',nominal:80,lower:79.9,upper:80.1,unit:'mm',instrument:'Dijital kumpas',x:55,y:76},
 {id:'small-diameter',number:3,name:'Küçük çap',nominal:20,lower:19.98,upper:20.02,unit:'mm',instrument:'Mikrometre',x:79,y:41},
]};
export type Measurements=Record<string,{value:number;note:string;photoName?:string}>;
export function parseMeasurement(raw:string){if(!/^[+-]?\d+(?:[.,]\d+)?$/.test(raw.trim()))return null;const n=Number(raw.trim().replace(',','.'));return Number.isFinite(n)?n:null;}
export function result(value:number,point:typeof sample.points[number]){return value>=point.lower&&value<=point.upper?'pass':'fail';}
