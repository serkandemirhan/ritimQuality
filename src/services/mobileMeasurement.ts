import type { Characteristic, ControlPlan, EvidenceAttachment, InspectionLog, Product, SampleMeasurement } from '../types';
import { SaasApi } from './api';
import {StorageService} from './storage';
import { evaluateMeasurement, evidenceErrors, orderedCells, type QualityResult } from '../../server/services/measurementCore';
export { evaluateMeasurement, evidenceErrors, orderedCells };
export interface Cell { sample: number; characteristic: string }
export interface MobileDraft { raw: string | string[]; mode: 'absolute' | 'delta'; comment: string; reason: string; retryReason: string; photos: string[] }
export interface MobileAttempt extends Cell {
  id: string; raw: string | string[]; mode: 'absolute' | 'delta'; value: number | string | string[]; canonical?: string;
  result: QualityResult; comment: string; reason: string; retryReason: string; photos: string[];
  previousAttemptId?: string; operatorId: string; measuredAt: string; source: string; instrumentId: string;
}
export interface PackedMobileFile {name:string;type:string;size:number;lastModified:number;bytes:Uint8Array}
export interface LocalMedia { id: string; file: File | PackedMobileFile; attachment?: EvidenceAttachment; error?: string }
export async function packMobileFile(file:File):Promise<PackedMobileFile> {
  const data=typeof file.arrayBuffer==='function'?await file.arrayBuffer():await new Promise<ArrayBuffer>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=()=>reject(reader.error);reader.readAsArrayBuffer(file);});
  const bytes=new Uint8Array(data);
  return {name:file.name||'kanit',type:file.type,size:file.size,lastModified:file.lastModified||0,bytes};
}
export function mobileFile(file:File|PackedMobileFile):File {
  if(file instanceof Blob)return file instanceof File?file:new File([file],'kanit',{type:file.type});
  return new File([new Uint8Array(file.bytes).buffer],file.name,{type:file.type,lastModified:file.lastModified});
}
export interface MobileSession {
  taskId?:string;
  id: string; scope: string; plan: ControlPlan; product: Product; count: number; operatorId: string; operatorName: string;
  orderNumber: string; lotNumber: string; serialNumber: string; instrumentId: string; source: string;
  active: Cell; order: 'sample' | 'characteristic'; drafts: Record<string, MobileDraft>; attempts: MobileAttempt[];
  media: Record<string, LocalMedia>; createdAt: string; updatedAt?:string; completedAt?:string; submissionRequested?: boolean; submission?: InspectionLog; confirmed?: InspectionLog; syncError?: string;
}
export const cellKey = (cell: Cell) => `${cell.sample}:${cell.characteristic}`;
export const emptyDraft = (): MobileDraft => ({raw:'',mode:'absolute',comment:'',reason:'',retryReason:'',photos:[]});
export const latestAttempt = (s: MobileSession, cell: Cell) => [...s.attempts].reverse().find(a => cellKey(a) === cellKey(cell));
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('ritim-mobile-measurement', 2);
    request.onupgradeneeded = () => {if(!request.result.objectStoreNames.contains('sessions'))request.result.createObjectStore('sessions', {keyPath:'scope'});if(!request.result.objectStoreNames.contains('archives'))request.result.createObjectStore('archives',{keyPath:'id'});};
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('Cihaz depolaması açılamadı.')); };
  });
}
export async function archiveMobileSession(scope:string) {
  const database=await db();
  const current=await readMobileSession(scope);const packed=current?await prepareLegacyFiles(scope,current.id):{};
  return new Promise<void>((resolve,reject)=>{
    const tx=database.transaction(['sessions','archives'],'readwrite');const store=tx.objectStore('sessions');const request=store.get(scope);
    request.onsuccess=()=>{try{const s=request.result as MobileSession;if(!s?.confirmed)throw new Error('Yalnızca sunucu kabulü doğrulanmış oturum arşivlenebilir.');tx.objectStore('archives').put(withPackedLegacy(s,packed));store.delete(scope);}catch{tx.abort();}};
    tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new Error('Yalnızca sunucu kabulü doğrulanmış oturum arşivlenebilir.'));
  });
}
export async function readMobileSession(scope: string): Promise<MobileSession | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction('sessions').objectStore('sessions').get(scope);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
async function readStoredMobileSession(scope:string,id:string):Promise<MobileSession|undefined> {
  const database=await db();
  return new Promise((resolve,reject)=>{const tx=database.transaction(['sessions','archives']);const active=tx.objectStore('sessions').get(scope),saved=tx.objectStore('archives').get(id);tx.oncomplete=()=>{const session=active.result?.id===id?active.result:saved.result;resolve(session?.scope===scope?session:undefined);};tx.onerror=()=>reject(tx.error);});
}
// Old versions stored File objects inside sessions. Safari may refuse to write
// those objects back, so convert their bytes before updating an existing record.
async function prepareLegacyFiles(scope:string,id:string):Promise<Record<string,PackedMobileFile>> {
  const database=await db();
  const source=await new Promise<MobileSession|undefined>((resolve,reject)=>{const tx=database.transaction(['sessions','archives']);const active=tx.objectStore('sessions').get(scope),archived=tx.objectStore('archives').get(id);tx.oncomplete=()=>resolve(active.result?.id===id?active.result:archived.result);tx.onerror=()=>reject(tx.error);});
  if(!source||source.scope!==scope)return {};
  const packed:Record<string,PackedMobileFile>={};
  await Promise.all(Object.values(source.media||{}).map(async media=>{if(media.file instanceof Blob)packed[media.id]=await packMobileFile(media.file as File);}));
  return packed;
}
function withPackedLegacy(s:MobileSession,packed:Record<string,PackedMobileFile>):MobileSession {
  const media={...s.media};
  for(const item of Object.values(media))if(item.file instanceof Blob){const replacement=packed[item.id];const file=item.file as File;if(!replacement||replacement.size!==file.size||replacement.type!==file.type||replacement.name!==(file.name||'kanit')||replacement.lastModified!==(file.lastModified||0))throw new Error('Kanıt dosyası başka bir sekmede değişti; işlemi tekrar deneyin.');media[item.id]={...item,file:replacement};}
  return {...s,media};
}
export async function readMobileUploads(scope:string):Promise<MobileSession[]> {
  const database=await db();
  return new Promise((resolve,reject)=>{const request=database.transaction('archives').objectStore('archives').getAll();request.onsuccess=()=>resolve((request.result as MobileSession[]).filter(s=>s.scope===scope&&!!s.submissionRequested&&!s.confirmed));request.onerror=()=>reject(request.error);});
}
export async function listMobileDrafts(scope:string):Promise<MobileSession[]> {
  const database=await db();
  return new Promise((resolve,reject)=>{const tx=database.transaction(['sessions','archives']);const active=tx.objectStore('sessions').get(scope);const saved=tx.objectStore('archives').getAll();tx.oncomplete=()=>resolve([active.result,...saved.result].filter((s):s is MobileSession=>!!s&&s.scope===scope&&!s.submissionRequested&&!s.submission&&!s.confirmed).sort((a,b)=>(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt)));tx.onerror=()=>reject(tx.error);});
}
export async function activateMobileDraft(scope:string, seed:MobileSession, allowCreate=false):Promise<MobileSession> {
  const database=await db();
  const currentBefore=await readMobileSession(scope);
  const [currentFiles,targetFiles]=await Promise.all([currentBefore?prepareLegacyFiles(scope,currentBefore.id):{},prepareLegacyFiles(scope,seed.id)]);
  return new Promise((resolve,reject)=>{const tx=database.transaction(['sessions','archives'],'readwrite');const active=tx.objectStore('sessions'),saved=tx.objectStore('archives');const current=active.get(scope),found=saved.get(seed.id);let result:MobileSession;let error:Error|undefined;
    tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(error||tx.error||new Error('Taslak açılamadı.'));
    let ready=0;const apply=()=>{if(++ready!==2)return;try{const raw=current.result as MobileSession|undefined;const existing=raw?withPackedLegacy(raw,currentFiles):undefined;const stored=found.result as MobileSession|undefined;const rawTarget=existing?.id===seed.id?existing:stored||(allowCreate?seed:undefined);if(!rawTarget||rawTarget.scope!==scope||rawTarget.submissionRequested||rawTarget.submission||rawTarget.confirmed)throw new Error('Bu taslak açılamıyor.');const target=withPackedLegacy(rawTarget,targetFiles);if(existing&&existing.id!==target.id)saved.put(existing);active.put(target);if(stored)saved.delete(target.id);result=target;}catch(e){error=e as Error;tx.abort();}};found.onsuccess=apply;current.onsuccess=apply;
  });
}
export async function deleteMobileDraft(scope:string,id:string):Promise<void> {
  const database=await db();
  return new Promise((resolve,reject)=>{const tx=database.transaction(['sessions','archives'],'readwrite');const active=tx.objectStore('sessions'),saved=tx.objectStore('archives');const a=active.get(scope),b=saved.get(id);let error:Error|undefined;tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(error||tx.error||new Error('Taslak silinemedi.'));let ready=0;const apply=()=>{if(++ready!==2)return;const s=(a.result?.id===id?a.result:b.result) as MobileSession|undefined;if(!s||s.scope!==scope||s.submissionRequested||s.submission||s.confirmed){error=new Error('Gönderim bekleyen veya bulunamayan kayıt silinemez.');tx.abort();return;}if(a.result?.id===id)active.delete(scope);else saved.delete(id);};a.onsuccess=apply;b.onsuccess=apply;});
}
export async function finishMobileSession(scope:string,expectedSessionId?:string):Promise<InspectionLog> {
  const database=await db();
  const targetId=expectedSessionId||(await readMobileSession(scope))?.id;
  const packed=targetId?await prepareLegacyFiles(scope,targetId):{};
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(['sessions','archives'],'readwrite');const store=tx.objectStore('sessions'),archives=tx.objectStore('archives');const request=store.get(scope);let log:InspectionLog;let error:unknown;
    const finish=(raw:MobileSession|undefined,isActive:boolean)=>{try{if(!raw||raw.scope!==scope)throw new Error('Kontrol bulunamadı.');const s=withPackedLegacy(raw,packed);if(mobileSummary(s).missing.length)throw new Error('Tamamlanması gereken ölçümler var.');const finished={...s,completedAt:s.completedAt||new Date().toISOString(),submissionRequested:true};log=s.confirmed||{...mobileLog(finished,true),clientSyncStatus:'pending'};archives.put(finished);if(isActive)store.delete(scope);}catch(e){error=e;tx.abort();}};
    request.onsuccess=()=>{const active=request.result as MobileSession|undefined;if(!expectedSessionId||active?.id===expectedSessionId)finish(active,true);else{const archived=archives.get(expectedSessionId);archived.onsuccess=()=>finish(archived.result,false);}};
    tx.oncomplete=()=>{window.dispatchEvent(new Event('quality-mobile-queue-changed'));resolve(log);};tx.onabort=tx.onerror=()=>reject(error||new Error('Gönderim kuyruğu cihazda saklanamadı. Ölçüm oturumu korundu.'));
  });
}
export async function changeStoredSession(scope:string,id:string,change:(s:MobileSession)=>MobileSession):Promise<MobileSession> {
  const database=await db();
  const packed=await prepareLegacyFiles(scope,id);
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(['sessions','archives'],'readwrite');let updated:MobileSession;let error:unknown;
    const update=(store:IDBObjectStore,s:MobileSession|undefined)=>{try{if(!s||s.scope!==scope||s.id!==id)throw new Error('Gönderilecek ölçüm bulunamadı.');updated=change(withPackedLegacy(s,packed));const write=store.put(updated);write.onerror=()=>{error=write.error;};}catch(e){error=e;tx.abort();}};
    const active=tx.objectStore('sessions');const request=active.get(scope);
    request.onsuccess=()=>{if(request.result?.id===id)update(active,request.result);else{const archive=tx.objectStore('archives');const found=archive.get(id);found.onsuccess=()=>update(archive,found.result);}};
    tx.oncomplete=()=>resolve(updated);tx.onabort=tx.onerror=()=>reject(error||tx.error||new Error('Cihazdaki kayda erişilemedi; gönderim tekrar denenecek.'));
  });
}
// Read-modify-write in one IDB transaction keeps drafts, media and attempt outbox consistent across tabs.
export async function changeMobileSession(scope: string, change: (s: MobileSession | undefined) => MobileSession): Promise<MobileSession> {
  const database = await db();
  const current=await readMobileSession(scope);const packed=current?await prepareLegacyFiles(scope,current.id):{};
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sessions', 'readwrite'); const store = tx.objectStore('sessions');
    let updated: MobileSession; let error: unknown;
    const request = store.get(scope);
    request.onsuccess = () => { try { const old=request.result as MobileSession|undefined;updated = {...change(old?withPackedLegacy(old,packed):undefined),updatedAt:new Date().toISOString()}; store.put(updated); } catch (e) { error = e; tx.abort(); } };
    tx.oncomplete = () => resolve(updated);
    tx.onabort = tx.onerror = () => reject(error || new Error('Yerel kayıt yazılamadı. Depolama alanını kontrol edin; girişiniz korunuyor.'));
  });
}
export async function commitMobileCell(scope: string, cell: Cell, draft: MobileDraft, drawingReady: boolean, expectedPreviousId?:string|null, expectedSessionId?:string) {
  const token=localStorage.getItem('qualitrack_access_token');
  const claims=token?JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))):null;
  if(!claims?.exp||claims.exp*1000<=Date.now()||SaasApi.scope()!==scope)throw new Error('Oturum süresi doldu. Taslak korundu; yeniden giriş yapın.');
  const commit = (s:MobileSession|undefined) => {
    if (!s || (expectedSessionId&&s.id!==expectedSessionId) || s.submissionRequested || s.submission || s.confirmed) throw new Error('Bu oturum değişti veya gönderim için kilitli.');
    const c = s.plan.characteristics.find(c => c.id === cell.characteristic)!;
    const evaluated = evaluateMeasurement(c, draft.raw, draft.mode);
    const errors = evidenceErrors(c, evaluated.result, draft.photos.map(id => ({mimeType: s.media[id]?.file.type || ''})), draft.comment, draft.reason);
    if (draft.photos.some(id => !s.media[id])) errors.push('Kanıt cihazda saklanamadı.');
    if (c.policy?.drawingRequired && !drawingReady) errors.push('Zorunlu teknik resim yüklenmedi.');
    if (c.policy?.requireInstrument && !s.instrumentId.trim()) errors.push('Ölçüm aleti zorunludur.');
    if (c.policy?.liveCaptureRequired) errors.push('Bu plan doğrulanmış canlı çekim gerektiriyor; bu cihaz akışı desteklemiyor.');
    const previous = latestAttempt(s, cell);
    const concurrent=expectedPreviousId!==undefined&&(previous?.id||null)!==expectedPreviousId;
    if (previous && !draft.retryReason.trim() && !concurrent) errors.push('Tekrar ölçüm sebebi zorunludur.');
    if (errors.length) throw new Error(errors.join(' '));
    const attempt: MobileAttempt = {...cell,...draft,...evaluated,retryReason:draft.retryReason.trim()||(concurrent?'Başka sekmede kaydedilen ölçüm sonrası devam edildi':''),id:crypto.randomUUID(),previousAttemptId:previous?.id,operatorId:s.operatorId,measuredAt:new Date().toISOString(),source:s.source,instrumentId:s.instrumentId};
    const drafts = {...s.drafts}; delete drafts[cellKey(cell)];
    return {...s,attempts:[...s.attempts,attempt],drafts,updatedAt:new Date().toISOString()};
  };
  return expectedSessionId ? changeStoredSession(scope,expectedSessionId,commit) : changeMobileSession(scope,commit);
}
export function mobileSummary(s: MobileSession) {
  const cells = orderedCells(s.plan.characteristics.map(c => c.id),s.count,s.order);
  const missing = cells.filter(cell => !latestAttempt(s,cell));
  const review = s.plan.requiresApproval || s.attempts.some(a => a.result !== 'pass' || s.plan.characteristics.find(c => c.id === a.characteristic)?.policy?.requireReview || s.plan.characteristics.find(c => c.id === a.characteristic)?.policy?.requireSupervisorApproval);
  const photos = Object.values(s.media).filter(m => s.attempts.some(a => a.photos.includes(m.id)) && !m.attachment).length;
  return {cells,missing,review,photos};
}
export function mobileLog(s: MobileSession, localPreview=false): InspectionLog {
  const summary = mobileSummary(s);
  if (summary.missing.length || (!localPreview&&summary.photos)) throw new Error('Ölçüm veya kanıt gönderimi eksik.');
  const samples: SampleMeasurement[] = Array.from({length:s.count},(_,i) => {
    const sample: SampleMeasurement = {sampleIndex:i+1,values:{},statuses:{},evidence:{},pointNotes:{}};
    for (const c of s.plan.characteristics) {
      const a = latestAttempt(s,{sample:i+1,characteristic:c.id})!;
      sample.values[c.id] = a.value; sample.statuses[c.id] = a.result === 'pass' ? 'pass' : a.result === 'fail' ? 'fail' : 'warning';
      // All attempt evidence stays attached to the original cell, including earlier NOK attempts.
      sample.evidence![c.id] = [...new Set(s.attempts.filter(a => a.sample === i+1 && a.characteristic === c.id).flatMap(a => a.photos))].flatMap(id => s.media[id].attachment?[s.media[id].attachment!]:[]);
      sample.pointNotes![c.id] = a.comment;
    }
    return sample;
  });
  const completedAt=s.completedAt||new Date().toISOString();
  const elapsedSeconds=Math.max(0,Math.round((Date.parse(completedAt)-Date.parse(s.createdAt))/1000));
  const moments=[Date.parse(s.createdAt),...s.attempts.map(attempt=>Date.parse(attempt.measuredAt)).filter(Number.isFinite),Date.parse(completedAt)].sort((a,b)=>a-b);
  const activeSeconds=Math.round(moments.slice(1).reduce((total,time,index)=>total+Math.min(300,Math.max(0,(time-moments[index])/1000)),0));
  return {taskId:s.taskId,id:s.id,sessionCode:`INS-${s.id}`,productId:s.product.id,productCode:s.product.code,productName:s.product.name,controlPlanId:s.plan.id,controlPlanVersion:s.plan.version,controlPlanSnapshot:s.plan,operatorName:s.operatorName,operatorUserId:s.operatorId,lotNumber:s.lotNumber,orderNumber:s.orderNumber,serialNumber:s.serialNumber,machineNo:s.instrumentId,equipmentId:s.instrumentId,source:s.source as InspectionLog['source'],sampleCount:s.count,samples,timestamp:s.createdAt,timing:{startedAt:s.createdAt,completedAt,elapsedSeconds,activeSeconds},overallStatus:localPreview?(samples.some(sample=>Object.values(sample.statuses).includes('fail'))?'fail':summary.review?'warning':'pass'):'warning',totalPointsChecked:summary.cells.length,failedPointsCount:localPreview?samples.reduce((total,sample)=>total+Object.values(sample.statuses).filter(status=>status==='fail').length,0):0,warningPointsCount:localPreview?samples.reduce((total,sample)=>total+Object.values(sample.statuses).filter(status=>status==='warning').length,0):0,
    mobileMeasurement:{version:1,attempts:s.attempts.map(a => ({...a,photos:a.photos.map(id => s.media[id].attachment?.id||id)}))}};
}
const running = new Map<string, Promise<MobileSession | undefined>>();
export async function syncMobileSession(scope: string, queued?:MobileSession) {
  const requested=queued||await readMobileSession(scope);
  const initial=requested?await readStoredMobileSession(scope,requested.id):undefined;
  if(!initial)return;
  const key=`${scope}:${initial.id}`;
  if (running.has(key)) return running.get(key)!;
  const task = (async () => {
    let s:MobileSession=initial;
    if (!s || s.confirmed || !navigator.onLine) return s;
    try {
      if (SaasApi.scope() !== scope) throw new Error('Oturum sahibi değişti; kendi hesabınızla giriş yapın.');
      for (const media of Object.values(s.media).filter(m => !m.attachment && s!.attempts.some(a => a.photos.includes(m.id)))) {
        try {
          const attachment = await SaasApi.uploadFile(mobileFile(media.file),media.id);
            s = await changeStoredSession(scope,s.id, current => ({...current,media:{...current.media,[media.id]:{...current.media[media.id],attachment,error:undefined}}}));
        } catch (error) {
          await changeStoredSession(scope,s.id,current => ({...current,media:{...current.media,[media.id]:{...current.media[media.id],error:(error as Error).message}}}));
          throw error;
        }
      }
      // Existing API accepts complete inspections; incomplete attempts remain in the durable local outbox.
      if (s.submissionRequested && !mobileSummary(s).missing.length) {
        s = await changeStoredSession(scope,s.id,current => ({...current,submission:current.submission || mobileLog(current)}));
        const confirmed = await StorageService.saveInspectionLog(s.submission!,true);
        s = await changeStoredSession(scope,s.id,current => ({...current,confirmed,syncError:undefined}));
      }
    } catch (error) {
      const rejected=error instanceof Error&&(error as Error&{code?:string}).code==='INSPECTION_REJECTED_UNSAVED';
      try {
        s = await changeStoredSession(scope,s.id,current => rejected?({...current,submissionRequested:false,submission:undefined,syncError:(error as Error).message}):({...current,syncError:(error as Error).message}));
        if(rejected)window.dispatchEvent(new Event('quality-mobile-queue-changed'));
      } catch {
        throw error;
      }
    }
    return s;
  })().finally(() => running.delete(key));
  running.set(key,task); return task;
}
