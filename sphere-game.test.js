import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as geometry from './sphere-geometry.js';

test('sphere controls, previews, undo, and restart preserve game state',async()=>{
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{value:id==='count'?'50':'0',min:'0',max:'2000',step:'1',hidden:false,disabled:false,style:{},listeners:{},setAttribute(){},addEventListener(type,handler){this.listeners[type]=handler;},setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}});
    return elements.get(id);
  };
  const classes=new Set(),document={getElementById:element,body:{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}},listeners:{},addEventListener(type,handler){this.listeners[type]=handler;}};
  let lastState,rotationCount=0,zoomCount=0;
  const view={render(state){lastState=state;},pick:event=>event.node??null,surfacePoint:event=>event.surface??null,reset(){},snapshot:()=>({camera:'snapshot'}),restore(saved){assert.equal(saved.camera,'snapshot');},beginRotate(){rotationCount++;},rotate(){rotationCount++;},endRotate(){},zoomAt(){zoomCount++;}};
  const context=vm.createContext({...geometry,document,console,createSphereView:()=>view,window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame:callback=>callback()});
  const source=(await readFile(new URL('./sphere-game.js',import.meta.url),'utf8')).replace(/^import .*\n/gm,'');
  vm.runInContext(source,context);const run=code=>vm.runInContext(code,context),canvas=element('board');
  await element('start').onclick();
  const a={x:1,y:0,z:0},b={x:0,y:1,z:0},c={x:0,y:0,z:1};
  context.fixture=[a,b,c];run('nodes=fixture;');
  canvas.listeners.click({button:0,node:a});
  canvas.listeners.pointermove({node:b});assert.equal(lastState.preview.b,b);assert.equal(lastState.end,null);
  canvas.listeners.click({button:0,node:b});
  canvas.listeners.click({button:0,node:b});assert.equal(run('arcs.length'),1);
  canvas.listeners.pointermove({node:c});assert.equal(lastState.preview.b,c);assert.equal(lastState.invalid,false);
  canvas.listeners.click({button:0,node:c});assert.equal(run('arcs.length'),2);
  canvas.listeners.pointerdown({button:1,pointerId:5,preventDefault(){}});
  canvas.listeners.pointermove({pointerId:5,node:a});assert.equal(rotationCount,2);
  canvas.listeners.click({button:0,node:a});assert.equal(run('arcs.length'),2);
  canvas.listeners.pointerup({pointerId:5});
  canvas.listeners.wheel({preventDefault(){}});assert.equal(zoomCount,1);
  document.listeners.contextmenu({preventDefault(){}});assert.equal(run('arcs.length'),1);
  assert.equal(run('start'),b);
  // Build a closed set of two nodes whose complete circle is already traced.
  run('nodes=[fixture[0],fixture[1]];arcs=[greatArc(nodes[0],nodes[1])];preview=tangentArc(nodes[1],nodes[0],endTangent(arcs[0]));commit();');
  assert.equal(run('gameOver'),true);assert.ok(classes.has('game-over'));
  canvas.listeners.pointermove({node:b});assert.equal(lastState.invalid,true);
  canvas.listeners.click({button:0,node:b});assert.equal(run('arcs.length'),2);
  element('count').listeners.input();assert.equal(run('arcs.length'),0);
  document.listeners.contextmenu({preventDefault(){}});assert.equal(run('arcs.length'),1);assert.equal(run('nodes.length'),2);
  assert.equal(run('gameOver'),false);assert.equal(element('setup').hidden,true);
  run('preview=tangentArc(arcs[0].b,arcs[0].a,endTangent(arcs[0]));commit();');
  assert.equal(run('gameOver'),true);
  await element('start').onclick();assert.equal(run('arcs.length'),0);assert.equal(run('nodes.length'),50);assert.equal(run('playing'),true);
});
