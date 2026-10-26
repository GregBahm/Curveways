import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {pointOnArc} from './sphere-geometry.js';

test('camera zoom, trackball rotation, and occluded-node picking use consistent coordinates',async()=>{
  let renderedCamera;
  class Renderer{
    setPixelRatio(){}setClearColor(){}setSize(){}
    render(scene,camera){scene.updateMatrixWorld(true);renderedCamera=camera;}
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
  view.reset();
  view.beginRotate({clientX:400,clientY:300});view.rotate({clientX:500,clientY:300});view.endRotate();
  assert.equal(view.pick({clientX:500,clientY:300},nodes),front);
  const saved=view.snapshot();assert.ok(Math.abs(saved.rotation[1])>.1);
  view.reset();view.restore(saved);
  assert.equal(view.pick({clientX:500,clientY:300},nodes),front);
  assert.equal(renderedCamera.isOrthographicCamera,true);
});
