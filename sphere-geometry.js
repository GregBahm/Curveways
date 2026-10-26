const TAU=Math.PI*2,EPS=1e-7;
export const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export const length=a=>Math.hypot(a.x,a.y,a.z);
export const unit=a=>mul(a,1/(length(a)||1));
export const distance=(a,b)=>length(sub(a,b));
const mod=a=>(a%TAU+TAU)%TAU;
export function pointOnArc(arc,t){const angle=arc.sweep*t;return add(arc.c,mul(add(mul(arc.u,Math.cos(angle)),mul(arc.v,Math.sin(angle))),arc.r));}
function circleArc(a,b,normal){
  const n=unit(normal),d=dot(n,a),c=mul(n,d),r=Math.sqrt(Math.max(0,1-d*d));
  if(r<EPS||distance(a,b)<EPS)return null;
  const u=unit(sub(a,c)),v=cross(n,u),q=sub(b,c);
  return {a,b,n,d,c,r,u,v,sweep:mod(Math.atan2(dot(q,v),dot(q,u)))};
}
export function greatArc(a,b){
  let n=cross(a,b);
  if(length(n)<EPS)n=cross(a,Math.abs(a.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0});
  return circleArc(a,b,n);
}
export function throughArc(a,b,mid){
  const normal=cross(sub(b,a),sub(mid,a));
  if(length(normal)<EPS)return greatArc(a,b);
  let arc=circleArc(a,b,normal);
  if(arc&&!contains(arc,mid))arc=circleArc(a,b,mul(normal,-1));
  return arc;
}
export function endTangent(arc){return unit(cross(arc.n,sub(arc.b,arc.c)));}
export function tangentArc(a,b,tangent){
  if(distance(a,b)<EPS)return null;
  let normal=cross(tangent,sub(b,a));
  if(length(normal)<EPS)return null;
  if(dot(cross(normal,a),tangent)<0)normal=mul(normal,-1);
  return circleArc(a,b,normal);
}
function contains(arc,p){
  if(distance(arc.a,p)<1e-6||distance(arc.b,p)<1e-6)return true;
  const q=sub(p,arc.c),angle=mod(Math.atan2(dot(q,arc.v),dot(q,arc.u)));
  return angle<=arc.sweep+1e-7;
}
export function conflicts(a,b){
  const shared=[a.a,a.b].filter(p=>[b.a,b.b].some(q=>distance(p,q)<1e-6));
  const forbidden=p=>!shared.some(q=>distance(p,q)<1e-5);
  const cosine=dot(a.n,b.n),axisVector=cross(a.n,b.n),denom=dot(axisVector,axisVector);
  if(denom<1e-20&&Math.abs(a.d-(cosine>0?b.d:-b.d))<1e-10){
    return [a.a,a.b,pointOnArc(a,.5)].some(p=>contains(b,p)&&forbidden(p))||[b.a,b.b,pointOnArc(b,.5)].some(p=>contains(a,p)&&forbidden(p));
  }
  if(denom<1e-24)return false;
  const axis=unit(axisVector);
  if(shared.length){
    // The intersection line passes through the known node. Its other sphere
    // intersection is a reflection along that line; no near-parallel plane solve.
    const other=sub(shared[0],mul(axis,2*dot(shared[0],axis)));
    return forbidden(other)&&contains(a,other)&&contains(b,other);
  }
  const origin=add(mul(a.n,(a.d-cosine*b.d)/denom),mul(b.n,(b.d-cosine*a.d)/denom));
  const remaining=1-dot(origin,origin);
  if(remaining < -1e-8)return false;
  const offset=mul(axis,Math.sqrt(Math.max(0,remaining)));
  return [add(origin,offset),sub(origin,offset)].some(p=>contains(a,p)&&contains(b,p)&&forbidden(p));
}
export function directedConnection(a,b,arcs){return arcs.find(arc=>distance(a,arc.a)<1e-6&&distance(b,arc.b)<1e-6)??null;}
export function legal(arc,arcs){return !!arc&&!directedConnection(arc.a,arc.b,arcs)&&!arcs.some(other=>conflicts(arc,other));}
export function hasLegalContinuation(nodes,arcs){
  if(!arcs.length)return true;
  const last=arcs.at(-1),t=endTangent(last);
  return nodes.some(node=>legal(tangentArc(last.b,node,t),arcs));
}
export function randomNodes(count,random=Math.random){
  return Array.from({length:count},(_,id)=>{
    const y=2*random()-1,angle=TAU*random(),r=Math.sqrt(1-y*y);
    return {id,x:r*Math.cos(angle),y,z:r*Math.sin(angle)};
  });
}
export function easeNodes(nodes){
  const radius=Math.sqrt(4*Math.PI/nodes.length)*1.2,grid=new Map();
  const key=(x,y,z)=>`${x},${y},${z}`;
  for(const p of nodes){const k=key(Math.floor(p.x/radius),Math.floor(p.y/radius),Math.floor(p.z/radius));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(p);}
  return nodes.map(p=>{
    let force={x:0,y:0,z:0};const gx=Math.floor(p.x/radius),gy=Math.floor(p.y/radius),gz=Math.floor(p.z/radius);
    for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(let z=gz-1;z<=gz+1;z++)for(const q of grid.get(key(x,y,z))||[]){
      if(p===q)continue;const d=distance(p,q);
      if(d>1e-10&&d<radius)force=add(force,mul(sub(p,q),(radius-d)*.22/d));
    }
    force=sub(force,mul(p,dot(force,p)));
    const magnitude=length(force);if(magnitude>radius*.3)force=mul(force,radius*.3/magnitude);
    return {...unit(add(p,force)),id:p.id};
  });
}
