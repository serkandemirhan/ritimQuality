import {conflict,inspectionSignature} from './inspectionValidation.js';

export function assertPlanPreconditions(prior:unknown,expected:string|undefined,active:string,expectedActive:string|undefined){
  if(expected&&expected!==(prior?inspectionSignature(prior):'missing'))conflict('Plan başka bir kullanıcı tarafından değiştirildi. Değişiklikleriniz korunuyor; güncel planı inceleyin.');
  if(expectedActive!==undefined&&active!==expectedActive)conflict('Aktif plan başka bir kullanıcı tarafından değiştirildi. Yayınlamadan önce planları yenileyin.');
}
