// Shared semantic chart presentation; calculations remain in the SPC service.
export const chartColors = {
  measurement: '#315d91', range: '#0f766e', grid: '#e8edf3',
  axis: '#65748b', target: '#6f819c', specification: '#be2846', control: '#93641a',
};
export const chartAxis = {tickLine: false, axisLine: false, tick: {fill: chartColors.axis, fontSize: 11}};
export const chartTooltip = {
  contentStyle: {border: '1px solid #dce2ea', borderRadius: 8, fontSize: 12, background: '#fff', color: '#17263d'},
  labelStyle: {fontWeight: 600, color: '#17263d'},
  itemStyle: {fontFamily: 'ui-monospace, monospace'},
};
export function chartDate(value: unknown) {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('tr-TR');
}
