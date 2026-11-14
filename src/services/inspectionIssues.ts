import { evidenceErrors, type QualityResult } from '../../server/services/measurementCore';
import type { Characteristic, SampleMeasurement } from '../types';

export interface InspectionIssue { sample: number; pointNo: number; characteristicId: string; messages: string[] }

export function inspectionIssues(samples: SampleMeasurement[], characteristics: Characteristic[], equipmentId: string): InspectionIssue[] {
  return samples.flatMap(sample => characteristics.flatMap(characteristic => {
    const status = sample.statuses[characteristic.id];
    const value = sample.values[characteristic.id];
    const missingValue = status === undefined || status === 'empty' || value === null || value === undefined;
    const result: QualityResult = status === 'fail' ? 'fail' : status === 'warning' && value === 'SUSPECT' ? 'review' : 'pass';
    const attachments = sample.evidence?.[characteristic.id] || [];
    const messages = missingValue ? ['Ölçüm değeri girilmedi.'] : [];
    messages.push(...evidenceErrors(characteristic, result, attachments.map(item => ({mimeType: item.mimeType || ''})), sample.pointNotes?.[characteristic.id] || '', ''));
    if (characteristic.policy?.requireInstrument && !equipmentId.trim()) messages.push('Ölçüm aleti zorunludur.');
    if (characteristic.policy?.liveCaptureRequired) messages.push('Doğrulanmış canlı çekim desteği gerekli.');
    return messages.length ? [{sample:sample.sampleIndex, pointNo:characteristic.pointNo, characteristicId:characteristic.id, messages}] : [];
  }));
}
