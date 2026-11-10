/** Locate a printed ± by its separate plus and lower bar, not by guessing an
 * OCR substitution such as '=' or '+'. Input is a tightly cropped text line. */
export function plusMinusGlyph(pixels:Uint8ClampedArray,width:number,height:number):{left:number;right:number}|null{
  const dark=(x:number,y:number)=>pixels[(y*width+x)*4]<130&&pixels[(y*width+x)*4+3]>128;
  let start=-1;
  for(let x=0;x<=width;x++){
    const occupied=x<width&&Array.from({length:height},(_,y)=>dark(x,y)).some(Boolean);
    if(occupied&&start<0)start=x;
    if(occupied||start<0)continue;
    const w=x-start;
    if(w>=4&&w<=height*1.2){
      const rows=Array.from({length:height},(_,y)=>{let n=0;for(let j=start;j<x;j++)if(dark(j,y))n++;return n;});
      const segments:{top:number;bottom:number}[]=[];let top=-1;
      for(let y=0;y<=height;y++){if(rows[y]>0&&top<0)top=y;if(!rows[y]&&top>=0){segments.push({top,bottom:y-1});top=-1;}}
      if(segments.length===2){
        const [a,b]=segments,ah=a.bottom-a.top+1,bh=b.bottom-b.top+1,upper=rows.slice(a.top,a.bottom+1),lower=rows.slice(b.top,b.bottom+1);
        if(ah>=4&&bh<=ah*.45&&b.top-a.bottom<=ah*.6&&Math.max(...upper)>=w*.75&&Math.min(...upper)<=w*.4&&Math.max(...lower)>=w*.8&&upper[0]<=w*.5&&upper.at(-1)!<=w*.5)return {left:start,right:x};
      }
    }
    start=-1;
  }
  return null;
}
