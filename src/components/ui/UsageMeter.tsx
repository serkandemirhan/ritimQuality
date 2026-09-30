import React from 'react';
import {Card} from './index';

export function UsageMeter({label,value,limit,unlimited=false}:{label:string;value:number;limit:number;unlimited?:boolean}) {
  const percent=limit>0?Math.min(100,Math.max(0,value/limit*100)):0;
  return <Card><h3 className="rq-helper">{label}</h3><p className="rq-kpi-value">{value.toLocaleString()} <span className="rq-helper">/ {unlimited?'Sınırsız':limit.toLocaleString()}</span></p>{!unlimited&&<><progress className="rq-usage-meter" value={percent} max={100} aria-label={label+' kullanım oranı'}/><p className="rq-helper">%{Math.round(percent)} dolu · {Math.max(0,limit-value).toLocaleString()} kalan</p></>}</Card>;
}
