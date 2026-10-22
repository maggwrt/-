import * as THREE from './assets/vendor/three.module.min.js';

// All geometry is built locally. No CDN, model service or runtime asset request.
export function createExpeditionScene(container, options = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('Scene container is required.');
  const mode = options.mode === 'lab' ? 'lab' : 'hero';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const C = { cream: 0xf3f0df, blue: 0x4264db, ink: 0x233448, mint: 0x9ce7bc, terra: 0xd78157, green: 0x789b73, pale: 0xdde5cc, gold: 0xe2bf67 };
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (error) {
    container.dataset.sceneReady = 'false';
    options.onError?.(error);
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', mode === 'lab' ? '3D-модель: две тележки на равных дорожках, робот ЛУМА и измерительные отметки' : 'Объёмный робот ЛУМА на исследовательской станции');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;outline:none;touch-action:pan-y;';
  container.appendChild(renderer.domElement);
  container.dataset.sceneReady = 'true';
  container.dataset.running = 'false';
  const scene = new THREE.Scene();
  const world = new THREE.Group(); scene.add(world);
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 150);
  const target = new THREE.Vector3(0, mode === 'hero' ? 1.25 : .45, 0);
  const hemisphere = new THREE.HemisphereLight(0xf2f6ff, 0x8b9475, 2.5); scene.add(hemisphere);
  const sunlight = new THREE.DirectionalLight(0xfff4d9, 4.1);
  sunlight.position.set(-6, 12, 8); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  sunlight.shadow.camera.left = -13; sunlight.shadow.camera.right = 13;
  sunlight.shadow.camera.top = 10; sunlight.shadow.camera.bottom = -10;
  sunlight.shadow.camera.near = .5; sunlight.shadow.camera.far = 45;
  sunlight.shadow.normalBias = .035; sunlight.shadow.bias = -.00015;
  scene.add(sunlight);
  const fill = new THREE.DirectionalLight(0xc2d5ff, 1.2); fill.position.set(6, 4, -6); scene.add(fill);
  const materials = new Map();
  const material = (color, extra = {}) => {
    const key = `${color}-${JSON.stringify(extra)}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: .04, ...extra }));
    return materials.get(key);
  };
  function mesh(geometry, color, parent = world, extra = {}) {
    const object = new THREE.Mesh(geometry, material(color, extra)); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function roundBox(w, h, d, color, parent = world, radius = .12) {
    const r = Math.min(radius, w / 2, h / 2, d / 2);
    const geometry = new THREE.BoxGeometry(w, h, d, 5, 5, 5);
    const pos = geometry.attributes.position;
    const inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i); q.copy(p).clamp(inner.clone().negate(), inner);
      p.sub(q).normalize().multiplyScalar(r).add(q); pos.setXYZ(i, p.x, p.y, p.z);
    }
    geometry.computeVertexNormals(); return mesh(geometry, color, parent);
  }
  function cylinder(top, bottom, height, color, parent = world, segments = 24) { return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), color, parent); }
  function sphere(radius, color, parent = world) { return mesh(new THREE.SphereGeometry(radius, 18, 12), color, parent); }
  function label(text, color = '#233448', background = '#f5f5eb', width = 256, height = 96) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.min(height * .52, width / Math.max(2, text.length) * 1.35)}px Arial`; ctx.fillText(text, width / 2, height / 2);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }
  function sign(text, x, y, z, color = '#233448', background = '#f5f5eb') {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(text, color, background), depthWrite: false, toneMapped: false }));
    sprite.position.set(x, y, z); sprite.scale.set(1.5, .56, 1); world.add(sprite); return sprite;
  }
  function tree(x, z, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, .18, z); group.scale.setScalar(scale); world.add(group);
    const trunk = cylinder(.1, .12, 1.1, 0x9b8064, group, 7); trunk.position.y = .55;
    [0, 1, 2].forEach(i => { const crown = mesh(new THREE.ConeGeometry(.65 - i * .13, 1.25 - i * .1, 7), i % 2 ? 0x81a781 : 0x648f7b, group); crown.position.y = 1.12 + i * .48; });
  }
  function rock(x, z, scale = .35) { const object = mesh(new THREE.DodecahedronGeometry(scale, 0), 0xb1b8ac); object.position.set(x, .22 + scale * .34, z); object.scale.y = .7; object.rotation.set(.2, x, .4); }
  function plant(x, z, scale = 1) {
    for (let i = 0; i < 3; i++) { const leaf = mesh(new THREE.ConeGeometry(.07 * scale, .52 * scale, 4), 0x90aa74); leaf.position.set(x + (i - 1) * .1, .41, z); leaf.rotation.z = (i - 1) * .43; }
  }
  function robot(x, z, scale = 1) {
    const root = new THREE.Group(); root.position.set(x, .28, z); root.scale.setScalar(scale); world.add(root);
    const body = roundBox(1.25, 1.13, .82, C.cream, root, .19); body.position.y = 1.27;
    const chest = cylinder(.2, .2, .055, C.blue, root); chest.rotation.x = Math.PI / 2; chest.position.set(.1, 1.3, .44);
    const chestLight = cylinder(.085, .085, .06, C.mint, root); chestLight.rotation.x = Math.PI / 2; chestLight.position.set(.1, 1.3, .48);
    const side = roundBox(.18, .72, .66, C.blue, root, .06); side.position.set(-.64, 1.28, 0);
    const backpack = roundBox(.88, .98, .48, 0xa7aa89, root, .13); backpack.position.set(0, 1.4, -.57);
    const pocket = roundBox(.55, .37, .1, 0xc8c8ad, root, .04); pocket.position.set(0, 1.19, -.85);
    [-1, 1].forEach(side => {
      const leg = roundBox(.3, .48, .33, C.ink, root, .09); leg.position.set(side * .34, .49, 0);
      const boot = roundBox(.52, .33, .73, C.cream, root, .11); boot.position.set(side * .36, .19, .13);
      const sole = roundBox(.54, .075, .74, C.ink, root, .025); sole.position.set(side * .36, .055, .13);
      const shoulder = sphere(.19, C.ink, root); shoulder.position.set(side * .8, 1.61, 0);
      const arm = new THREE.Group(); arm.position.set(side * .81, 1.53, 0); arm.rotation.z = side * .22; root.add(arm);
      const sleeve = roundBox(.31, .53, .35, C.cream, arm, .1); sleeve.position.y = -.18;
      const joint = sphere(.135, C.ink, arm); joint.position.y = -.45;
      const forearm = roundBox(.3, .35, .37, C.cream, arm, .09); forearm.position.set(0, -.62, .06);
      const hand = sphere(.15, C.ink, arm); hand.scale.set(1, .8, 1); hand.position.set(0, -.86, .06);
      if (side === -1) {
        arm.rotation.x = -.44;
        const notebook = roundBox(.35, .49, .08, C.terra, arm, .035); notebook.position.set(0, -.77, .23); notebook.rotation.z = -.1;
      }
    });
    const neck = cylinder(.22, .22, .23, C.ink, root); neck.position.y = 1.92;
    const head = new THREE.Group(); head.position.y = 2.48; root.add(head);
    const shell = roundBox(1.73, 1.22, 1.04, C.cream, head, .25);
    const ear = cylinder(.29, .29, .18, C.blue, head); ear.rotation.z = Math.PI / 2; ear.position.set(.93, 0, 0);
    const earCenter = cylinder(.16, .16, .2, C.ink, head); earCenter.rotation.z = Math.PI / 2; earCenter.position.set(.97, 0, 0);
    const screen = roundBox(1.43, .92, .14, C.ink, head, .2); screen.position.z = .52;
    const eyes = new THREE.Group(); eyes.position.z = .61; head.add(eyes);
    [-1, 1].forEach(side => {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(side * .31 - .12, .02, 0), new THREE.Vector3(side * .31 - .08, .17, .005), new THREE.Vector3(side * .31 + .08, .17, .005), new THREE.Vector3(side * .31 + .12, .02, 0)]);
      const eye = mesh(new THREE.TubeGeometry(curve, 14, .035, 7, false), C.mint, eyes, { emissive: C.mint, emissiveIntensity: .8 });
    });
    const smileCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.1, -.17, 0), new THREE.Vector3(0, -.21, .005), new THREE.Vector3(.1, -.17, 0)]);
    mesh(new THREE.TubeGeometry(smileCurve, 8, .021, 6, false), C.mint, eyes, { emissive: C.mint, emissiveIntensity: .65 });
    const aerial = cylinder(.025, .025, .48, C.ink, head, 8); aerial.position.set(.52, .79, 0); aerial.rotation.z = -.2;
    const tip = sphere(.095, C.gold, head); tip.position.set(.57, 1.03, 0);
    return { root, head, eyes };
  }
  function cart(x, z, color, letter) {
    const group = new THREE.Group(); group.position.set(x, .42, z); world.add(group);
    const bed = roundBox(1.03, .24, .72, color, group, .07); bed.position.y = .27;
    const cabin = roundBox(.52, .4, .57, C.cream, group, .1); cabin.position.set(-.05, .57, 0);
    const top = roundBox(.34, .025, .39, color, group, .015); top.position.set(-.05, .78, 0);
    const wheels = [];
    [-.35, .35].forEach(xx => [-.42, .42].forEach(zz => {
      const wheel = cylinder(.16, .16, .11, C.ink, group, 16); wheel.rotation.x = Math.PI / 2; wheel.position.set(xx, .15, zz); wheels.push(wheel);
      const hub = cylinder(.075, .075, .12, 0xa4b3bf, group, 12); hub.rotation.x = Math.PI / 2; hub.position.copy(wheel.position);
    }));
    sign(letter, x, 1.6, z, '#ffffff', letter === 'А' ? '#4264db' : '#d78157');
    return { group, wheels };
  }
  // Small, deliberately restrained meadow diorama with readable measurement marks.
  const island = cylinder(mode === 'lab' ? 1 : 4, mode === 'lab' ? .98 : 3.8, .42, 0xc6d0b7, world, 64);
  if (mode === 'lab') island.scale.set(9.1, 1, 5.2);
  island.position.y = -.05;
  const lawn = cylinder(mode === 'lab' ? 1 : 4.01, mode === 'lab' ? 1 : 4.01, .08, C.pale, world, 64);
  if (mode === 'lab') lawn.scale.set(9.1, 1, 5.2);
  lawn.position.y = .2;
  const luma = robot(mode === 'lab' ? -5.7 : -.25, mode === 'lab' ? 3.05 : .5, mode === 'lab' ? .72 : 1.12);
  luma.root.rotation.y = mode === 'lab' ? .35 : .17;
  let carts = [];
  if (mode === 'lab') {
    [-1.25, 1.25].forEach((z, i) => {
      const lane = roundBox(13.5, .12, 1.12, i ? 0xe7d4be : 0xcbd6ed, world, .06); lane.position.set(0, .29, z);
      [-.4, .4].forEach(offset => { const rail = roundBox(13.4, .06, .055, 0x7e8e96, world, .02); rail.position.set(0, .39, z + offset); });
      for (let n = -6; n <= 6; n++) {
        const sleeper = roundBox(.07, .035, 1.05, 0xa7b5b1, world, .01); sleeper.position.set(n, .375, z);
      }
    });
    carts = [cart(-6, -1.25, C.blue, 'А'), cart(-6, 1.25, C.terra, 'Б')];
    // Replace fixed cart labels with sprites that follow their respective carts.
    const markerSprites = world.children.filter(o => o.isSprite && o.position.y === 1.6);
    markerSprites.forEach((sprite, i) => { world.remove(sprite); carts[i].group.add(sprite); sprite.position.set(0, 1.16, 0); sprite.scale.set(.8, .58, 1); });
    const start = roundBox(.12, .025, 4.1, 0xf4f6ec, world, .01); start.position.set(-6, .405, 0);
    const finish = roundBox(.12, .025, 4.1, 0xf4f6ec, world, .01); finish.position.set(6, .405, 0);
    [-2.2, 2.2].forEach(z => {
      const pole = cylinder(.035, .035, 1.5, C.ink); pole.position.set(6, .97, z);
      const flag = mesh(new THREE.PlaneGeometry(.55, .4), C.gold); flag.material.side = THREE.DoubleSide; flag.position.set(6.28, 1.58, z);
    });
    sign('СТАРТ', -6, .67, -3.05); sign('ФИНИШ', 6, .67, -3.05);
    [0, 3, 6, 9, 12].forEach(n => sign(`${n} м`, n - 6, .48, .02, '#627283', '#e1e7d7'));
    [[-7,-2.8,.75],[-6.2,-3.9,.9],[-4.7,-3.6,.65],[1.9,3.6,.85],[3.4,3.2,.6],[6.4,-3,.7],[5.7,3.2,.65]].forEach(([x,z,s])=>tree(x,z,s));
    [[-7.4,1.7,.45],[7.1,1.7,.32],[-2.1,3.5,.34],[3.9,-3,.4]].forEach(args=>rock(...args));
    [[-3.3,-2.8],[.8,3.4],[5.6,2.9],[7,-1.1],[-7.3,-1.3]].forEach(args=>plant(...args));
  } else {
    tree(-2.2,-1.7,.73); tree(-1.1,-2.1,.53); tree(2.4,-.9,.72); tree(2.8,.2,.48);
    rock(-2.5,1.2,.4); rock(2.05,1.5,.35); plant(-1.8,2); plant(1.4,2.25); plant(-2.8,-.2);
    const trail = roundBox(5.1,.045,.9,0xc6ceb9,world,.02); trail.position.set(.1,.26,-.4); trail.rotation.y=.4;
    const beacon = new THREE.Group(); beacon.position.set(1.82,.23,1.45); world.add(beacon);
    const beaconBase = cylinder(.34,.4,.16, C.cream,beacon); beaconBase.position.y=.08;
    const beaconPost = cylinder(.06,.07,.8, C.ink,beacon); beaconPost.position.y=.5;
    const lamp = sphere(.17,C.gold,beacon); lamp.position.y=.98;
    for(let i=0;i<3;i++) { const ring=mesh(new THREE.TorusGeometry(.28+i*.16,.015,6,40),C.blue,beacon); ring.position.y=1.18+i*.22; ring.rotation.x=Math.PI/2; ring.material=material(C.blue,{transparent:true,opacity:.65-i*.15}); }
  }
  // Soft ground shadow below the floating island.
  const shadow = mesh(new THREE.PlaneGeometry(80,80),0xffffff,scene); shadow.material=new THREE.ShadowMaterial({opacity:.12}); shadow.receiveShadow=true; shadow.castShadow=false; shadow.rotation.x=-Math.PI/2; shadow.position.y=-.62;
  const pointer={x:0,y:0};
  let azimuth=mode==='hero' ? .42 : .48, polar=mode==='hero' ? 1.17 : .92, radius=mode==='hero' ? 12.9 : 18.5;
  let desiredAzimuth=azimuth, desiredPolar=polar, desiredRadius=radius;
  let disposed=false, contextLost=false, inView=true, running=false, userPaused=false, raf=0, last=0, ambientTime=0, elapsed=0;
  let experiment={speedA:3,speedB:2,distance:12};
  let emitted=false, pointerDown=null;
  const pointers=new Map(); let pinchDistance=0;
  function updateCamera() {
    const s=Math.sin(polar);
    camera.position.set(target.x+radius*s*Math.sin(azimuth),target.y+radius*Math.cos(polar),target.z+radius*s*Math.cos(azimuth));
    camera.lookAt(target);
  }
  function resize() {
    if(disposed)return;
    const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);
    renderer.setSize(width,height,false); camera.aspect=width/height; camera.updateProjectionMatrix();
    // Keep the entire teaching model in frame on a narrow device.
    desiredRadius=mode==='hero' ? 12.9*Math.max(1,1.28/camera.aspect) : 18.5*Math.max(1,1.7/camera.aspect);
    if(!last)radius=desiredRadius;
    renderOnce();
  }
  function setCartPositions() {
    carts.forEach((cart,i)=>{
      const speed=i===0?experiment.speedA:experiment.speedB;
      const progress=Math.min(speed*elapsed,experiment.distance)/experiment.distance;
      cart.group.position.x=-6+12*progress;
      cart.wheels.forEach(wheel=>wheel.rotation.y=-Math.min(speed*elapsed,experiment.distance)/.16);
    });
    container.dataset.elapsed=elapsed.toFixed(3);
    container.dataset.positionA=String(Math.min(experiment.speedA*elapsed,experiment.distance));
    container.dataset.positionB=String(Math.min(experiment.speedB*elapsed,experiment.distance));
  }
  function renderOnce() { if(disposed||contextLost)return; updateCamera();renderer.render(scene,camera); }
  function animate(now) {
    if(disposed||contextLost){raf=0;return;}
    const visible=inView&&!document.hidden;
    const dt=last?Math.min((now-last)/1000,.1):0;last=now;
    if(visible){
      azimuth+=(desiredAzimuth-azimuth)*.12;polar+=(desiredPolar-polar)*.12;radius+=(desiredRadius-radius)*.12;
      luma.head.rotation.y+=(pointer.x*.4-luma.head.rotation.y)*.08;
      luma.head.rotation.x+=(-pointer.y*.18-luma.head.rotation.x)*.08;
      if(!reducedMotion.matches){ambientTime+=dt;luma.root.position.y=.28+Math.sin(ambientTime*1.2)*.027;luma.eyes.scale.y=Math.sin(ambientTime*1.4)>.996?.17:1;}
      renderOnce();
    }
    // Scrolling to controls or the journal must not freeze an active experiment.
    // Skip costly offscreen rendering, but advance visible-tab simulation time.
    if(!document.hidden&&running&&!userPaused){
      elapsed=Math.min(elapsed+dt,Math.max(experiment.distance/experiment.speedA,experiment.distance/experiment.speedB));setCartPositions();
      if(elapsed>=Math.max(experiment.distance/experiment.speedA,experiment.distance/experiment.speedB)){
        running=false;container.dataset.running='false';
        if(!emitted){emitted=true;options.onComplete?.({...experiment,timeA:experiment.distance/experiment.speedA,timeB:experiment.distance/experiment.speedB});}
      }
    }
    raf=requestAnimationFrame(animate);
  }
  const canvas=renderer.domElement;
  function onPointerDown(event){
    if(mode!=='lab')return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1)pointerDown={id:event.pointerId,x:event.clientX,y:event.clientY};
    if(pointers.size===2){const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}
    canvas.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event){
    // Hero pointer motion is owned by the page; setPointer uses x-right/y-up.
    if(mode==='hero')return;
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2){const [a,b]=[...pointers.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance)desiredRadius=THREE.MathUtils.clamp(desiredRadius*pinchDistance/Math.max(1,distance),12,50);pinchDistance=distance;return;}
    if(pointerDown){desiredAzimuth-=(event.clientX-pointerDown.x)*.006;desiredPolar=THREE.MathUtils.clamp(desiredPolar+(event.clientY-pointerDown.y)*.005,.2,1.46);pointerDown.x=event.clientX;pointerDown.y=event.clientY;}
  }
  function onPointerUp(event){pointers.delete(event.pointerId);pointerDown=null;pinchDistance=0;}
  function onWheel(event){if(mode!=='lab')return;event.preventDefault();desiredRadius=THREE.MathUtils.clamp(desiredRadius*Math.exp(event.deltaY*.001),12,50);}
  function onLeave(){if(mode==='hero')setPointer(0,0);}
  function setPointer(x,y){pointer.x=THREE.MathUtils.clamp(Number(x)||0,-1,1);pointer.y=THREE.MathUtils.clamp(Number(y)||0,-1,1);if(mode==='hero'&&!reducedMotion.matches){desiredAzimuth=.42+pointer.x*.1;desiredPolar=1.17-pointer.y*.04;}}
  function onVisibility(){last=0;}
  function onContextLost(event){event.preventDefault();contextLost=true;running=false;container.dataset.running='false';container.dataset.sceneReady='false';if(raf)cancelAnimationFrame(raf);options.onError?.(new Error('WebGL context lost. Reload the page to restore 3D.'));}
  canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointermove',onPointerMove);canvas.addEventListener('pointerup',onPointerUp);canvas.addEventListener('pointercancel',onPointerUp);canvas.addEventListener('pointerleave',onLeave);canvas.addEventListener('wheel',onWheel,{passive:false});canvas.addEventListener('webglcontextlost',onContextLost);document.addEventListener('visibilitychange',onVisibility);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
  const intersectionObserver=new IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting??true;last=0;},{threshold:0});intersectionObserver.observe(container);
  resize();raf=requestAnimationFrame(animate);
  return {
    run(values={}) {
      if(mode!=='lab'||disposed||contextLost)return false;
      const parsed={speedA:Number(values.speedA??3),speedB:Number(values.speedB??2),distance:Number(values.distance??12)};
      if(Object.values(parsed).some(value=>!Number.isFinite(value)||value<=0))throw new RangeError('Experiment values must be positive finite numbers.');
      experiment=parsed;elapsed=0;emitted=false;running=true;userPaused=false;last=0;container.dataset.running='true';setCartPositions();return true;
    },
    pause(){userPaused=true;container.dataset.running='false';},
    resume(){if(running&&!disposed&&!contextLost){userPaused=false;last=0;container.dataset.running='true';}},
    reset(){running=false;userPaused=false;elapsed=0;emitted=false;container.dataset.running='false';setCartPositions();renderOnce();},
    setView(view){const presets={perspective:[.48,.92],top:[0,.08],side:[0,1.42]};const preset=presets[view]??presets.perspective;desiredAzimuth=preset[0];desiredPolar=preset[1];},
    setFog(enabled){scene.fog=enabled?new THREE.FogExp2(0xe9eef4,mode==='lab'?.018:.035):null;renderOnce();},
    setPointer,
    dispose(){
      if(disposed)return;disposed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();intersectionObserver.disconnect();document.removeEventListener('visibilitychange',onVisibility);
      canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointermove',onPointerMove);canvas.removeEventListener('pointerup',onPointerUp);canvas.removeEventListener('pointercancel',onPointerUp);canvas.removeEventListener('pointerleave',onLeave);canvas.removeEventListener('wheel',onWheel);canvas.removeEventListener('webglcontextlost',onContextLost);
      const geometries=new Set(),mats=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{mats.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});});});materials.forEach(m=>mats.add(m));geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());mats.forEach(m=>m.dispose());renderer.dispose();canvas.remove();container.dataset.sceneReady='false';container.dataset.running='false';
    }
  };
}
