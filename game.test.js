import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as geometry from './geometry.js';

test('game over preserves the finished board for undo and permits a new game',async()=>{
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{value:id==='count'?'50':'0',min:'0',max:'2000',step:'1',hidden:false,disabled:false,style:{},listeners:{},textContent:'',setAttribute(){},addEventListener(type,handler){this.listeners[type]=handler;}});
    return elements.get(id);
  };
  const canvas=element('board');
  Object.assign(canvas,{clientWidth:800,clientHeight:600,parentElement:{},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),getContext:()=>new Proxy({},{get:()=>()=>{}})});
  const classes=new Set(),document={getElementById:element,body:{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}},listeners:{},addEventListener(type,handler){this.listeners[type]=handler;}};
  const context=vm.createContext({...geometry,document,window:{devicePixelRatio:1,addEventListener(){}},ResizeObserver:class{observe(){}},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame:callback=>callback()});
  const source=(await readFile(new URL('./game.js',import.meta.url),'utf8')).replace(/^import .*\n/,'');
  vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  run('playing=true;nodes=[{x:100,y:100},{x:200,y:100}];start=nodes[0];');
  canvas.listeners.pointermove({clientX:200,clientY:100});
  assert.equal(run('preview?.b===nodes[1]'),true);
  assert.equal(run('end'),null); // Hover must not lock the second endpoint.
  canvas.listeners.pointerleave();
  assert.equal(run('preview'),null);
  run(`playing=true;nodes=[{x:0,y:0},{x:100,y:0},{x:200,y:100}];
    arcs=[makeArc({x:150,y:-100},{x:150,y:200},0)];
    preview=makeArc(nodes[0],nodes[1],0);commit();`);
  assert.equal(run('gameOver'),true);
  assert.equal(element('setup').hidden,false);
  assert.equal(element('game-over').hidden,false);
  assert.ok(classes.has('game-over'));
  canvas.listeners.pointermove({clientX:200,clientY:100});
  assert.equal(run('preview?.b===nodes[2]'),true);
  assert.equal(run('invalid'),true);
  canvas.listeners.click({clientX:200,clientY:100});
  assert.equal(run('arcs.length'),2); // Game-over previews cannot place a connection.
  // Slider preview replaces the field, but must retain the finished game's undo history.
  element('count').listeners.input();
  assert.equal(run('arcs.length'),0);
  let prevented=false;
  document.listeners.contextmenu({preventDefault(){prevented=true;}});
  assert.ok(prevented);
  assert.equal(run('gameOver'),false);
  assert.equal(run('playing'),true);
  assert.equal(run('nodes.length'),3);
  assert.equal(run('arcs.length'),1);
  assert.equal(run('start===arcs.at(-1).b'),true);
  assert.equal(element('setup').hidden,true);
  assert.ok(!classes.has('game-over'));
  // Enter the dead end again and start a fresh board instead of undoing.
  run('preview=makeArc(nodes[0],nodes[1],0);commit();');
  assert.equal(run('gameOver'),true);
  await element('start').onclick();
  assert.equal(run('gameOver'),false);
  assert.equal(run('playing'),true);
  assert.equal(run('arcs.length'),0);
  assert.equal(run('nodes.length'),50);
  assert.equal(run('finishedGame'),null);
  const worldBefore=run('[(300-ox)/scale,(200-oy)/scale]');
  canvas.listeners.wheel({clientX:300,clientY:200,deltaY:-300,deltaMode:0,preventDefault(){}});
  assert.ok(run('zoom>1'));
  const worldAfter=run('[(300-ox)/scale,(200-oy)/scale]');
  assert.ok(Math.abs(worldBefore[0]-worldAfter[0])<1e-8);
  assert.ok(Math.abs(worldBefore[1]-worldAfter[1])<1e-8);
  canvas.setPointerCapture=()=>{};
  canvas.hasPointerCapture=()=>true;
  canvas.releasePointerCapture=()=>{};
  const previousX=run('ox'),previousY=run('oy');
  canvas.listeners.pointerdown({button:1,pointerId:1,clientX:300,clientY:200,preventDefault(){}});
  canvas.listeners.pointermove({pointerId:1,clientX:350,clientY:230});
  assert.equal(run('ox'),previousX+50);
  assert.equal(run('oy'),previousY+30);
  assert.equal(run('arcs.length'),0);
  canvas.listeners.pointerup({pointerId:1});
  assert.equal(run('panDrag'),null);
});
