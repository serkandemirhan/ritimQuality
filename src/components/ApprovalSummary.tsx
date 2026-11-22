import {reportApprovalState,reportApprovalText} from '../services/reportPresentation';
import {Badge} from './ui';
import type {InspectionLog} from '../types';
export function ApprovalSummary({log}:{log:InspectionLog}){
 const approval=log.approval;
 const status=reportApprovalState(log);
 return <section className="rq-approval-summary" aria-label="Onay durumu"><div><strong>Onay durumu</strong><Badge tone={status==='approved'?'success':status==='rejected'?'danger':status==='pending'?'warning':'neutral'}>{reportApprovalText(log)}</Badge></div>{approval?.reviewedBy&&<p>{approval.reviewedBy} · {approval.reviewedAt?new Date(approval.reviewedAt).toLocaleString('tr-TR'):''}</p>}{approval?.reason&&<p><strong>Gerekçe:</strong> {approval.reason}</p>}</section>;
}
