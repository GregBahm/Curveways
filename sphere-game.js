import {greatArc,throughArc,tangentArc,endTangent,legal,hasLegalContinuation,randomNodes,easeNodes,distance,directedConnection} from './sphere-geometry.js';
import {createSphereView} from './sphere-view.js';

const $=id=>document.getElementById(id),canvas=$('board');
let view;
try{view=createSphereView(canvas);}catch(error){
  $('setup').insertAdjacentHTML('afterbegin','<p>This game requires WebGL. Enable hardware acceleration in your browser and reload.</p>');
  console.error(error);throw error;
}
let nodes=[],arcs=[],start=null,end=null,hover=null,preview=null,invalid=false,blockedArc=null;
let playing=false,gameOver=false,finishedGame=null,generation=0,rotating=null,seed=Math.floor(Math.random()*4294967296);
let rotationGesture=null;
function draw(){view.render({nodes,arcs,start,end,hover,preview,invalid,blockedArc});}
function message(text){canvas.setAttribute('aria-description',text);}
function over(value){gameOver=value;document.body.classList.toggle('game-over',value);$('game-over').hidden=!value;$('setup').hidden=!value;}
function cancel(){start=arcs.at(-1)?.b??null;end=preview=hover=blockedArc=null;invalid=false;draw();}
function commit(){
  if(!preview||invalid)return;
  arcs.push(preview);cancel();
  if(!hasLegalContinuation(nodes,arcs)){
    finishedGame={nodes,arcs:[...arcs],camera:view.snapshot()};playing=false;over(true);
    message('Game over. No legal moves remain. Right-click to undo or start a new game.');
  }
}
function updatePointer(event){
  if(!playing&&!gameOver)return;
  hover=view.pick(event,nodes);
  blockedArc=null;
  if(arcs.length){
    end=hover&&hover!==start?hover:null;
    const arc=end?tangentArc(start,end,endTangent(arcs.at(-1))):null;
    preview=arc||(end?greatArc(start,end):null);invalid=!!end&&!legal(arc,arcs);
    blockedArc=end?directedConnection(start,end,arcs):null;
    if(blockedArc)preview=null;
  }else if(start&&end){
    const point=view.surfacePoint(event);
    preview=point&&distance(point,start)>.001&&distance(point,end)>.001?throughArc(start,end,point):preview||greatArc(start,end);
    invalid=!legal(preview,arcs);
  }else{
    preview=start&&hover&&hover!==start?greatArc(start,hover):null;invalid=false;
  }
  canvas.style.cursor=hover||end?'pointer':'crosshair';draw();
}
canvas.addEventListener('pointermove',event=>{
  if(rotating!==null){
    if(event.pointerId===rotating){
      if(rotationGesture.button===1){
        view.pan(event.clientX-rotationGesture.x,event.clientY-rotationGesture.y);
        rotationGesture.x=event.clientX;rotationGesture.y=event.clientY;
      }else{
        if(Math.hypot(event.clientX-rotationGesture.x,event.clientY-rotationGesture.y)>4)rotationGesture.dragged=true;
        if(rotationGesture.dragged)view.rotate(event);
      }
    }
    return;
  }
  updatePointer(event);
});
canvas.addEventListener('pointerleave',()=>{if(rotating!==null)return;hover=blockedArc=null;if(arcs.length){end=preview=null;}else if(!end)preview=null;draw();});
canvas.addEventListener('click',event=>{
  if(!playing||rotating!==null||event.button!==0)return;
  updatePointer(event);
  if(arcs.length){commit();return;}
  if(start&&end){commit();return;}
  if(!hover)return;
  if(!start){start=hover;message('Choose another node, then move to shape the first arc.');}
  else if(hover!==start){end=hover;preview=greatArc(start,end);}
  draw();
});
canvas.addEventListener('pointerdown',event=>{
  if((event.button!==1&&event.button!==2)||rotating!==null)return;
  event.preventDefault();rotating=event.pointerId;
  rotationGesture={button:event.button,x:event.clientX,y:event.clientY,dragged:false};
  canvas.setPointerCapture(rotating);if(event.button===2)view.beginRotate(event);canvas.style.cursor='grabbing';
});
function stopRotation(event,canceled=false){
  if(rotating!==event.pointerId)return;
  const click=rotationGesture.button===2&&!rotationGesture.dragged&&Math.hypot(event.clientX-rotationGesture.x,event.clientY-rotationGesture.y)<=4;
  rotating=null;rotationGesture=null;view.endRotate();if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);canvas.style.cursor='crosshair';
  if(!canceled&&click&&(playing||gameOver))undo();
}
canvas.addEventListener('pointerup',stopRotation);canvas.addEventListener('pointercancel',event=>stopRotation(event,true));
canvas.addEventListener('lostpointercapture',()=>{rotating=null;rotationGesture=null;view.endRotate();canvas.style.cursor='crosshair';});
canvas.addEventListener('auxclick',event=>{if(event.button===1)event.preventDefault();});
canvas.addEventListener('wheel',event=>{event.preventDefault();if(rotating!==null)return;view.zoomAt(event);updatePointer(event);},{passive:false});
function undo(){
  if(gameOver&&finishedGame){
    ++generation;nodes=finishedGame.nodes;arcs=finishedGame.arcs;view.restore(finishedGame.camera);finishedGame=null;over(false);playing=true;$('start').disabled=false;
  }
  if(arcs.length){arcs.pop();cancel();}else if(playing)cancel();
}
document.addEventListener('contextmenu',event=>{
  event.preventDefault();
  // Canvas right-clicks undo on release, after distinguishing a click from a drag.
  if(event.target!==canvas&&rotating===null&&(playing||gameOver))undo();
});
window.addEventListener('keydown',event=>{
  if(event.key==='Escape')cancel();
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo();}
});
for(const id of ['count','easing']){
  const input=$(id),key=`orbit.board.${id}`;
  try{const saved=localStorage.getItem(key),value=Number(saved);if(saved!==null&&saved.trim()!==''&&Number.isFinite(value)){const min=Number(input.min),max=Number(input.max),step=Number(input.step)||1;input.value=String(Math.max(min,Math.min(max,min+Math.round((value-min)/step)*step)));}}catch{}
  $(`${id}-value`).textContent=Number(input.value).toLocaleString();
  input.addEventListener('input',()=>{
    if(playing)return;$(`${id}-value`).textContent=Number(input.value).toLocaleString();
    try{localStorage.setItem(key,input.value);}catch{}
    generate();
  });
}
async function generate(){
  const token=++generation,count=Number($('count').value),passes=Number($('easing').value);
  $('start').disabled=true;arcs=[];cancel();
  let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  nodes=randomNodes(count,random);view.reset();draw();
  for(let pass=0;pass<passes;pass++){
    nodes=easeNodes(nodes);
    if(pass%3===0){draw();await new Promise(requestAnimationFrame);if(token!==generation)return;}
  }
  draw();$('start').disabled=false;
}
$('start').onclick=async()=>{
  if($('start').disabled)return;
  if(gameOver){finishedGame=null;over(false);seed=Math.floor(Math.random()*4294967296);await generate();}
  playing=true;$('setup').hidden=true;message('Choose a starting node. Middle-drag pans, right-drag rotates, and the scroll wheel zooms.');
};
generate();
