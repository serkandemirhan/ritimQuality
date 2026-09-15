import React, {useEffect, useRef, useState} from 'react';
import {useMediaSource, isPdfMedia} from './MediaImage';
import type {ImageAnnotation} from '../types';

type Tool = 'select' | 'pin' | 'measurement_line' | 'area' | 'note' | 'delete';
type Point = {x:number;y:number};
type Drag = {annotation:ImageAnnotation;origin:Point;endpoint?:'start'|'end'};
const DEFAULT_COLOR = '#2563eb';
const COLORS = ['#2563eb','#dc2626','#16a34a','#f59e0b','#7c3aed','#111827'];
const clamp = (value:number) => Math.max(0,Math.min(100,value));

export function AnnotationCanvas({imageUrl,pointNo,annotations,onChange}:{imageUrl:string;pointNo:number;annotations:ImageAnnotation[];onChange:(items:ImageAnnotation[])=>void}) {
  const url=useMediaSource(imageUrl);
  const stage=useRef<HTMLDivElement>(null);
  const drag=useRef<Drag|null>(null);
  const [tool,setTool]=useState<Tool>('select');
  const [zoom,setZoom]=useState(1);
  const [first,setFirst]=useState<Point|null>(null);
  const [selected,setSelected]=useState('');
  const [color,setColor]=useState(DEFAULT_COLOR);
  const [colorOpen,setColorOpen]=useState(false);
  const [history,setHistory]=useState<ImageAnnotation[][]>([]);
  const [future,setFuture]=useState<ImageAnnotation[][]>([]);
  const [size,setSize]=useState({width:1,height:1});

  useEffect(()=>{setFirst(null);setSelected('');setHistory([]);setFuture([]);setZoom(1);setColorOpen(false);},[imageUrl,pointNo]);
  useEffect(()=>{const element=stage.current;if(!element)return;const update=()=>{const rect=element.getBoundingClientRect();setSize({width:rect.width||1,height:rect.height||1});};update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();},[imageUrl]);

  const commit=(next:ImageAnnotation[])=>{setHistory(items=>[...items.slice(-30),annotations]);setFuture([]);onChange(next);};
  const position=(event:{clientX:number;clientY:number})=>{const rect=stage.current!.getBoundingClientRect();return{x:Number(clamp((event.clientX-rect.left)/rect.width*100).toFixed(2)),y:Number(clamp((event.clientY-rect.top)/rect.height*100).toFixed(2))};};
  const click=(event:React.MouseEvent)=>{if(tool==='select'||tool==='delete')return;const p=position(event);if(tool==='pin'){commit([...annotations,{id:crypto.randomUUID(),type:'pin',...p,label:`#${pointNo}`,color}]);return;}if(tool==='note'){const label=prompt('Görsel notu');if(label?.trim())commit([...annotations,{id:crypto.randomUUID(),type:'note',...p,label:label.trim(),color}]);return;}if(!first){setFirst(p);return;}const id=crypto.randomUUID();commit([...annotations,{id,type:tool,startX:first.x,startY:first.y,endX:p.x,endY:p.y,label:`#${pointNo}`,color}]);setFirst(null);setSelected(id);setTool('select');};
  const undo=()=>{const prior=history.at(-1);if(!prior)return;setFuture(items=>[annotations,...items]);setHistory(items=>items.slice(0,-1));onChange(prior);};
  const redo=()=>{const next=future[0];if(!next)return;setHistory(items=>[...items,annotations]);setFuture(items=>items.slice(1));onChange(next);};
  const choose=(id:string,event:React.MouseEvent)=>{event.stopPropagation();if(tool==='delete'){commit(annotations.filter(item=>item.id!==id));setSelected('');return;}setSelected(id);const item=annotations.find(annotation=>annotation.id===id);if(item?.color)setColor(item.color);};
  const beginDrag=(id:string,event:React.PointerEvent,endpoint?:'start'|'end')=>{if(tool!=='select')return;event.stopPropagation();const annotation=annotations.find(item=>item.id===id);if(!annotation)return;setSelected(id);if(annotation.color)setColor(annotation.color);setHistory(items=>[...items.slice(-30),annotations]);setFuture([]);drag.current={origin:position(event),annotation,endpoint};event.currentTarget.setPointerCapture(event.pointerId);};
  const dragItem=(id:string,event:React.PointerEvent)=>{const active=drag.current;if(tool!=='select'||!active||active.annotation.id!==id)return;event.stopPropagation();const current=position(event);onChange(annotations.map(item=>{if(item.id!==id)return item;if(active.endpoint&&item.type==='measurement_line'){return active.endpoint==='start'?{...item,startX:current.x,startY:current.y}:{...item,endX:current.x,endY:current.y};}const dx=current.x-active.origin.x,dy=current.y-active.origin.y;if(active.annotation.type==='pin'||active.annotation.type==='note')return {...item,x:clamp(active.annotation.x+dx),y:clamp(active.annotation.y+dy)};return {...item,startX:clamp(active.annotation.startX+dx),startY:clamp(active.annotation.startY+dy),endX:clamp(active.annotation.endX+dx),endY:clamp(active.annotation.endY+dy)};}));};
  const endDrag=(event:React.PointerEvent)=>{if(!drag.current)return;event.stopPropagation();drag.current=null;};
  const applyColor=(nextColor:string)=>{setColor(nextColor);setColorOpen(false);if(!selected)return;commit(annotations.map(item=>item.id===selected?{...item,color:nextColor}:item));};
  const cap=(item:Extract<ImageAnnotation,{type:'measurement_line'}>,at:'start'|'end')=>{const dx=(item.endX-item.startX)*size.width/100,dy=(item.endY-item.startY)*size.height/100,length=Math.hypot(dx,dy)||1,half=8;const offsetX=(-dy/length*half)/size.width*100,offsetY=(dx/length*half)/size.height*100,x=at==='start'?item.startX:item.endX,y=at==='start'?item.startY:item.endY;return{x1:x-offsetX,y1:y-offsetY,x2:x+offsetX,y2:y+offsetY};};
  const arrow=(item:Extract<ImageAnnotation,{type:'measurement_line'}>,at:'start'|'end')=>{const dx=(item.endX-item.startX)*size.width/100,dy=(item.endY-item.startY)*size.height/100,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,direction=at==='start'?1:-1,tipX=at==='start'?item.startX:item.endX,tipY=at==='start'?item.startY:item.endY,baseX=tipX+direction*ux*10/size.width*100,baseY=tipY+direction*uy*10/size.height*100,sideX=-uy*4/size.width*100,sideY=ux*4/size.height*100;return `${tipX},${tipY} ${baseX+sideX},${baseY+sideY} ${baseX-sideX},${baseY-sideY}`;};
  const colorName:Record<string,string>={'#2563eb':'Mavi','#dc2626':'Kırmızı','#16a34a':'Yeşil','#f59e0b':'Turuncu','#7c3aed':'Mor','#111827':'Siyah'};
  const buttons:[Tool,string][]=[['select','Seç/Pan'],['pin','Pin'],['measurement_line','Ölçüm Çizgisi'],['area','Alan'],['note','Not'],['delete','Sil']];

  return <section className="overflow-hidden rounded-2xl bg-slate-950">
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 bg-slate-900 p-2">
      {buttons.map(([id,label])=><button type="button" title={label} aria-pressed={tool===id} onClick={()=>{setTool(id);setFirst(null);}} className={`rounded-lg px-2 py-1.5 text-xs ${tool===id?'bg-blue-600 text-white':'text-slate-300 hover:bg-slate-800'}`} key={id}>{label}</button>)}
      <div className="relative">
        <button type="button" aria-haspopup="menu" aria-expanded={colorOpen} onClick={()=>setColorOpen(value=>!value)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800"><span className="h-3.5 w-3.5 rounded-sm border border-white/70" style={{backgroundColor:color}}/>{colorName[color]||'Özel'} <span aria-hidden>▾</span></button>
        {colorOpen&&<div role="menu" className="absolute left-0 top-full z-30 mt-1 min-w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">{COLORS.map(value=><button role="menuitem" key={value} type="button" aria-label={`Anotasyon rengi ${colorName[value]}`} onClick={()=>applyColor(value)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"><span className="h-4 w-4 rounded-sm border border-slate-300" style={{backgroundColor:value}}/>{colorName[value]}</button>)}<label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100"><input aria-label="Özel anotasyon rengi" type="color" value={color} onChange={event=>applyColor(event.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"/>Özel renk</label></div>}
      </div>
      <button type="button" title="Uzaklaştır" onClick={()=>setZoom(value=>Math.max(.5,value-.2))} className="rounded-lg px-2 text-white">−</button>
      <button type="button" title="Yakınlaştır" onClick={()=>setZoom(value=>Math.min(3,value+.2))} className="rounded-lg px-2 text-white">+</button>
      <button type="button" title="Geri Al" disabled={!history.length} onClick={undo} className="rounded-lg px-2 text-white disabled:opacity-30">↶</button>
      <button type="button" title="Yinele" disabled={!future.length} onClick={redo} className="rounded-lg px-2 text-white disabled:opacity-30">↷</button>
      {first&&<span className="ml-auto text-xs text-blue-300">Bitiş noktasını seçin</span>}
    </div>
    <div className={`${zoom>1?'overflow-auto':'overflow-hidden'} p-2`}>
      <div ref={stage} onClick={click} style={{transform:`scale(${zoom})`,transformOrigin:'center'}} className="relative mx-auto h-[min(58vh,620px)] min-h-80 w-full max-w-5xl cursor-crosshair bg-slate-900">
        {isPdfMedia(imageUrl)?<object data={url} type="application/pdf" className="pointer-events-none h-full w-full bg-white"/>:<img src={url} alt="Anotasyon yapılan teknik görsel" className="pointer-events-none h-full w-full object-contain"/>}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full touch-none overflow-visible">
          {annotations.map(item=>{
            const itemColor=item.color||DEFAULT_COLOR;
            if(item.type==='measurement_line'){
              const startCap=cap(item,'start'),endCap=cap(item,'end'),isSelected=selected===item.id;
              return <g key={item.id} data-annotation-id={item.id} onClick={event=>choose(item.id,event)} onPointerDown={event=>beginDrag(item.id,event)} onPointerMove={event=>dragItem(item.id,event)} onPointerUp={endDrag} className="cursor-move">
                {isSelected&&<line x1={item.startX} y1={item.startY} x2={item.endX} y2={item.endY} vectorEffect="non-scaling-stroke" stroke="#fbbf24" strokeWidth="6" opacity=".45"/>}
                <line x1={item.startX} y1={item.startY} x2={item.endX} y2={item.endY} vectorEffect="non-scaling-stroke" stroke={itemColor} strokeWidth="2.5"/>
                <line data-role="start-cap" {...startCap} vectorEffect="non-scaling-stroke" stroke={itemColor} strokeWidth="2.5"/>
                <line data-role="end-cap" {...endCap} vectorEffect="non-scaling-stroke" stroke={itemColor} strokeWidth="2.5"/>
                <polygon data-role="start-arrow" points={arrow(item,'start')} fill={itemColor}/>
                <polygon data-role="end-arrow" points={arrow(item,'end')} fill={itemColor}/>
                <text x={(item.startX+item.endX)/2} y={(item.startY+item.endY)/2-2} fontSize="4" fill={itemColor} stroke="#fff" strokeWidth=".35" paintOrder="stroke">{item.label}</text>
                {isSelected&&<><rect aria-label="Başlangıç noktasını taşı" x={item.startX-1.5} y={item.startY-1.5} width="3" height="3" fill="#fff" stroke={itemColor} strokeWidth="1" vectorEffect="non-scaling-stroke" className="cursor-grab" onPointerDown={event=>beginDrag(item.id,event,'start')} onPointerMove={event=>dragItem(item.id,event)} onPointerUp={endDrag}/><rect aria-label="Bitiş noktasını taşı" x={item.endX-1.5} y={item.endY-1.5} width="3" height="3" fill="#fff" stroke={itemColor} strokeWidth="1" vectorEffect="non-scaling-stroke" className="cursor-grab" onPointerDown={event=>beginDrag(item.id,event,'end')} onPointerMove={event=>dragItem(item.id,event)} onPointerUp={endDrag}/></>}
              </g>;
            }
            if(item.type==='area')return <rect key={item.id} onClick={event=>choose(item.id,event)} onPointerDown={event=>beginDrag(item.id,event)} onPointerMove={event=>dragItem(item.id,event)} onPointerUp={endDrag} x={Math.min(item.startX,item.endX)} y={Math.min(item.startY,item.endY)} width={Math.abs(item.endX-item.startX)} height={Math.abs(item.endY-item.startY)} fill={`${itemColor}33`} stroke={itemColor} strokeWidth={selected===item.id?3:1.5} vectorEffect="non-scaling-stroke" className="cursor-move"/>;
            return null;
          })}
        </svg>
        {annotations.filter(item=>item.type==='pin'||item.type==='note').map(item=><button key={item.id} onClick={event=>choose(item.id,event)} onPointerDown={event=>beginDrag(item.id,event)} onPointerMove={event=>dragItem(item.id,event)} onPointerUp={endDrag} style={{left:`${item.x}%`,top:`${item.y}%`,backgroundColor:item.color||DEFAULT_COLOR,touchAction:'none'}} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white px-2 py-1 text-xs font-bold text-white ${selected===item.id?'ring-4 ring-amber-300':''}`}>{item.type==='pin'?item.label:'📝'}</button>)}
      </div>
    </div>
  </section>;
}
