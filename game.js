import {makeArc, conflicts, distance, endTangent, tangentArc, hasLegalContinuation, isLegalConnection} from './geometry.js';
const $=id=>document.getElementById(id),canvas=$('board'),ctx=canvas.getContext('2d');
let nodes=[],arcs=[],start=null,end=null,hover=null,preview=null,invalid=false,pointer=null;
let width=1000,height=700,boardWidth=1000,boardHeight=700,scale=1,ox=0,oy=0,generation=0;
let zoom=1,panX=0,panY=0,panDrag=null;
function updateView(){scale=Math.min(width/boardWidth,height/boardHeight)*zoom;ox=(width-boardWidth*scale)/2+panX;oy=(height-boardHeight*scale)/2+panY;}
let playing=false;
let gameOver=false,finishedGame=null;
let seed=Math.floor(Math.random()*4294967296);
function showGameOver(value){
  gameOver=value;
  document.body.classList.toggle('game-over',value);
  $('game-over').hidden=!value;
  $('setup').hidden=!value;
}
function resize(){const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;width=rect.width;height=rect.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);updateView();draw();}
new ResizeObserver(resize).observe(canvas.parentElement);
function message(text){canvas.setAttribute('aria-description',text);}
function cancel(){start=arcs.at(-1)?.b??null;end=preview=null;invalid=false;message(start?'Choose the next node to continue.':'Choose any node to begin.');draw();}
function commit(){
  arcs.push(preview);cancel();
  if(!hasLegalContinuation(nodes,arcs)){
    finishedGame={nodes,arcs:[...arcs],boardWidth,boardHeight,zoom,panX,panY};
    playing=false;hover=null;showGameOver(true);draw();
    message('Game over. No legal connections remain. Start a new game or undo.');
  }
}
function strokeArc(arc,color,lineWidth=1.7){ctx.beginPath();if(arc.line){ctx.moveTo(arc.a.x,arc.a.y);ctx.lineTo(arc.b.x,arc.b.y);}else ctx.arc(arc.c.x,arc.c.y,arc.r,arc.start,arc.end,arc.ccw);ctx.strokeStyle=color;ctx.lineWidth=lineWidth/scale;ctx.stroke();}
function dot(p,r,color){ctx.beginPath();ctx.arc(p.x,p.y,r/scale,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function draw(){ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
  for(const arc of arcs)strokeArc(arc,'#58866b');
  if(preview)strokeArc(preview,invalid?'#d36c63':'#3d8264',2);
  const selected=new Set(arcs.flatMap(arc=>[arc.a,arc.b]));
  if(start)selected.add(start);
  if(end)selected.add(end);
  for(const p of nodes)dot(p,selected.has(p)?2.65:1.65,'#809479');
  for(const p of [hover,start,end].filter(Boolean)){dot(p,8,'#5d866122');dot(p,3.4,p===end&&invalid?'#cf6d62':'#35694d');}
  if(preview&&pointer&&!arcs.length){dot(pointer,3,invalid?'#cf6d62':'#5d8d70');}
  ctx.restore();
}
function updatePointer(event){if(!playing&&!gameOver)return;const rect=canvas.getBoundingClientRect();pointer={x:(event.clientX-rect.left-ox)/scale,y:(event.clientY-rect.top-oy)/scale};let best=13/scale;hover=null;for(const p of nodes){const d=distance(pointer,p);if(d<best){best=d;hover=p;}}
  if(arcs.length){
    end=hover&&hover!==start?hover:null;
    const candidate=end?tangentArc(start,end,endTangent(arcs.at(-1))):null;
    preview=candidate||(end?makeArc(start,end,0):null);
    invalid=!!end&&!isLegalConnection(candidate,arcs);
    message(invalid?'That connection overlaps, crosses away from a node, or cannot continue smoothly. Choose another node.':'Choose the next node to continue.');
  }else if(start&&end){const length=distance(start,end),nx=-(end.y-start.y)/length,ny=(end.x-start.x)/length;let sag=(pointer.x-(start.x+end.x)/2)*nx+(pointer.y-(start.y+end.y)/2)*ny;sag=Math.max(-length*1.5,Math.min(length*1.5,sag));preview=makeArc(start,end,sag);invalid=arcs.some(a=>conflicts(preview,a));message(invalid?'That arc crosses a connection. Adjust the curve.':'Move to shape the arc. Click to connect.',invalid);}
  if(start&&!end&&!arcs.length){
    preview=hover&&hover!==start?makeArc(start,hover,0):null;
    invalid=false;
  }
  canvas.style.cursor=hover||end?'pointer':'crosshair';draw();
}
canvas.addEventListener('wheel',event=>{
  event.preventDefault();
  if(panDrag)return;
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  const worldX=(x-ox)/scale,worldY=(y-oy)/scale;
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?height:1);
  zoom=Math.max(.2,Math.min(12,zoom*Math.exp(-delta*.0015)));
  updateView();panX+=x-(worldX*scale+ox);panY+=y-(worldY*scale+oy);updateView();
  updatePointer(event);draw();
},{passive:false});
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==1)return;
  event.preventDefault();panDrag={id:event.pointerId,x:event.clientX,y:event.clientY};
  canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';
});
canvas.addEventListener('pointermove',event=>{
  if(!panDrag){updatePointer(event);return;}
  if(event.pointerId!==panDrag.id)return;
  panX+=event.clientX-panDrag.x;panY+=event.clientY-panDrag.y;
  panDrag.x=event.clientX;panDrag.y=event.clientY;updateView();draw();
});
function stopPan(event){
  if(!panDrag||event.pointerId!==panDrag.id)return;
  panDrag=null;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  canvas.style.cursor='crosshair';
}
canvas.addEventListener('pointerup',stopPan);
canvas.addEventListener('pointercancel',stopPan);
canvas.addEventListener('lostpointercapture',()=>{panDrag=null;canvas.style.cursor='crosshair';});
canvas.addEventListener('auxclick',event=>{if(event.button===1)event.preventDefault();});
canvas.addEventListener('pointerleave',()=>{hover=null;if(arcs.length){end=preview=null;}else if(!end){preview=null;}draw();});
canvas.addEventListener('click',event=>{if(!playing||panDrag||(event.button!==undefined&&event.button!==0))return;updatePointer(event);if(arcs.length){if(preview&&!invalid)commit();return;}if(start&&end){if(invalid)return;commit();return;}if(!hover)return;if(!start){start=hover;message('Choose another node to connect.');}else if(hover!==start){end=hover;updatePointer(event);}draw();});
function undo(){
  if(gameOver&&finishedGame){
    ++generation;
    ({nodes,arcs,boardWidth,boardHeight,zoom,panX,panY}=finishedGame);
    finishedGame=null;showGameOver(false);playing=true;$('start').disabled=false;resize();
  }
  if(arcs.length){arcs.pop();cancel();}
}
document.addEventListener('contextmenu',event=>{event.preventDefault();if(playing||gameOver)undo();});
window.addEventListener('keydown',event=>{if(event.key==='Escape')cancel();if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo();}});
for(const id of ['count','easing']){
  const input=$(id),storageKey=`orbit.board.${id}`;
  try {
    const saved=localStorage.getItem(storageKey),value=Number(saved);
    if(saved!==null&&saved.trim()!==''&&Number.isFinite(value)){
      const min=Number(input.min),max=Number(input.max),step=Number(input.step)||1;
      input.value=String(Math.max(min,Math.min(max,min+Math.round((value-min)/step)*step)));
    }
  } catch { /* Keep defaults when browser storage is unavailable. */ }
  $(`${id}-value`).textContent=Number(input.value).toLocaleString();
  input.addEventListener('input',()=>{
    if(playing)return;
    $(`${id}-value`).textContent=Number(input.value).toLocaleString();
    try { localStorage.setItem(storageKey,input.value); } catch { /* Preview still works without storage. */ }
    generate();
  });
}
async function generate(){if(playing)return;const token=++generation;const count=Number($('count').value),passes=Number($('easing').value);$('start').disabled=true;arcs=[];hover=null;cancel();message('Settling the field…');boardWidth=Math.max(500,canvas.clientWidth);boardHeight=Math.max(400,canvas.clientHeight);
  // Reuse the initial random field so easing adjustments visibly change spacing.
  zoom=1;panX=panY=0;
  let state=seed;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  nodes=Array.from({length:count},(_,id)=>({id,x:24+random()*(boardWidth-48),y:24+random()*(boardHeight-48)}));resize();
  const radius=Math.sqrt((boardWidth-48)*(boardHeight-48)/count)*1.15;
  for(let pass=0;pass<passes;pass++){
    const grid=new Map(),key=(x,y)=>`${x},${y}`;
    for(const p of nodes){const k=key(Math.floor(p.x/radius),Math.floor(p.y/radius));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(p);}
    const next=nodes.map(p=>{let dx=0,dy=0;const gx=Math.floor(p.x/radius),gy=Math.floor(p.y/radius);for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const q of grid.get(key(x,y))||[]){if(p===q)continue;let vx=p.x-q.x,vy=p.y-q.y,d=Math.hypot(vx,vy);if(d<1e-8){vx=.01*(p.id>q.id?1:-1);vy=.01;d=Math.hypot(vx,vy);}if(d<radius){const force=(radius-d)*.22;dx+=vx/d*force;dy+=vy/d*force;}}const magnitude=Math.hypot(dx,dy),limit=radius*.3,factor=magnitude>limit?limit/magnitude:1;return {...p,x:Math.max(24,Math.min(boardWidth-24,p.x+dx*factor)),y:Math.max(24,Math.min(boardHeight-24,p.y+dy*factor))};});nodes=next;
    if(pass%3===0){draw();await new Promise(requestAnimationFrame);if(token!==generation)return;}
  }
  $('start').disabled=false;message('Choose any node to begin.');draw();
}
$('start').onclick=async()=>{
  if($('start').disabled)return;
  if(gameOver){
    finishedGame=null;showGameOver(false);seed=Math.floor(Math.random()*4294967296);
    await generate();
  }
  playing=true;$('setup').hidden=true;canvas.style.cursor='crosshair';message('Choose any node to begin.');
};
generate();
