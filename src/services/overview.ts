import type { InspectionLog } from '../types';

export function qualityOverview(logs:InspectionLog[], now=new Date()) {
  const day=86400000;
  const start=new Date(now);start.setHours(0,0,0,0);
  const end=now.getTime();
  const current=logs.filter(l=>Date.parse(l.timestamp)>end-30*day&&Date.parse(l.timestamp)<=end);
  const previous=logs.filter(l=>Date.parse(l.timestamp)>end-60*day&&Date.parse(l.timestamp)<=end-30*day);
  const rate=(items:InspectionLog[])=>items.length?items.filter(l=>l.overallStatus!=='fail').length/items.length*100:null;
  const currentRate=rate(current),previousRate=rate(previous);
  return {today:logs.filter(l=>Date.parse(l.timestamp)>=start.getTime()&&Date.parse(l.timestamp)<=end),rate:currentRate,change:currentRate===null||previousRate===null?null:currentRate-previousRate,
    trend:Array.from({length:30},(_,i)=>{const date=new Date(start.getTime());date.setDate(date.getDate()-29+i);const next=new Date(date);next.setDate(next.getDate()+1);const items=logs.filter(l=>Date.parse(l.timestamp)>=date.getTime()&&Date.parse(l.timestamp)<next.getTime()&&Date.parse(l.timestamp)<=end);return {date:date.toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit'}),rate:rate(items),count:items.length};})};
}
