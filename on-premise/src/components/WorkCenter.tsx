import { PushSettings } from './PushSettings';
import React, { useEffect, useState } from 'react';
import { OnPremApi } from '../services/api';
import type { User, Product } from '../types';

type Case = {id:string;title:string;owner_id:string;due_at:string;state:string;containment:string;root_cause:string;action:string;verification:string;version:number};
type Task = {id:string;title:string;owner_id:string;due_at:string;completed_at:string;product_id?:string};
type Approval = {inspection_id:string;session_code:string;operator_name:string;status:string;reason:string};
type Notification = {id:number;title:string;kind:string;entity_id:string;read_at:string};
type Work = {cases:Case[];tasks:Task[];approvals:Approval[];notifications:Notification[]};
const states:Record<string,string>={open:'Açık',action:'Aksiyon',verification:'Doğrulama',closed:'Kapalı',pending:'Onay bekliyor',approved:'Onaylandı',rejected:'Reddedildi'};
const field='mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm';
const button='rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50';
const dateInput=(date:string)=>{const value=new Date(date);return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,16);};

export function WorkCenter({users,products,currentUser,onInspect}:{users:User[];products:Product[];currentUser:User;onInspect:(productId:string)=>void}) {
  const [data,setData]=useState<Work>({cases:[],tasks:[],approvals:[],notifications:[]});
  const [selected,setSelected]=useState<Case|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [tab,setTab]=useState('inbox');
  const [audit,setAudit]=useState<Record<string,unknown>[]>([]);
  const [organization,setOrganization]=useState<{plants:{id:string;name:string}[];departments:{id:string;plant_id:string;name:string}[]}>({plants:[],departments:[]});
  const manager=['admin','quality_engineer'].includes(currentUser.role);
  const reload=async()=>setData(await OnPremApi.work() as Work);
  const run=async(action:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await action();await reload();}catch(error){setError(error instanceof Error?error.message:'İşlem tamamlanamadı.');}finally{setBusy(false);}};
  useEffect(()=>{void reload().catch(error=>setError(String(error)));const timer=setInterval(()=>void reload().catch(()=>{}),30000);return()=>clearInterval(timer);},[]);
  const overdue=data.tasks.filter(task=>!task.completed_at && new Date(task.due_at).getTime()<Date.now()).length;
  return <div className="space-y-4">
    <PushSettings/>
    <div className="rounded-2xl bg-slate-900 p-5 text-white"><h2 className="text-xl font-bold">İşlerim ve kalite aksiyonları</h2><p className="mt-2">{data.cases.filter(item=>item.state!=='closed').length} açık uygunsuzluk · {data.approvals.filter(item=>item.status==='pending').length} onay · {overdue} geciken görev</p></div>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="İş merkezi">
      {[['inbox','Bildirimler'],['cases','Uygunsuzluklar'],['tasks','Görevler'],...(manager||currentUser.role==='auditor'?[['approvals','Onaylar']]:[]),...(['admin','auditor'].includes(currentUser.role)?[['audit','Denetim izi']]:[]),...(currentUser.role==='admin'?[['organization','Tesis ve bölümler']]:[])].map(([id,label])=><button role="tab" aria-selected={tab===id} key={id} type="button" className={tab===id?button:'rounded-lg border p-3 text-sm'} onClick={()=>{setTab(id);if(id==='audit')void run(async()=>setAudit(await OnPremApi.auditLogs() as Record<string,unknown>[]));if(id==='organization')void run(async()=>setOrganization(await OnPremApi.organization() as typeof organization));}}>{label}</button>)}
      <button disabled={busy} type="button" className="rounded-lg border p-3 text-sm" onClick={()=>void run(async()=>{})}>Yenile</button>
    </div>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    {tab==='inbox'&&<div className="space-y-2">{!data.notifications.length&&<p>Yeni bildirim yok.</p>}{data.notifications.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><button className="text-left" type="button" onClick={()=>{setTab(item.kind==='ncr'?'cases':item.kind==='task'?'tasks':'approvals');if(item.kind==='ncr')setSelected(data.cases.find(c=>c.id===item.entity_id)||null);}}>{!item.read_at&&'● '}{item.title}</button>{!item.read_at&&<button disabled={busy} className="rounded-lg border p-3 text-sm" onClick={()=>void run(()=>OnPremApi.readNotification(item.id))}>Okundu</button>}</div>)}</div>}
    {tab==='cases'&&<div className="space-y-3">
      {!data.cases.length&&<p>Uygunsuzluk bulunmuyor. NOK kaydı oluştuğunda otomatik açılır.</p>}
      {data.cases.map(item=><button key={item.id} onClick={()=>setSelected(item)} className="flex w-full flex-wrap justify-between gap-2 rounded-xl border bg-white p-4 text-left"><span>{item.title}</span><span>{states[item.state]} · {users.find(user=>user.id===item.owner_id)?.name||'Sorumlu atanmadı'}</span></button>)}
      {selected&&<form key={selected.id+':'+selected.version} className="space-y-3 rounded-xl border bg-white p-5" onSubmit={event=>{event.preventDefault();const fields=new FormData(event.currentTarget);void run(async()=>{const updated=await OnPremApi.updateCase(selected.id,{version:selected.version,ownerId:fields.get('ownerId'),dueAt:new Date(String(fields.get('dueAt'))).toISOString(),state:fields.get('state'),containment:fields.get('containment'),rootCause:fields.get('rootCause'),action:fields.get('action'),verification:fields.get('verification')});setSelected(updated as Case);});}}>
        <h3 className="font-bold">{selected.title}</h3><fieldset disabled={busy||selected.state==='closed'||currentUser.role==='auditor'} className="space-y-3">
          <label className="block text-sm">Sorumlu<select required name="ownerId" defaultValue={selected.owner_id||''} className={field}><option value="">Seçin</option>{users.filter(user=>user.status==='active').map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
          <label className="block text-sm">Termin<input required name="dueAt" type="datetime-local" defaultValue={selected.due_at?dateInput(selected.due_at):''} className={field}/></label>
          {[['containment','Geçici önlem',selected.containment],['rootCause','Kök neden',selected.root_cause],['action','Düzeltici aksiyon',selected.action],['verification','Doğrulama ve kapanış kanıtı',selected.verification]].map(([name,label,value])=><label key={name} className="block text-sm">{label}<textarea name={name} defaultValue={value} maxLength={5000} className={field}/></label>)}
          <label className="block text-sm">Aşama<select name="state" defaultValue={selected.state} className={field}>{['open','action','verification','closed'].map(state=><option key={state} value={state}>{states[state]}</option>)}</select></label>
          <p className="text-xs text-slate-500">Kapatma, aksiyon sorumlusundan farklı bir kalite yetkilisinin doğrulamasını gerektirir.</p><button className={button}>Kaydet</button>
        </fieldset>
      </form>}
    </div>}
    {tab==='tasks'&&<div className="space-y-3">
      {manager&&<form className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2" onSubmit={event=>{event.preventDefault();const form=event.currentTarget;const fields=new FormData(form);void run(async()=>{await OnPremApi.createTask({title:fields.get('title'),ownerId:fields.get('ownerId'),productId:fields.get('productId')||undefined,dueAt:new Date(String(fields.get('dueAt'))).toISOString()});form.reset();});}}>
        <label>Görev<input required name="title" minLength={3} maxLength={250} className={field}/></label><label>Sorumlu<select required name="ownerId" className={field}><option value="">Seçin</option>{users.filter(u=>u.status==='active').map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <label>Parça<select name="productId" className={field}><option value="">Genel görev</option>{products.map(p=><option key={p.id} value={p.id}>{p.code}</option>)}</select></label><label>Termin<input required name="dueAt" type="datetime-local" className={field}/></label><button disabled={busy} className={button}>Görev ata</button>
      </form>}
      {data.tasks.map(task=><div key={task.id} className="space-y-2 rounded-xl border bg-white p-4"><h3 className="font-bold">{task.title}</h3><p>{users.find(u=>u.id===task.owner_id)?.name} · {new Date(task.due_at).toLocaleString('tr-TR')} · {task.completed_at?'Tamamlandı':new Date(task.due_at).getTime()<Date.now()?'Gecikti':new Date(task.due_at).getTime()<Date.now()+86400000?'Yaklaşıyor':'Planlandı'}</p>{!task.completed_at&&currentUser.role!=='auditor'&&<div className="flex flex-wrap gap-2">{task.product_id&&<button className={button} onClick={()=>onInspect(task.product_id!)}>Kontrol başlat</button>}<button disabled={busy} className="rounded-lg border p-3" onClick={()=>{const note=prompt('Tamamlama notu (en az 5 karakter)');if(note)void run(()=>OnPremApi.completeTask(task.id,note));}}>Tamamla</button></div>}</div>)}
    </div>}
    {tab==='approvals'&&<div className="space-y-3">{data.approvals.map(item=><div key={item.inspection_id} className="space-y-2 rounded-xl border bg-white p-4"><p className="font-bold">{item.session_code} · {states[item.status]}</p><p>{item.operator_name} · {item.reason}</p>{manager&&item.status==='pending'&&<div className="flex gap-2">{(['approved','rejected'] as const).map(status=><button disabled={busy} key={status} className={status==='approved'?button:'rounded-lg bg-red-700 p-3 text-white'} onClick={()=>{const reason=prompt('Karar gerekçesi (en az 5 karakter)');if(reason)void run(()=>OnPremApi.reviewInspection(item.inspection_id,status,reason));}}>{status==='approved'?'Onayla':'Reddet / yeniden kontrol'}</button>)}</div>}</div>)}</div>}
    {tab==='audit'&&<div className="space-y-2"><p className="text-sm">Son 500 olay; değişiklik öncesi ve sonrası kayıtları.</p>{audit.map(item=><details key={String(item.id)} className="rounded-xl border bg-white p-4"><summary>{String(item.created_at)} · {String(item.actor_name||'Sistem')} · {String(item.action)}</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><pre className="overflow-auto whitespace-pre-wrap break-all text-xs">Önce: {JSON.stringify(item.before_data,null,2)}</pre><pre className="overflow-auto whitespace-pre-wrap break-all text-xs">Sonra: {JSON.stringify(item.after_data,null,2)}</pre></div></details>)}</div>}
    {tab==='organization'&&<div className="space-y-3"><form className="space-y-3 rounded-xl border bg-white p-4" onSubmit={event=>{event.preventDefault();const fields=new FormData(event.currentTarget);void run(async()=>{await OnPremApi.createOrganization({name:fields.get('name'),plantId:fields.get('plantId')||undefined});setOrganization(await OnPremApi.organization() as typeof organization);});}}><label>Ad<input required name="name" minLength={2} className={field}/></label><label className="block">Bağlı tesis<select name="plantId" className={field}><option value="">Yeni tesis oluştur</option>{organization.plants.map(plant=><option key={plant.id} value={plant.id}>{plant.name}</option>)}</select></label><button disabled={busy} className={button}>Ekle</button></form>{organization.plants.map(plant=><div key={plant.id} className="rounded-xl border bg-white p-4"><h3 className="font-bold">{plant.name}</h3><p>{organization.departments.filter(d=>d.plant_id===plant.id).map(d=>d.name).join(' · ')||'Henüz bölüm yok'}</p></div>)}</div>}
  </div>;
}
