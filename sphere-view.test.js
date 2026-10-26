import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {pointOnArc,greatArc} from './sphere-geometry.js';

test('camera zoom, trackball rotation, and occluded-node picking use consistent coordinates',async()=>{
  let renderedCamera,renderedScene;
  class Renderer{
    setPixelRatio(){}setClearColor(){}setSize(){}
    render(scene,camera){scene.updateMatrixWorld(true);renderedCamera=camera;renderedScene=scene;}
  }
  const canvas={parentElement:{},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})};
  const context=vm.createContext({THREE:{...THREE,WebGLRenderer:Renderer},pointOnArc,window:{devicePixelRatio:1},ResizeObserver:class{observe(){}},canvas});
  const source=(await readFile(new URL('./sphere-view.js',import.meta.url),'utf8')).replace(/^import .*\n/gm,'').replace('export function','function');
  vm.runInContext(source,context);
  const view=vm.runInContext('createSphereView(canvas)',context);
  const front={x:0,y:0,z:1},back={x:0,y:0,z:-1},nodes=[back,front];
  view.render({nodes,arcs:[],start:null,end:null,hover:null,preview:null,invalid:false});
  assert.equal(view.pick({clientX:400,clientY:300},nodes),front);
  assert.equal(view.pick({clientX:400,clientY:300},[back]),null);
  assert.ok(view.surfacePoint({clientX:400,clientY:300}).distanceTo(new THREE.Vector3(0,0,1))<1e-10);
  const before=view.surfacePoint({clientX:450,clientY:320});
  view.zoomAt({clientX:450,clientY:320,deltaY:-100,deltaMode:0});
  const after=view.surfacePoint({clientX:450,clientY:320});
  assert.ok(before.distanceTo(after)<1e-10);
  assert.ok(view.snapshot().zoom>1);
  const orientation=view.snapshot().rotation;
  const position=frontVector=>new THREE.Vector3(frontVector.x,frontVector.y,frontVector.z).project(renderedCamera);
  const screenBefore=position(front);
  view.pan(60,35);
  const screenAfter=position(front);
  assert.ok(Math.abs((screenAfter.x-screenBefore.x)*400-60)<1e-9);
  assert.ok(Math.abs(-(screenAfter.y-screenBefore.y)*300-35)<1e-9);
  assert.deepEqual(view.snapshot().rotation,orientation);
  assert.equal(view.pick({clientX:(screenAfter.x+1)*400,clientY:(1-screenAfter.y)*300},nodes),front);
  view.reset();
  view.beginRotate({clientX:400,clientY:300});view.rotate({clientX:500,clientY:300});view.endRotate();
  assert.equal(view.pick({clientX:500,clientY:300},nodes),front);
  const saved=view.snapshot();assert.ok(Math.abs(saved.rotation[1])>.1);
  view.reset();view.restore(saved);
  assert.equal(view.pick({clientX:500,clientY:300},nodes),front);
  assert.equal(renderedCamera.isOrthographicCamera,true);
  const a={x:1,y:0,z:0},b={x:0,y:1,z:0},c={x:0,y:0,z:1},first=greatArc(a,b),second=greatArc(b,c);
  const state={nodes,arcs:[first],start:null,end:null,hover:null,preview:null,invalid:false};
  view.render(state);
  const paths=()=>renderedScene.children.find(child=>child.isGroup).children.filter(child=>child.material?.vertexColors);
  const colorAt=(mesh,last=false)=>{const attr=mesh.geometry.getAttribute('color'),i=last?attr.count-1:0;return [attr.getX(i),attr.getY(i),attr.getZ(i)];};
  const mesh=paths()[0],cold=colorAt(mesh),hot=colorAt(mesh,true);
  assert.ok(cold[2]>cold[0]);assert.ok(hot[1]>hot[0]&&hot[2]>hot[0]);
  assert.ok(hot[1]+hot[2]>cold[1]+cold[2]);
  state.arcs.push(second);view.render(state);
  const join=colorAt(mesh,true),nextStart=colorAt(paths()[1]);
  assert.deepEqual(join,nextStart); // No color seam at a connection.
  assert.notDeepEqual(join,hot); // Existing segments recolor when the chain grows.
  assert.deepEqual(colorAt(paths()[1],true),hot);
  state.arcs.pop();view.render(state);
  assert.deepEqual(colorAt(mesh,true),hot); // Undo redistributes the full gradient too.
  const normalMaterial=mesh.material;
  state.blockedArc=first;view.render(state);
  assert.ok(mesh.material.color.r>mesh.material.color.b);
  assert.equal(mesh.material.vertexColors,false);
  state.blockedArc=null;view.render(state);
  assert.equal(mesh.material,normalMaterial);
  assert.deepEqual(colorAt(mesh,true),hot);
});
