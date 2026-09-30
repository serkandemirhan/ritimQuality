import React from 'react';
import {DataTable, Badge} from './ui';

// Read-only summary of server/routes/saas.ts and workflow.ts. Not an authorization source.
const permissions = [
  ['Kullanıcı / firma / iş kuralları yönetimi', 'İzinli', '—', '—', '—'],
  ['Ürün / kontrol planı düzenleme', 'İzinli', 'İzinli', '—', '—'],
  ['Ölçüm kaydetme', 'İzinli', 'İzinli', 'İzinli', '—'],
  ['Ölçüm onay / red', 'Başkasının ölçümü', 'Başkasının ölçümü', '—', '—'],
  ['Görev atama', 'İzinli', 'İzinli', '—', '—'],
  ['Görev başlatma / tamamlama', 'İzinli', 'İzinli', 'Kendi görevi', '—'],
  ['Organizasyon yönetimi', 'İzinli', '—', '—', '—'],
  ['Denetim izi görüntüleme', 'İzinli', '—', '—', 'İzinli'],
];
export function RoleMatrix() {
  return <details className="rq-card"><summary className="rq-section-title cursor-pointer">Roller ne yapabilir?</summary>
    <p className="rq-helper">Mevcut rol yetkileri. Kayıt durumu ve sorumluluk kontrolleri işlem sırasında ayrıca uygulanır.</p>
    <DataTable label="Rol ve işlem yetkileri"><thead><tr><th scope="col">İşlem</th>{['Yönetici','Kalite Uzmanı','Operatör','Denetçi'].map(role=><th key={role} scope="col">{role}</th>)}</tr></thead><tbody>{permissions.map(([label,...values])=><tr key={label}><th scope="row">{label}</th>{values.map((value,index)=><td key={index}>{value==='—'?<span aria-label="Yetki yok">—</span>:<Badge tone={value==='İzinli'?'success':'info'}>{value}</Badge>}</td>)}</tr>)}</tbody></DataTable>
  </details>;
}
