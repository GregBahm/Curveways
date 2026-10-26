import test from 'node:test';
import assert from 'node:assert/strict';
import { makeArc, conflicts, distance, endTangent, tangentArc, hasLegalContinuation, isLegalConnection } from './geometry.js';
const p=(x,y)=>({x,y});
test('used nodes can be revisited along a non-overlapping arc',()=>{
  const a=p(0,0),b=p(100,0),first=makeArc(a,b,50);
  const returning=tangentArc(b,a,endTangent(first));
  assert.equal(conflicts(returning,first),false);
  assert.equal(isLegalConnection(returning,[first]),true);
  assert.equal(hasLegalContinuation([a,b],[first]),true);
  assert.equal(isLegalConnection(makeArc(b,p(200,0),50),[first]),true);
});
test('retracing an arc in either direction counts as overlap',()=>{
  const a=p(0,0),b=p(100,0),first=makeArc(a,b,50);
  assert.ok(conflicts(first,makeArc(a,b,50)));
  assert.ok(conflicts(first,makeArc(b,a,-50)));
  assert.ok(conflicts(makeArc(a,b,0),makeArc(b,a,0)));
  assert.equal(isLegalConnection(makeArc(b,a,-50),[first]),false);
});
test('connections can cross at a shared node but not away from it',()=>{
  const junction=p(100,100);
  const existing=[makeArc(p(0,100),junction,0),makeArc(junction,p(200,100),0)];
  assert.ok(isLegalConnection(makeArc(p(100,0),junction,0),existing));
  assert.ok(isLegalConnection(makeArc(junction,p(100,200),0),existing));
  assert.equal(isLegalConnection(makeArc(p(50,0),p(50,200),0),existing),false);
});
test('legal move search detects an intersection-blocked field',()=>{
  const a=p(0,0),b=p(100,0),target=p(200,100),last=makeArc(a,b,0);
  assert.ok(hasLegalContinuation([a,b,target],[last]));
  const blocker=makeArc(p(150,-100),p(150,200),0);
  assert.equal(hasLegalContinuation([a,b,target],[blocker,last]),false);
  assert.equal(hasLegalContinuation([a,b],[last]),false);
  assert.ok(hasLegalContinuation([a,b],[]));
});
test('continuations preserve tangent direction and land on the chosen node',()=>{
  for(const bend of [-70,0,25,150]){
    const previous=makeArc(p(0,0),p(100,0),bend),t=endTangent(previous);
    for(const target of [p(170,80),p(200,-90),p(50,120)]){
      const next=tangentArc(previous.b,target,t);
      assert.ok(next);
      assert.ok(Math.abs(distance(next.c,target)-next.r)<1e-8);
      const direction=next.ccw?-1:1;
      assert.ok(Math.abs(-Math.sin(next.start)*direction-t.x)<1e-8);
      assert.ok(Math.abs(Math.cos(next.start)*direction-t.y)<1e-8);
    }
  }
});
test('straight continuations travel forward and cannot reverse or stay put',()=>{
  assert.ok(tangentArc(p(0,0),p(100,0),p(1,0)).line);
  assert.equal(tangentArc(p(0,0),p(-100,0),p(1,0)),null);
  assert.equal(tangentArc(p(0,0),p(0,0),p(1,0)),null);
});
test('circular arc passes through endpoints and sagitta midpoint',()=>{for(const s of [-200,-20,20,200]){const a=makeArc(p(0,0),p(100,0),s);assert.ok(Math.abs(distance(a.c,a.a)-a.r)<1e-8);assert.ok(Math.abs(distance(a.c,a.b)-a.r)<1e-8);assert.ok(Math.abs(distance(a.c,p(50,s))-a.r)<1e-8);}});
test('crossing lines are rejected, shared endpoints allowed',()=>{const a=makeArc(p(0,0),p(100,0),0);assert.ok(conflicts(a,makeArc(p(50,-50),p(50,50),0)));assert.ok(!conflicts(a,makeArc(p(100,0),p(120,20),0)));assert.ok(conflicts(a,makeArc(p(50,0),p(150,0),0)));});
test('line-circle crossings and tangencies are rejected',()=>{const a=makeArc(p(0,0),p(100,0),50);assert.ok(conflicts(a,makeArc(p(50,25),p(50,75),0)));assert.ok(conflicts(a,makeArc(p(25,50),p(75,50),0)));assert.ok(!conflicts(a,makeArc(p(50,-75),p(50,-25),0)));});
test('coincident arcs reject overlap but allow opposite semicircles',()=>{const a=makeArc(p(0,0),p(100,0),50);assert.ok(conflicts(a,makeArc(p(0,0),p(100,0),50)));assert.ok(!conflicts(a,makeArc(p(0,0),p(100,0),-50)));});
test('circle-circle intersections use finite sweeps',()=>{const a=makeArc(p(0,0),p(100,0),50);assert.ok(conflicts(a,makeArc(p(50,0),p(150,0),50)));assert.ok(!conflicts(a,makeArc(p(150,0),p(250,0),50)));assert.ok(!conflicts(a,makeArc(p(100,0),p(200,0),50)));});
