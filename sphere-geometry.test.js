import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from './sphere-geometry.js';
const p=(x,y,z)=>g.unit({x,y,z});
test('spherical random fields and easing remain on the surface',()=>{
  let nodes=g.randomNodes(1000);
  for(let i=0;i<12;i++)nodes=g.easeNodes(nodes);
  assert.ok(nodes.every(node=>Math.abs(g.length(node)-1)<1e-12));
  assert.ok(nodes.some(node=>node.y<-.5)&&nodes.some(node=>node.y>.5));
});
test('arcs lie on the sphere and their supporting circle',()=>{
  const a=p(1,0,0),b=p(0,1,0),mid=p(1,1,.8),arc=g.throughArc(a,b,mid);
  assert.ok(g.distance(g.pointOnArc(arc,0),a)<1e-10);
  assert.ok(g.distance(g.pointOnArc(arc,1),b)<1e-10);
  for(let i=0;i<=100;i++){
    const point=g.pointOnArc(arc,i/100);
    assert.ok(Math.abs(g.length(point)-1)<1e-10);
    assert.ok(Math.abs(g.dot(point,arc.n)-arc.d)<1e-10);
  }
});
test('continuations preserve the directed surface tangent',()=>{
  for(let i=0;i<100;i++){
    const [a,b,c]=g.randomNodes(3),first=g.greatArc(a,b),t=g.endTangent(first),next=g.tangentArc(b,c,t);
    assert.ok(next);
    assert.ok(g.distance(g.unit(g.cross(next.n,g.sub(b,next.c))),t)<1e-9);
    assert.ok(g.distance(g.pointOnArc(next,1),c)<1e-8);
    assert.equal(g.conflicts(first,next),false);
  }
});
test('shared junctions are legal, crossings and retracing are blocked',()=>{
  const a=p(1,0,0),b=p(0,1,0),first=g.greatArc(a,b);
  assert.equal(g.conflicts(first,g.greatArc(b,p(-1,0,0))),false);
  assert.equal(g.conflicts(first,g.greatArc(b,a)),true);
  assert.equal(g.conflicts(first,g.greatArc(p(1,1,1),p(1,1,-1))),true);
  assert.equal(g.conflicts(first,g.greatArc(p(-1,-1,1),p(-1,-1,-1))),false);
});
