import React, {useEffect, useRef} from 'react';
import type {Characteristic, MeasurementValue} from '../types';

export function MeasurementChoices({characteristic:c,value,onChange,onConfirm,disabled,focusKey}:{
  characteristic:Characteristic;value:MeasurementValue;onChange:(value:MeasurementValue)=>void;
  onConfirm:(value:MeasurementValue)=>void;disabled:boolean;focusKey:string;
}) {
  const root=useRef<HTMLDivElement>(null);
  const multi=c.type==='multi_select';
  const options:{value:MeasurementValue;label:string}[]=c.type==='ok_nok'||c.type==='visual'
    ? [{value:true,label:'Uygun'},{value:false,label:'Uygunsuz'},...(c.type==='visual'?[{value:'SUSPECT',label:'Şüpheli'}]:[])]
    : (c.type==='boolean'?['yes','no']:c.options||[]).map(value=>({value,label:c.type==='boolean'?(value==='yes'?'Evet':'Hayır'):value}));
  useEffect(()=>{(root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')||root.current?.querySelector('button'))?.focus({preventScroll:true});},[focusKey]);
  const select=(option:MeasurementValue)=>{
    if(multi){const values=Array.isArray(value)?value:[];onChange(values.includes(String(option))?values.filter(v=>v!==option):[...values,String(option)]);}
    else onChange(option);
  };
  return <div ref={root} className="rq-measurement-choices" role="group" aria-label="Ölçüm seçenekleri" onKeyDown={event=>{
    if(disabled||event.nativeEvent.isComposing)return;
    const buttons=Array.from(root.current?.querySelectorAll('button')||[]);
    const index=buttons.indexOf(event.target as HTMLButtonElement);if(index<0)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){
      event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+buttons.length)%buttons.length;buttons[next]?.focus();
    }else if(event.key==='Enter'){
      event.preventDefault();if(event.repeat)return;
      if(multi)onConfirm(value);else{onChange(options[index].value);onConfirm(options[index].value);}
    }
  }}>{options.map((option,index)=>{const selected=multi?Array.isArray(value)&&value.includes(String(option.value)):value===option.value;return <button key={index} type="button" disabled={disabled} aria-pressed={selected} onClick={()=>select(option.value)}>{multi&&<span aria-hidden="true">{selected?'☑':'☐'} </span>}{option.label}</button>;})}</div>;
}
