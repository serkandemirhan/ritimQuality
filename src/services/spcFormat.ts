/** Preserve calculation precision; only format at the presentation boundary. */
export function formatSpcMeasurement(value:number,context:{precision?:number;lsl:number;usl:number}):string{
  if(!Number.isFinite(value))return '—';
  const width=context.usl-context.lsl;
  const decimals=Math.min(12,Math.max(4,Number.isFinite(context.precision)?context.precision!+2:0,width>0?Math.ceil(-Math.log10(width))+5:4));
  if(value!==0&&Math.abs(value)<10**(-decimals))return value.toExponential(4);
  return value.toLocaleString('tr-TR',{maximumFractionDigits:decimals,useGrouping:false});
}
export const formatCapability=(value:number|null)=>value===null?'—':value.toFixed(2);
