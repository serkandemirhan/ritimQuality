import {Badge} from './ui';
import type {InspectionLog} from '../types';
export function ApprovalSummary({log}:{log:InspectionLog}){
 const approval=log.approval;
 const status=approval?.status||(log.requiresReview||log.controlPlanSnapshot?.requiresApproval?'pending':'not_required');
 const labels={approved:'Onaylandı',rejected:'Reddedildi',pending:'Onay bekliyor',not_required:'Onay gerekmiyor'};
 return <section className="rq-approval-summary" aria-label="Yönetici onayı"><div><strong>Yönetici onayı</strong><Badge tone={status==='approved'?'success':status==='rejected'?'danger':status==='pending'?'warning':'neutral'}>{labels[status]}</Badge></div>{approval?.reviewedBy&&<p>{approval.reviewedBy} · {approval.reviewedAt?new Date(approval.reviewedAt).toLocaleString('tr-TR'):''}</p>}{approval?.reason&&<p><strong>Gerekçe:</strong> {approval.reason}</p>}</section>;
}
