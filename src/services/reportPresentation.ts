import type {ControlPlan,InspectionLog} from '../types';
export type ReportApprovalState='approved'|'rejected'|'pending'|'not_required';
export function reportApprovalState(log:InspectionLog,plan?:ControlPlan):ReportApprovalState{
 if(log.approval?.status)return log.approval.status;
 if(log.operatorRoleAtMeasurement==='admin')return 'not_required';
 const snapshot=log.controlPlanSnapshot||plan;
 return log.requiresReview||snapshot?.requiresApproval||snapshot?.characteristics.some(c=>c.policy?.requireReview||c.policy?.requireSupervisorApproval)?'pending':'not_required';
}
export function reportApprovalText(log:InspectionLog,plan?:ControlPlan){
 return {approved:'Onaylandı',rejected:'Reddedildi',pending:'Onay bekliyor',not_required:'Onay gerekmiyor'}[reportApprovalState(log,plan)];
}
export function reportHeading(log:InspectionLog,plan?:ControlPlan,isExample=false){
 if(isExample)return {state:'example',title:'ÖRNEK KALİTE RAPORU',label:'Örnek rapor',tone:'neutral',note:'Gösterim amaçlı örnek rapordur.'};
 if(log.clientSyncStatus==='pending')return {state:'local',title:'YEREL KALİTE RAPORU',label:'Senkronizasyon bekliyor',tone:'warning',note:'Sunucu senkronizasyonu tamamlanmadı; onay durumu kesinleşmedi.'};
 const state=reportApprovalState(log,plan);
 if(state==='pending')return {state,title:'KALİTE RAPORU — ONAY BEKLİYOR',label:'Onay bekliyor',tone:'warning',note:'Bu rapor henüz yetkili onayından geçmemiştir.'};
 if(state==='rejected')return {state,title:'KALİTE RAPORU — REDDEDİLDİ',label:'Reddedildi',tone:'danger',note:'Kontrol reddedildi; yeniden kontrol gereklidir.'};
 if(state==='approved')return {state,title:'ONAYLANMIŞ KALİTE RAPORU',label:'Onaylandı',tone:'success',note:'Yetkili incelemesi tamamlandı.'};
 return {state,title:'KALİTE RAPORU',label:'Ek onay gerekmiyor',tone:'info',note:log.operatorRoleAtMeasurement==='admin'?'Ölçüm yönetici tarafından yapıldı; ek onay gerekmiyor.':'Bu ölçüm için ek onay gerekmiyor.'};
}
