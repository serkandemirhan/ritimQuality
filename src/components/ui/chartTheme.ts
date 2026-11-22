// Shared semantic chart presentation; calculations remain in the SPC service.
export const chartColors = {
  measurement: '#2563eb', range: '#0f766e', grid: '#e8edf3',
  axis: '#64748b', target: '#6f819c', specification: '#b91c1c', control: '#a16207',
};
export const chartAxis = {tickLine: false, axisLine: false, tick: {fill: chartColors.axis, fontSize: 11}};
export const chartTooltip = {
  contentStyle: {border: '1px solid #dfe5ee', borderRadius: 8, fontSize: 12, background: '#fff', color: '#1e293b'},
  labelStyle: {fontWeight: 600, color: '#1e293b'},
  itemStyle: {fontFamily: 'ui-monospace, monospace'},
};
export function chartDate(value: unknown) {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('tr-TR');
}
