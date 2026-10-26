import * as THREE from '/three/three.module.js';
import {pointOnArc} from './sphere-geometry.js';

export function createSphereView(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setClearColor('#eeeeee');
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.1;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.5,1.5,1.5,-1.5,.1,20);
  camera.position.z=4;
  const globe=new THREE.Group();scene.add(globe);
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(.998,96,64),new THREE.MeshStandardMaterial({color:'#777777',roughness:.95,metalness:0})));
  scene.add(new THREE.HemisphereLight('#ffffff','#888888',2.5));
  const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(-3,5,5);scene.add(light);
  const nodeGeometry=new THREE.SphereGeometry(.0048,16,10),nodeMaterial=new THREE.MeshBasicMaterial({color:'#444444'});
  const arcMaterial=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}),validMaterial=new THREE.MeshBasicMaterial({color:'#555555'}),invalidMaterial=new THREE.MeshBasicMaterial({color:'#cb514b'});
  const heatColors=['#102878','#164cbd','#1489df','#14bce8','#28eaff'].map(color=>new THREE.Color(color));
  let coloredArcs=[];
  let nodeMesh=null,nodeCount=0,width=1,height=1,zoom=1,offsetX=0,offsetY=0;
  const arcMeshes=new Map(),dummy=new THREE.Object3D(),raycaster=new THREE.Raycaster();
  let previewMesh=null,previewArc=null,drag=null;
  let state={nodes:[],arcs:[],start:null,end:null,hover:null,preview:null,invalid:false};
  const vector=p=>new THREE.Vector3(p.x,p.y,p.z);
  function updateCamera(){const h=1.35/zoom,w=h*width/height;camera.left=-w;camera.right=w;camera.top=h;camera.bottom=-h;camera.position.set(offsetX,offsetY,4);camera.updateProjectionMatrix();camera.updateMatrixWorld();}
  function arcMesh(arc,material){
    class SurfaceCurve extends THREE.Curve{getPoint(t,target=new THREE.Vector3()){const p=pointOnArc(arc,t);return target.set(p.x,p.y,p.z).multiplyScalar(1.004);}}
    const segments=Math.max(24,Math.ceil(arc.sweep*arc.r*160));
    return new THREE.Mesh(new THREE.TubeGeometry(new SurfaceCurve(),segments,.0015,5,false),material);
  }
  function discard(mesh){globe.remove(mesh);mesh.geometry.dispose();}
  function updateGradient(){
    if(coloredArcs.length===state.arcs.length&&coloredArcs.every((arc,i)=>arc===state.arcs[i]))return;
    coloredArcs=[...state.arcs];
    const total=state.arcs.reduce((sum,arc)=>sum+arc.sweep*arc.r,0);
    let traveled=0;
    const color=new THREE.Color();
    for(const arc of state.arcs){
      const geometry=arcMeshes.get(arc).geometry,{tubularSegments,radialSegments}=geometry.parameters;
      const colors=new Float32Array(geometry.attributes.position.count*3),arcLength=arc.sweep*arc.r;
      for(let ring=0;ring<=tubularSegments;ring++){
        const progress=Math.min(1,(traveled+arcLength*ring/tubularSegments)/(total||1));
        const position=progress*(heatColors.length-1),stop=Math.min(heatColors.length-2,Math.floor(position));
        color.copy(heatColors[stop]).lerp(heatColors[stop+1],position-stop);
        for(let side=0;side<=radialSegments;side++)color.toArray(colors,(ring*(radialSegments+1)+side)*3);
      }
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
      traveled+=arcLength;
    }
  }
  function render(next=state){
    state=next;
    if(nodeCount!==state.nodes.length){
      if(nodeMesh){globe.remove(nodeMesh);nodeMesh.dispose();}
      nodeCount=state.nodes.length;nodeMesh=new THREE.InstancedMesh(nodeGeometry,nodeMaterial,nodeCount);nodeMesh.frustumCulled=false;globe.add(nodeMesh);
    }
    const selected=new Set(state.arcs.flatMap(arc=>[arc.a,arc.b]));
    if(state.start)selected.add(state.start);if(state.end)selected.add(state.end);
    state.nodes.forEach((p,i)=>{
      dummy.position.copy(vector(p).multiplyScalar(1.004));
      dummy.scale.setScalar(p===state.hover||p===state.start||p===state.end?2:selected.has(p)?1.5:1);
      dummy.updateMatrix();nodeMesh.setMatrixAt(i,dummy.matrix);
    });
    if(nodeMesh)nodeMesh.instanceMatrix.needsUpdate=true;
    const active=new Set(state.arcs);
    for(const [arc,mesh]of arcMeshes)if(!active.has(arc)){discard(mesh);arcMeshes.delete(arc);}
    for(const arc of state.arcs)if(!arcMeshes.has(arc)){const mesh=arcMesh(arc,arcMaterial);arcMeshes.set(arc,mesh);globe.add(mesh);}
    updateGradient();
    if(previewArc!==state.preview){
      if(previewMesh)discard(previewMesh);
      previewArc=state.preview;previewMesh=previewArc?arcMesh(previewArc,state.invalid?invalidMaterial:validMaterial):null;
      if(previewMesh)globe.add(previewMesh);
    }
    if(previewMesh)previewMesh.material=state.invalid?invalidMaterial:validMaterial;
    renderer.render(scene,camera);
  }
  function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;renderer.setSize(width,height,false);updateCamera();render();}
  new ResizeObserver(resize).observe(canvas.parentElement);resize();
  function ndc(event){const r=canvas.getBoundingClientRect();return new THREE.Vector2((event.clientX-r.left)/width*2-1,-(event.clientY-r.top)/height*2+1);}
  function surfacePoint(event){
    raycaster.setFromCamera(ndc(event),camera);
    const hit=raycaster.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(),1),new THREE.Vector3());
    return hit?hit.applyQuaternion(globe.quaternion.clone().invert()):null;
  }
  function pick(event,nodes){
    const mouse=ndc(event);let best=14,result=null;
    for(const p of nodes){
      const world=vector(p).applyQuaternion(globe.quaternion);
      if(world.z<.008)continue;
      const projected=world.project(camera),d=Math.hypot((projected.x-mouse.x)*width/2,(projected.y-mouse.y)*height/2);
      if(d<best){best=d;result=p;}
    }
    return result;
  }
  function zoomAt(event){
    const mouse=ndc(event),oldH=1.35/zoom,delta=Math.max(-240,Math.min(240,event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?height:1)));
    zoom=Math.max(.55,Math.min(10,zoom*Math.exp(-delta*.0015)));
    const newH=1.35/zoom;offsetX+=mouse.x*(oldH-newH)*width/height;offsetY+=mouse.y*(oldH-newH);
    updateCamera();render();
  }
  function pan(dx,dy){
    const unitsPerPixel=2.7/(zoom*height);
    offsetX-=dx*unitsPerPixel;offsetY+=dy*unitsPerPixel;
    updateCamera();render();
  }
  function trackball(event){
    const r=canvas.getBoundingClientRect(),center=new THREE.Vector3().project(camera),radius=Math.min(width,height)*zoom/2.7;
    let x=(event.clientX-r.left-(center.x+1)*width/2)/radius,y=(-(event.clientY-r.top)+(1-center.y)*height/2)/radius;
    const d=x*x+y*y;
    return d>1?new THREE.Vector3(x,y,0).normalize():new THREE.Vector3(x,y,Math.sqrt(1-d));
  }
  function beginRotate(event){drag={point:trackball(event),rotation:globe.quaternion.clone()};}
  function rotate(event){if(!drag)return;const delta=new THREE.Quaternion().setFromUnitVectors(drag.point,trackball(event));globe.quaternion.copy(delta.multiply(drag.rotation));render();}
  function endRotate(){drag=null;}
  function reset(){zoom=1;offsetX=offsetY=0;globe.quaternion.identity();updateCamera();render();}
  function snapshot(){return {zoom,offsetX,offsetY,rotation:globe.quaternion.toArray()};}
  function restore(saved){zoom=saved.zoom;offsetX=saved.offsetX;offsetY=saved.offsetY;globe.quaternion.fromArray(saved.rotation);updateCamera();render();}
  return {render,pick,surfacePoint,zoomAt,pan,beginRotate,rotate,endRotate,reset,snapshot,restore};
}
