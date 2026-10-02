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
export interface LocalMedia { id: string; file: File; attachment?: EvidenceAttachment; error?: string }
export interface MobileSession {
  id: string; scope: string; plan: ControlPlan; product: Product; count: number; operatorId: string; operatorName: string;
  orderNumber: string; lotNumber: string; serialNumber: string; instrumentId: string; source: string;
  active: Cell; order: 'sample' | 'characteristic'; drafts: Record<string, MobileDraft>; attempts: MobileAttempt[];
  media: Record<string, LocalMedia>; createdAt: string; submissionRequested?: boolean; submission?: InspectionLog; confirmed?: InspectionLog; syncError?: string;
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
  return new Promise<void>((resolve,reject)=>{
    const tx=database.transaction(['sessions','archives'],'readwrite');const store=tx.objectStore('sessions');const request=store.get(scope);
    request.onsuccess=()=>{const s=request.result as MobileSession;if(!s?.confirmed){tx.abort();return;}tx.objectStore('archives').put(s);store.delete(scope);};
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
export async function readMobileUploads(scope:string):Promise<MobileSession[]> {
  const database=await db();
  return new Promise((resolve,reject)=>{const request=database.transaction('archives').objectStore('archives').getAll();request.onsuccess=()=>resolve((request.result as MobileSession[]).filter(s=>s.scope===scope&&!s.confirmed));request.onerror=()=>reject(request.error);});
}
export async function finishMobileSession(scope:string):Promise<InspectionLog> {
  const database=await db();
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(['sessions','archives'],'readwrite');const store=tx.objectStore('sessions');const request=store.get(scope);let log:InspectionLog;let error:unknown;
    request.onsuccess=()=>{try{const s=request.result as MobileSession;if(!s||mobileSummary(s).missing.length)throw new Error('Ölçümü tamamlamak için eksik noktaları kaydedin.');log=s.confirmed||{...mobileLog(s,true),clientSyncStatus:'pending'};tx.objectStore('archives').put({...s,submissionRequested:true});store.delete(scope);}catch(e){error=e;tx.abort();}};
    tx.oncomplete=()=>{window.dispatchEvent(new Event('quality-mobile-queue-changed'));resolve(log);};tx.onabort=tx.onerror=()=>reject(error||new Error('Gönderim kuyruğu cihazda saklanamadı. Ölçüm oturumu korundu.'));
  });
}
async function changeStoredSession(scope:string,id:string,change:(s:MobileSession)=>MobileSession):Promise<MobileSession> {
  const database=await db();
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(['sessions','archives'],'readwrite');let updated:MobileSession;let error:unknown;
    const update=(store:IDBObjectStore,s:MobileSession|undefined)=>{try{if(!s||s.scope!==scope||s.id!==id)throw new Error('Gönderilecek ölçüm bulunamadı.');updated=change(s);store.put(updated);}catch(e){error=e;tx.abort();}};
    const active=tx.objectStore('sessions');const request=active.get(scope);
    request.onsuccess=()=>{if(request.result?.id===id)update(active,request.result);else{const archive=tx.objectStore('archives');const found=archive.get(id);found.onsuccess=()=>update(archive,found.result);}};
    tx.oncomplete=()=>resolve(updated);tx.onabort=tx.onerror=()=>reject(error||new Error('Gönderim durumu cihazda saklanamadı.'));
  });
}
// Read-modify-write in one IDB transaction keeps drafts, media and attempt outbox consistent across tabs.
export async function changeMobileSession(scope: string, change: (s: MobileSession | undefined) => MobileSession): Promise<MobileSession> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sessions', 'readwrite'); const store = tx.objectStore('sessions');
    let updated: MobileSession; let error: unknown;
    const request = store.get(scope);
    request.onsuccess = () => { try { updated = change(request.result); store.put(updated); } catch (e) { error = e; tx.abort(); } };
    tx.oncomplete = () => resolve(updated);
    tx.onabort = tx.onerror = () => reject(error || new Error('Yerel kayıt yazılamadı. Depolama alanını kontrol edin; girişiniz korunuyor.'));
  });
}
export async function commitMobileCell(scope: string, cell: Cell, draft: MobileDraft, drawingReady: boolean, expectedPreviousId?:string|null) {
  const token=localStorage.getItem('qualitrack_access_token');
  const claims=token?JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))):null;
  if(!claims?.exp||claims.exp*1000<=Date.now()||SaasApi.scope()!==scope)throw new Error('Oturum süresi doldu. Taslak korundu; yeniden giriş yapın.');
  return changeMobileSession(scope, s => {
    if (!s || s.submissionRequested || s.submission || s.confirmed) throw new Error('Bu oturum gönderim için kilitli.');
    const c = s.plan.characteristics.find(c => c.id === cell.characteristic)!;
    const evaluated = evaluateMeasurement(c, draft.raw, draft.mode);
    const errors = evidenceErrors(c, evaluated.result, draft.photos.map(id => ({mimeType: s.media[id]?.file.type || ''})), draft.comment, draft.reason);
    if (draft.photos.some(id => !s.media[id])) errors.push('Kanıt cihazda saklanamadı.');
    if (c.policy?.drawingRequired && !drawingReady) errors.push('Zorunlu teknik resim yüklenmedi.');
    if (c.policy?.requireInstrument && !s.instrumentId.trim()) errors.push('Ölçüm aleti zorunludur.');
    if (c.policy?.liveCaptureRequired) errors.push('Bu plan doğrulanmış canlı çekim gerektiriyor; bu cihaz akışı desteklemiyor.');
    const previous = latestAttempt(s, cell);
    if(expectedPreviousId!==undefined&&(previous?.id||null)!==expectedPreviousId)errors.push('Bu hücre başka bir sekmede değişti. İki giriş korunuyor; oturumu yeniden açıp denemeleri inceleyin.');
    if (previous && !draft.retryReason.trim()) errors.push('Tekrar ölçüm sebebi zorunludur.');
    if (errors.length) throw new Error(errors.join(' '));
    const attempt: MobileAttempt = {...cell,...draft,...evaluated,id:crypto.randomUUID(),previousAttemptId:previous?.id,operatorId:s.operatorId,measuredAt:new Date().toISOString(),source:s.source,instrumentId:s.instrumentId};
    const drafts = {...s.drafts}; delete drafts[cellKey(cell)];
    return {...s,attempts:[...s.attempts,attempt],drafts};
  });
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
  return {id:s.id,sessionCode:`INS-${s.id}`,productId:s.product.id,productCode:s.product.code,productName:s.product.name,controlPlanId:s.plan.id,controlPlanVersion:s.plan.version,controlPlanSnapshot:s.plan,operatorName:s.operatorName,operatorUserId:s.operatorId,lotNumber:s.lotNumber,orderNumber:s.orderNumber,serialNumber:s.serialNumber,machineNo:s.instrumentId,equipmentId:s.instrumentId,source:s.source as InspectionLog['source'],sampleCount:s.count,samples,timestamp:s.createdAt,overallStatus:localPreview?(samples.some(sample=>Object.values(sample.statuses).includes('fail'))?'fail':summary.review?'warning':'pass'):'warning',totalPointsChecked:summary.cells.length,failedPointsCount:localPreview?samples.reduce((total,sample)=>total+Object.values(sample.statuses).filter(status=>status==='fail').length,0):0,warningPointsCount:localPreview?samples.reduce((total,sample)=>total+Object.values(sample.statuses).filter(status=>status==='warning').length,0):0,
    mobileMeasurement:{version:1,attempts:s.attempts.map(a => ({...a,photos:a.photos.map(id => s.media[id].attachment?.id||id)}))}};
}
const running = new Map<string, Promise<MobileSession | undefined>>();
export async function syncMobileSession(scope: string, queued?:MobileSession) {
  const initial=queued||await readMobileSession(scope);
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
          const attachment = await SaasApi.uploadFile(media.file,media.id);
            s = await changeStoredSession(scope,s.id, current => ({...current,media:{...current.media,[media.id]:{...current.media[media.id],attachment,error:undefined}}}));
        } catch (error) {
          await changeStoredSession(scope,s.id,current => ({...current,media:{...current.media,[media.id]:{...current.media[media.id],error:(error as Error).message}}}));
          throw error;
        }
      }
      // Existing API accepts complete inspections; incomplete attempts remain in the durable local outbox.
      if (s.submissionRequested && !mobileSummary(s).missing.length) {
        s = await changeStoredSession(scope,s.id,current => ({...current,submission:current.submission || mobileLog(current)}));
        const confirmed = await StorageService.saveInspectionLog(s.submission!);
        s = await changeStoredSession(scope,s.id,current => ({...current,confirmed,syncError:undefined}));
      }
    } catch (error) {
      s = await changeStoredSession(scope,s.id,current => ({...current,syncError:(error as Error).message}));
    }
    return s;
  })().finally(() => running.delete(key));
  running.set(key,task); return task;
}
