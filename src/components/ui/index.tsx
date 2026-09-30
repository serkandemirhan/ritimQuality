import React, {useEffect, useId, useRef} from 'react';
import {createPortal} from 'react-dom';
import {CheckCircle2, AlertTriangle, XCircle, Info, Search, X} from 'lucide-react';

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');
type BoxProps = React.HTMLAttributes<HTMLDivElement>;
export function AppShell({children, className, ...props}:BoxProps) {return <div {...props} className={cx('rq-shell',className)}>{children}</div>;}
export function Sidebar({children,className,...props}:React.HTMLAttributes<HTMLElement>) {return <aside {...props} className={cx('rq-sidebar',className)}>{children}</aside>;}
export function Topbar({children,className,...props}:React.HTMLAttributes<HTMLElement>) {return <header {...props} className={cx('rq-topbar',className)}>{children}</header>;}
export function PageContainer({children,className,...props}:React.HTMLAttributes<HTMLElement>) {return <main {...props} className={cx('rq-page',className)}>{children}</main>;}
export function PageActions({className,...props}:BoxProps) {return <div {...props} className={cx('rq-actions',className)}/>;}
export function Breadcrumb({items}:{items:{label:string;onClick?:()=>void}[]}) {return <nav aria-label="Sayfa yolu" className="rq-breadcrumb"><ol>{items.map((item,index)=><li key={index}>{item.onClick?<button type="button" onClick={item.onClick}>{item.label}</button>:<span aria-current={index===items.length-1?'page':undefined}>{item.label}</span>}</li>)}</ol></nav>;}
export function PageHeader({title,description,actions,summary,breadcrumb}:{title:string;description?:string;actions?:React.ReactNode;summary?:React.ReactNode;breadcrumb?:React.ReactNode}) {return <header className="rq-page-header">{breadcrumb}<div className="rq-page-heading"><div><h1 className="rq-page-title">{title}</h1>{description&&<p className="rq-page-subtitle">{description}</p>}</div>{actions&&<PageActions>{actions}</PageActions>}</div>{summary&&<div className="rq-summary">{summary}</div>}</header>;}
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?:'primary'|'secondary'|'ghost'|'danger';loading?:boolean};
export function Button({variant='secondary',loading,disabled,className,children,type='button',...props}:ButtonProps) {return <button {...props} type={type} disabled={disabled||loading} aria-busy={loading||undefined} className={cx('rq-button',`rq-button-${variant}`,className)}>{loading&&<span className="rq-spinner" aria-hidden="true"/>}{children}</button>;}
export function IconButton({label,children,...props}:ButtonProps & {label:string}) {return <Button {...props} aria-label={label} title={label} className={cx('rq-icon-button',props.className)}>{children}</Button>;}
export type Tone='neutral'|'success'|'warning'|'danger'|'info';
export function Badge({tone='neutral',children}:{tone?:Tone;children:React.ReactNode}) {return <span className={'rq-badge rq-tone-'+tone}>{children}</span>;}
export function StatusBadge({status,label}:{status:string;label?:string}) {const entries:Record<string,[Tone,string]>={active:['success','Aktif'],draft:['neutral','Taslak'],archived:['neutral','Arşiv'],pass:['success','Uygun'],warning:['warning','Uygun · Uyarı'],fail:['danger','Uygunsuz'],pending:['warning','Bekliyor']};const [tone,text]=entries[status]||['neutral',status];const Icon=tone==='success'?CheckCircle2:tone==='danger'?XCircle:tone==='warning'?AlertTriangle:Info;return <Badge tone={tone}><Icon size={13}/>{label||text}</Badge>;}
export function Card({className,...props}:BoxProps) {return <div {...props} className={cx('rq-card',className)}/>;}
export function MetricCard({label,value,detail,tone='neutral'}:{label:string;value:React.ReactNode;detail?:string;tone?:Tone}) {return <Card className={'rq-metric rq-metric-'+tone}><h2>{label}</h2><p className="rq-kpi-value">{value}</p>{detail&&<small>{detail}</small>}</Card>;}
export const KpiMetric=MetricCard;
export function Input({className,...props}:React.InputHTMLAttributes<HTMLInputElement>) {return <input {...props} className={cx('rq-input',className)}/>;}
export function NumberInput(props:React.InputHTMLAttributes<HTMLInputElement>) {return <Input {...props} type="number" className={cx('rq-technical',props.className)}/>;}
export function MeasurementInput(props:React.InputHTMLAttributes<HTMLInputElement>) {return <Input {...props} inputMode={props.inputMode||'decimal'} className={cx('rq-measurement-input',props.className)}/>;}
export function Select({className,...props}:React.SelectHTMLAttributes<HTMLSelectElement>) {return <select {...props} className={cx('rq-input',className)}/>;}
export function MultiSelect(props:React.SelectHTMLAttributes<HTMLSelectElement>) {return <Select {...props} multiple/>;}
export function DatePicker(props:React.InputHTMLAttributes<HTMLInputElement>) {return <Input {...props} type="date"/>;}
export function DateRangePicker({start,end,onChange,label='Tarih aralığı'}:{start:string;end:string;onChange:(start:string,end:string)=>void;label?:string}) {return <fieldset className="rq-date-range"><legend>{label}</legend><DatePicker aria-label="Başlangıç tarihi" value={start} max={end||undefined} onChange={e=>onChange(e.target.value,end)}/><DatePicker aria-label="Bitiş tarihi" value={end} min={start||undefined} onChange={e=>onChange(start,e.target.value)}/></fieldset>;}
export function Checkbox(props:React.InputHTMLAttributes<HTMLInputElement>) {return <input {...props} type="checkbox" className={cx('rq-checkbox',props.className)}/>;}
export function Radio(props:React.InputHTMLAttributes<HTMLInputElement>) {return <input {...props} type="radio" className={cx('rq-checkbox',props.className)}/>;}
export function Switch({label,...props}:React.InputHTMLAttributes<HTMLInputElement>&{label:string}) {return <label className="rq-switch"><input {...props} type="checkbox" role="switch"/><span aria-hidden="true"/>{label}</label>;}
export function Textarea({className,...props}:React.TextareaHTMLAttributes<HTMLTextAreaElement>) {return <textarea {...props} className={cx('rq-input',className)}/>;}
export function SearchInput(props:React.InputHTMLAttributes<HTMLInputElement>) {return <div className="rq-search"><Search size={16}/><Input aria-label={props['aria-label']||'Ara'} {...props} type="search"/></div>;}
export function FilterBar({className,...props}:BoxProps) {return <div {...props} className={cx('rq-filter-bar',className)}/>;}
export const TableToolbar=FilterBar;
export function DataTable({children,label,className}:{children:React.ReactNode;label:string;className?:string}) {
 type TableElement=React.ReactElement<{children?:React.ReactNode;'data-label'?:React.ReactNode}>;
 const sections=React.Children.toArray(children) as TableElement[];
 const head=sections.find(section=>React.isValidElement(section)&&section.type==='thead');
 const headerRow=React.Children.toArray(head?.props.children)[0] as TableElement|undefined;
 const labels=React.Children.toArray(headerRow?.props.children).map(cell=>(cell as TableElement).props.children);
 const content=className?.includes('rq-mobile-cards')?sections.map(section=>section.type==='tbody'?React.cloneElement(section,{},React.Children.map(section.props.children,row=>{
  if(!React.isValidElement(row))return row;
  const tableRow=row as TableElement;
  return React.cloneElement(tableRow,{},React.Children.map(tableRow.props.children,(cell,index)=>React.isValidElement(cell)?React.cloneElement(cell as TableElement,{'data-label':labels[index]}):cell));
 })):section):children;
 return <div className="rq-table-scroll" tabIndex={0} role="region" aria-label={label}><table role="table" className={cx('rq-table',className)}><caption className="sr-only">{label}</caption>{content}</table></div>;
}
export function Pagination({page,pages,onChange}:{page:number;pages:number;onChange:(page:number)=>void}) {return <nav aria-label="Sayfalama" className="rq-actions"><Button disabled={page<=1} onClick={()=>onChange(page-1)}>Önceki</Button><span>{page} / {Math.max(1,pages)}</span><Button disabled={page>=pages} onClick={()=>onChange(page+1)}>Sonraki</Button></nav>;}
export function Skeleton({className,...props}:BoxProps) {return <div {...props} aria-hidden="true" className={cx('rq-skeleton',className)}/>;}
export function Tabs({items,value,onChange,label}:{items:{id:string;label:string}[];value:string;onChange:(id:string)=>void;label:string}) {return <div role="tablist" aria-label={label} className="rq-tabs">{items.map((item,index)=><button key={item.id} type="button" role="tab" aria-selected={value===item.id} tabIndex={value===item.id?0:-1} onClick={()=>onChange(item.id)} onKeyDown={e=>{const next=e.key==='ArrowRight'?(index+1)%items.length:e.key==='ArrowLeft'?(index+items.length-1)%items.length:e.key==='Home'?0:e.key==='End'?items.length-1:-1;if(next>=0){e.preventDefault();onChange(items[next].id);(e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();}}}>{item.label}</button>)}</div>;}
export function FormSection({title,description,children}:{title:string;description?:string;children:React.ReactNode}) {return <fieldset className="rq-form-section"><legend>{title}</legend>{description&&<p className="rq-helper">{description}</p>}<div className="rq-form-fields">{children}</div></fieldset>;}
export function Field({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}) {
 const hintId=useId();
 const control=React.isValidElement<{ 'aria-describedby'?:string }>(children)&&hint?React.cloneElement(children,{'aria-describedby':[children.props['aria-describedby'],hintId].filter(Boolean).join(' ')}):children;
 return <label className="rq-field"><span>{label}</span>{control}{hint&&<small id={hintId}>{hint}</small>}</label>;
}
export function ChartCard({title,description,children}:{title:string;description?:string;children:React.ReactNode}) {return <Card><h2 className="rq-section-title">{title}</h2>{description&&<p className="rq-helper">{description}</p>}<div className="rq-chart">{children}</div></Card>;}
export function TraceTimeline({items}:{items:{id:string;title:string;detail?:string;time?:string}[]}) {return <ol className="rq-timeline">{items.map(item=><li key={item.id}><strong>{item.title}</strong>{item.time&&<time className="rq-technical">{item.time}</time>}{item.detail&&<p>{item.detail}</p>}</li>)}</ol>;}
export function SampleProgress({current,total}:{current:number;total:number}) {return <div className="rq-sample-progress"><span>Numune {current} / {total}</span><progress value={current} max={Math.max(1,total)} aria-label="Numune ilerlemesi"/></div>;}
export function ToleranceBand({nominal,lsl,usl,unit}:{nominal:number;lsl:number;usl:number;unit:string}) {return <dl className="rq-tolerance-band">{[['Alt sınır',lsl],['Nominal',nominal],['Üst sınır',usl]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value} <small>{unit}</small></dd></div>)}</dl>;}
type ModalProps={open:boolean;title:string;onClose:()=>void;children:React.ReactNode;className?:string;busy?:boolean};
export function Modal({open,title,onClose,children,className,busy}:ModalProps) {
 const ref=useRef<HTMLDialogElement>(null);const titleId=useId();const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{const dialog=ref.current;if(!open||!dialog)return;const before=document.activeElement as HTMLElement;dialog.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{dialog.close();document.body.style.overflow=old;before?.focus();};},[open]);
 if(!open)return null;
 return createPortal(<dialog ref={ref} aria-labelledby={titleId} aria-busy={busy||undefined} onKeyDown={(event:React.KeyboardEvent<HTMLDialogElement>)=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!busy)closeRef.current();return;}
  if(event.key!=='Tab')return;
  const dialog=event.currentTarget as HTMLDialogElement;
  const controls:HTMLElement[]=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')).filter(element=>element.getClientRects().length>0);
  const first=controls[0],last=controls[controls.length-1];
  if(!first){event.preventDefault();return;}
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===event.currentTarget)){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }} className={cx('rq-modal',className)} onCancel={event=>{event.preventDefault();if(!busy)closeRef.current();}} onClick={event=>{if(event.target===event.currentTarget&&!busy){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeRef.current();}}}><header><h2 id={titleId}>{title}</h2><IconButton label="Kapat" disabled={busy} onClick={onClose}><X size={18}/></IconButton></header><div className="rq-modal-body">{children}</div></dialog>,document.body);
}
export function Drawer(props:ModalProps) {return <Modal {...props} className={cx('rq-drawer',props.className)}/>;}
export const DetailDrawer=Drawer;
export function ConfirmDialog({onConfirm,description,...props}:Omit<ModalProps,'children'>&{description:string;onConfirm:()=>void}) {return <Modal {...props}><p>{description}</p><PageActions><Button onClick={props.onClose}>İptal</Button><Button variant="danger" loading={props.busy} onClick={onConfirm}>Onayla</Button></PageActions></Modal>;}
export {EmptyState} from '../EmptyState';
export {Toast} from '../Toast';
