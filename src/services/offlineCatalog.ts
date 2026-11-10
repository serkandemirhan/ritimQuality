import type {ControlPlan,Product,TenantCompany,User} from '../types';
import type {InspectionRules} from './api';

export interface OfflineInspectionCatalog {
  version: 1;
  scope: string;
  savedAt: string;
  products: Product[];
  controlPlans: ControlPlan[];
  currentUser: User;
  company: TenantCompany;
  rules?: InspectionRules;
}

const DATABASE='ritim-offline-catalog';
const STORE='catalogs';

const database=()=>new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(DATABASE,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'scope'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});

export async function saveOfflineCatalog(catalog:OfflineInspectionCatalog):Promise<void>{
  const db=await database();
  await new Promise<void>((resolve,reject)=>{
    const transaction=db.transaction(STORE,'readwrite');
    transaction.objectStore(STORE).put(catalog);
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error);
  });
  db.close();
}

export async function readOfflineCatalog(scope:string):Promise<OfflineInspectionCatalog|undefined>{
  const db=await database();
  const catalog=await new Promise<OfflineInspectionCatalog|undefined>((resolve,reject)=>{
    const request=db.transaction(STORE).objectStore(STORE).get(scope);
    request.onsuccess=()=>resolve(request.result as OfflineInspectionCatalog|undefined);
    request.onerror=()=>reject(request.error);
  });
  db.close();
  return catalog?.version===1?catalog:undefined;
}

export async function saveOfflineRules(scope:string,rules:InspectionRules):Promise<void>{
  const catalog=await readOfflineCatalog(scope);
  if(catalog)await saveOfflineCatalog({...catalog,rules,savedAt:new Date().toISOString()});
}
