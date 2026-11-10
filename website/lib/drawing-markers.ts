import type {ControlPoint,SourceText} from './drawing-demo';

/** Keep balloon centres away from extracted text and from other balloons.
 * Positions are percentages of the page, so leaders stay aligned while zooming. */
export function placeMarkers(points:ControlPoint[],sources:SourceText[],aspect:number){
  const placed:{x:number;y:number}[]=[],rx=3,ry=rx*aspect;
  return points.map(point=>{
    if(point.x===null||point.y===null)return null;
    const candidates=[7,11,16].flatMap(distance=>[-90,-135,-45,180,0,135,45,90].map(angle=>({x:point.x!+Math.cos(angle*Math.PI/180)*distance,y:point.y!+Math.sin(angle*Math.PI/180)*distance*aspect})));
    const scored=candidates.filter(p=>p.x>=rx&&p.x<=100-rx&&p.y>=ry&&p.y<=100-ry).map(p=>{
      const collisions=sources.filter(s=>p.x+rx>s.x-.5&&p.x-rx<s.x+s.width+.5&&p.y+ry>s.y-.5&&p.y-ry<s.y+s.height+.5).length;
      const overlaps=placed.filter(q=>Math.hypot((p.x-q.x)/rx,(p.y-q.y)/ry)<2.3).length;
      return {...p,score:collisions*1000+overlaps*2000+Math.hypot(p.x-point.x!,(p.y-point.y!)/aspect)};
    }).sort((a,b)=>a.score-b.score);
    const chosen=scored[0]||{x:Math.max(rx,Math.min(100-rx,point.x)),y:Math.max(ry,Math.min(100-ry,point.y))};
    placed.push(chosen);return {x:chosen.x,y:chosen.y};
  });
}
