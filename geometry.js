const TAU = Math.PI * 2;
const mod = a => (a % TAU + TAU) % TAU;
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export function endTangent(arc) {
  if(arc.line){const length=distance(arc.a,arc.b);return {x:(arc.b.x-arc.a.x)/length,y:(arc.b.y-arc.a.y)/length};}
  const direction=arc.ccw?-1:1;
  return {x:-Math.sin(arc.end)*direction,y:Math.cos(arc.end)*direction};
}
// The center lies on the normal to the inherited tangent at the start.
export function tangentArc(a,b,tangent) {
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(length<1e-7)return null;
  const nx=-tangent.y,ny=tangent.x,projection=dx*nx+dy*ny;
  if(Math.abs(projection)<length*1e-10){
    return dx*tangent.x+dy*tangent.y>0?{a,b,line:true}:null;
  }
  const offset=length*length/(2*projection),c={x:a.x+nx*offset,y:a.y+ny*offset};
  return {a,b,c,r:Math.abs(offset),start:Math.atan2(a.y-c.y,a.x-c.x),end:Math.atan2(b.y-c.y,b.x-c.x),ccw:offset<0,line:false};
}
export function isLegalConnection(candidate,arcs) {
  if(!candidate)return false;
  return !arcs.some(arc=>conflicts(candidate,arc));
}
export function hasLegalContinuation(nodes,arcs) {
  if(!arcs.length)return true;
  const last=arcs.at(-1),tangent=endTangent(last);
  return nodes.some(node=>{
    const candidate=tangentArc(last.b,node,tangent);
    return isLegalConnection(candidate,arcs);
  });
}
// Signed sagitta specifies the circular arc's midpoint relative to its chord.
export function makeArc(a,b,s) {
  const length = distance(a,b), nx = -(b.y-a.y)/length, ny = (b.x-a.x)/length;
  if (Math.abs(s)<0.01) return {a,b,line:true};
  const offset = s/2-length*length/(8*s);
  const c={x:(a.x+b.x)/2+nx*offset,y:(a.y+b.y)/2+ny*offset};
  const r=distance(a,c), start=Math.atan2(a.y-c.y,a.x-c.x), end=Math.atan2(b.y-c.y,b.x-c.x);
  const ccw=s>0;
  return {a,b,c,r,start,end,ccw,line:false};
}
function onArc(p,arc) {
  if(arc.line) return Math.abs(distance(arc.a,p)+distance(p,arc.b)-distance(arc.a,arc.b))<1e-5;
  const angle=Math.atan2(p.y-arc.c.y,p.x-arc.c.x);
  return (arc.ccw ? mod(arc.start-angle) : mod(angle-arc.start)) <= (arc.ccw ? mod(arc.start-arc.end) : mod(arc.end-arc.start))+1e-7;
}
function lineCircle(line,circle) {
  const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y, fx=line.a.x-circle.c.x,fy=line.a.y-circle.c.y;
  const a=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-circle.r*circle.r,disc=b*b-4*a*c;
  if(disc < -1e-7) return [];
  return [(-b-Math.sqrt(Math.max(0,disc)))/(2*a),(-b+Math.sqrt(Math.max(0,disc)))/(2*a)].filter(t=>t>=-1e-7&&t<=1+1e-7).map(t=>({x:line.a.x+t*dx,y:line.a.y+t*dy}));
}
export function conflicts(a,b) {
  const shared=[a.a,a.b].filter(p=>[b.a,b.b].some(q=>distance(p,q)<1e-6));
  const forbidden=p=>!shared.some(q=>distance(p,q)<1e-4);
  let hits=[];
  if(a.line&&b.line) {
    const ux=a.b.x-a.a.x,uy=a.b.y-a.a.y,vx=b.b.x-b.a.x,vy=b.b.y-b.a.y,wx=b.a.x-a.a.x,wy=b.a.y-a.a.y,det=ux*vy-uy*vx;
    if(Math.abs(det)<1e-8) {
      if(Math.abs(wx*uy-wy*ux)>1e-7)return false;
      const denom=ux*ux+uy*uy,t0=(wx*ux+wy*uy)/denom,t1=t0+(vx*ux+vy*uy)/denom;
      return Math.min(1,Math.max(t0,t1))-Math.max(0,Math.min(t0,t1))>1e-7;
    }
    const t=(wx*vy-wy*vx)/det,u=(wx*uy-wy*ux)/det;
    if(t>=-1e-7&&t<=1+1e-7&&u>=-1e-7&&u<=1+1e-7)hits=[{x:a.a.x+t*ux,y:a.a.y+t*uy}];
  } else if(a.line||b.line) hits=lineCircle(a.line?a:b,a.line?b:a).filter(p=>onArc(p,a.line?b:a));
  else {
    const d=distance(a.c,b.c);
    if(d<1e-7&&Math.abs(a.r-b.r)<1e-6) {
      // Same supporting circle: any interior overlap is invalid.
      const mid=arc=>{const sweep=arc.ccw?-mod(arc.start-arc.end):mod(arc.end-arc.start);return {x:arc.c.x+arc.r*Math.cos(arc.start+sweep/2),y:arc.c.y+arc.r*Math.sin(arc.start+sweep/2)}};
      return [a.a,a.b,mid(a)].some(p=>onArc(p,b)&&forbidden(p))||[b.a,b.b,mid(b)].some(p=>onArc(p,a)&&forbidden(p));
    }
    if(d<1e-7||d>a.r+b.r+1e-7||d<Math.abs(a.r-b.r)-1e-7)return false;
    const along=(a.r*a.r-b.r*b.r+d*d)/(2*d),h=Math.sqrt(Math.max(0,a.r*a.r-along*along));
    const x=a.c.x+along*(b.c.x-a.c.x)/d,y=a.c.y+along*(b.c.y-a.c.y)/d;
    hits=[{x:x-h*(b.c.y-a.c.y)/d,y:y+h*(b.c.x-a.c.x)/d},{x:x+h*(b.c.y-a.c.y)/d,y:y-h*(b.c.x-a.c.x)/d}].filter(p=>onArc(p,a)&&onArc(p,b));
  }
  return hits.some(forbidden);
}
