import * as THREE from './assets/vendor/three.module.min.js';

// All geometry is built locally. No CDN, model service or runtime asset request.
export function createExpeditionScene(container, options = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('Scene container is required.');
  const mode = ['lab', 'delivery'].includes(options.mode) ? options.mode : 'hero';
  const isField = mode !== 'hero';
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
  renderer.domElement.setAttribute('aria-label', isField ? '3D-модель: две тележки на равных дорожках, робот ЛУМА и измерительные отметки' : 'Объёмный робот ЛУМА на исследовательской станции');
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
  function organicTerrain(color, depth = .16) {
    const shape = new THREE.Shape();
    shape.moveTo(-3.75, -.48); shape.bezierCurveTo(-3.35, -2.05, -1.65, -2.55, -.2, -2.3);
    shape.bezierCurveTo(1.45, -2.5, 3.65, -1.45, 3.88, -.12);
    shape.bezierCurveTo(4.1, 1.1, 2.35, 2.35, .72, 2.48);
    shape.bezierCurveTo(-1.02, 2.72, -3.45, 1.75, -3.75, .48);
    shape.closePath();
    const geometry = depth > 0 ? new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled:true, bevelSegments:1, steps:1, bevelSize:.035, bevelThickness:.025}) : new THREE.ShapeGeometry(shape);
    geometry.rotateX(Math.PI / 2); geometry.translate(0, depth * .5, 0);
    const object = mesh(geometry, color, world, {side:THREE.DoubleSide, roughness:.9});
    return object;
  }
  function fieldStation(x, z, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, .23, z); group.scale.setScalar(scale); world.add(group);
    const desk = roundBox(1.38, .13, .68, 0x9c7652, group, .035); desk.position.y = 1.15;
    const shelf = roundBox(.94, .08, .43, 0x6d8c73, group, .025); shelf.position.set(.04, .74, -.02);
    [-.5, .5].forEach(x => { const leg = cylinder(.045,.055,.9, C.ink, group, 8); leg.position.set(x, .56, 0); });
    const instrument = roundBox(.5, .22, .37, 0x738a84, group, .06); instrument.position.set(-.25, 1.31, .02);
    const dial = cylinder(.12,.12,.025,C.mint,group,20); dial.rotation.x=Math.PI/2;dial.position.set(-.25,1.31,.21);
    const notebook = roundBox(.33,.04,.41,C.terra,group,.018); notebook.position.set(.38,1.25,.06); notebook.rotation.y=-.18;
    const canopy = new THREE.Group(); canopy.position.set(0, 1.82, -.12); group.add(canopy);
    [-.63,.63].forEach(x => {const pole=cylinder(.025,.03,.85,C.ink,canopy,8);pole.position.set(x,-.42,0);});
    const roof = roundBox(1.65,.08,.68,0xb58f60,canopy,.04); roof.rotation.z=-.08; roof.position.y=.04;
    const flag = mesh(new THREE.PlaneGeometry(.38,.24),C.gold,group); flag.position.set(.82,1.95,.03);flag.rotation.y=Math.PI/2;
    const flagPole = cylinder(.018,.02,.68,C.ink,group,8);flagPole.position.set(.82,1.64,.03);
  }
  function railFragment(x, z, scale = 1) {
    const group = new THREE.Group(); group.position.set(x,.26,z); group.rotation.y=.22; group.scale.setScalar(scale); world.add(group);
    [-.38,.38].forEach(offset=>{const rail=roundBox(2.65,.055,.045,.6*0x8d9a9b,group,.012);rail.position.z=offset;});
    for(let i=-5;i<=5;i++){const sleeper=roundBox(.07,.04,.98,0x9b8161,group,.012);sleeper.position.x=i*.27;}
    const marker=roundBox(.07,.86,.07,C.ink,group,.01);marker.position.set(1.44,.45,.42);
    const cloth=mesh(new THREE.PlaneGeometry(.43,.27),C.gold,group);cloth.position.set(1.66,.72,.42);cloth.rotation.y=Math.PI/2;
  }
  function robot(x, z, scale = 1) {
    const root = new THREE.Group(); root.position.set(x, .28, z); root.scale.setScalar(scale); world.add(root);
    const body = roundBox(1.25, 1.13, .82, C.cream, root, .19); body.position.y = 1.27;
    const chest = cylinder(.2, .2, .055, C.blue, root); chest.rotation.x = Math.PI / 2; chest.position.set(.1, 1.3, .44);
    const chestLight = cylinder(.085, .085, .06, C.mint, root); chestLight.rotation.x = Math.PI / 2; chestLight.position.set(.1, 1.3, .48);
    const side = roundBox(.18, .72, .66, C.blue, root, .06); side.position.set(-.64, 1.28, 0);
    const backpack = roundBox(.88, .98, .48, 0xa7aa89, root, .13); backpack.position.set(0, 1.4, -.57);
    const pocket = roundBox(.55, .37, .1, 0xc8c8ad, root, .04); pocket.position.set(0, 1.19, -.85);
    let rightArm;
    [-1, 1].forEach(side => {
      const leg = roundBox(.3, .48, .33, C.ink, root, .09); leg.position.set(side * .34, .49, 0);
      const boot = roundBox(.52, .33, .73, C.cream, root, .11); boot.position.set(side * .36, .19, .13);
      const sole = roundBox(.54, .075, .74, C.ink, root, .025); sole.position.set(side * .36, .055, .13);
      const shoulder = sphere(.19, C.ink, root); shoulder.position.set(side * .8, 1.61, 0);
      const arm = new THREE.Group(); arm.position.set(side * .81, 1.53, 0); arm.rotation.z = side * .22; root.add(arm); if (side === 1) rightArm = arm;
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
    return { root, head, eyes, rightArm };
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
  const island = isField ? cylinder(1, .98, .42, 0xc6d0b7, world, 64) : organicTerrain(0x7f916a, .18);
  if (isField) island.scale.set(9.1, 1, 5.2);
  island.position.y = isField ? -.05 : .04;
  const lawn = isField ? cylinder(1, 1, .08, C.pale, world, 64) : organicTerrain(0x99a878, .035);
  if (isField) lawn.scale.set(9.1, 1, 5.2);
  lawn.position.y = isField ? .2 : .17;
  const luma = robot(isField ? -5.7 : -.25, isField ? 3.05 : .5, isField ? .72 : 1.12);
  luma.root.rotation.y = isField ? .35 : .17;
  let carts = [];
  let beaconLamp, beaconRings = [], stationPosition;
  const beaconGlow = new THREE.PointLight(C.mint, 0, 4, 2); world.add(beaconGlow);
  function makeBeaconDock(x, z, height) {
    const group = new THREE.Group(); group.position.set(x, .23, z); world.add(group);
    const base = cylinder(.34, .4, .16, C.cream, group); base.position.y = .08;
    const post = cylinder(.065, .085, height, C.ink, group); post.position.y = .16 + height / 2;
    const socket = cylinder(.24, .2, .12, 0x98a5a4, group); socket.position.y = .2 + height;
    beaconLamp = sphere(.16, 0x73888b, group); beaconLamp.position.y = .38 + height; beaconLamp.material = beaconLamp.material.clone();
    stationPosition = new THREE.Vector3(x, .23 + height + .24, z);
    beaconGlow.position.set(x, .23 + height + .6, z);
    for (let i = 0; i < 3; i++) {
      const ring = mesh(new THREE.TorusGeometry(.3 + i * .17, .017, 6, 40), C.mint, group);
      ring.position.y = .68 + height + i * .2; ring.rotation.x = Math.PI / 2;
      ring.material = new THREE.MeshBasicMaterial({color:0x4fbc8c,transparent:true,opacity:0,depthWrite:false,toneMapped:false}); ring.visible = false; beaconRings.push(ring);
    }
  }
  if (isField) {
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
    makeBeaconDock(7.05, 0, 1.02);
  } else {
    // HERO: a compact field station on an irregular olive terrain fragment. The
    // cluster is intentionally sparse so the robot remains the focal point and
    // parent illustrations can show through around the transparent canvas.
    tree(-3.15,-1.28,.94); tree(-2.82,1.25,.72); tree(2.78,-1.1,.9); tree(3.18,1.14,.62); tree(1.45,2.05,.52);
    rock(-2.55,1.52,.4); rock(2.3,1.46,.34); rock(-3.22,-.35,.28); rock(3.1,-.18,.3);
    plant(-1.8,1.92,.9); plant(1.1,2.2,.85); plant(-3.16,.48,.72); plant(2.78,.48,.74); plant(-.95,-1.35,.78);
    fieldStation(-2.48,.35,.82);
    railFragment(.42,-1.33,.72);
    const trail = roundBox(3.9,.045,.58,0xc4b68a,world,.02); trail.position.set(-.08,.24,-.15); trail.rotation.y=.35;
    makeBeaconDock(2.12, 1.42, .64);
  }
  const payload = new THREE.Group(); payload.visible = false; world.add(payload);
  const payloadBase = cylinder(.22, .25, .12, C.cream, payload); payloadBase.position.y = .06;
  const payloadCore = cylinder(.115, .115, .31, C.blue, payload); payloadCore.position.y = .25;
  const payloadLight = sphere(.145, C.gold, payload); payloadLight.position.y = .47;
  payloadLight.material = payloadLight.material.clone(); payloadLight.material.emissive.setHex(C.gold); payloadLight.material.emissiveIntensity = .3;
  const payloadHandle = mesh(new THREE.TorusGeometry(.2, .023, 6, 22, Math.PI), C.ink, payload); payloadHandle.position.y = .25;
  // Soft ground shadow below the floating island.
  const shadow = mesh(new THREE.PlaneGeometry(80,80),0xffffff,scene); shadow.material=new THREE.ShadowMaterial({opacity:.12}); shadow.receiveShadow=true; shadow.castShadow=false; shadow.rotation.x=-Math.PI/2; shadow.position.y=-.62;
  const pointer={x:0,y:0};
  let azimuth=mode==='hero' ? .42 : .48, polar=mode==='hero' ? 1.17 : .92, radius=mode==='hero' ? 11.6 : 18.5;
  let desiredAzimuth=azimuth, desiredPolar=polar, desiredRadius=radius;
  let disposed=false, contextLost=false, inView=true, running=false, userPaused=false, raf=0, last=0, ambientTime=0, elapsed=0;
  let experiment={speedA:3,speedB:2,distance:12};
  let emitted=false, pointerDown=null;
  let story = { signalRestored: false, awakened: true };
  let emotion = 'curious', recovery = 0, fogDensity = 0;
  let delivery = null;
  container.dataset.signalRestored = 'false';
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
    desiredRadius=mode==='hero' ? 11.6*Math.max(1,1.28/camera.aspect) : 18.5*Math.max(1,1.7/camera.aspect);
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
    const frameDt=last?Math.max(0,(now-last)/1000):0;
    const dt=Math.min(frameDt,.1);last=now;
    if(visible){
      azimuth+=(desiredAzimuth-azimuth)*.12;polar+=(desiredPolar-polar)*.12;radius+=(desiredRadius-radius)*.12;
      if(!reducedMotion.matches) ambientTime+=dt;
      const sleepy = !story.awakened;
      const headY = pointer.x*.4 + (emotion==='thinking' ? -.16 : 0);
      const headX = -pointer.y*.18 + (sleepy ? .22 : emotion==='happy' && !reducedMotion.matches ? Math.sin(ambientTime*2.5)*.065 : 0);
      const headZ = emotion==='uncertain' ? .14 : emotion==='thinking' ? -.1 : 0;
      luma.head.rotation.y+=(headY-luma.head.rotation.y)*.08;
      luma.head.rotation.x+=(headX-luma.head.rotation.x)*.08;
      luma.head.rotation.z+=(headZ-luma.head.rotation.z)*.08;
      luma.root.position.y=.28+(!reducedMotion.matches && story.awakened ? Math.sin(ambientTime*1.2)*.027 : 0);
      luma.eyes.scale.y=sleepy ? .12 : emotion==='thinking' ? .55 : emotion==='uncertain' ? .72 : !reducedMotion.matches&&Math.sin(ambientTime*1.4)>.996 ? .17 : 1;
      luma.rightArm.rotation.z=.22+(emotion==='happy'&&story.awakened ? 1.85+(!reducedMotion.matches ? Math.sin(ambientTime*4)*.12 : 0) : 0);
      const desiredRecovery=story.signalRestored ? 1 : 0;
      recovery += (desiredRecovery-recovery)*(reducedMotion.matches ? 1 : .07);
      updateRecoveredVisual(recovery);
      renderOnce();
    }
    // Scrolling to controls or the journal must not freeze an active experiment.
    // Skip costly offscreen rendering, but advance visible-tab simulation time.
    if(!document.hidden && delivery) advanceDelivery(frameDt);
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
    if(!isField)return;
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
  function onWheel(event){if(!isField)return;event.preventDefault();desiredRadius=THREE.MathUtils.clamp(desiredRadius*Math.exp(event.deltaY*.001),12,50);}
  function onLeave(){if(mode==='hero')setPointer(0,0);}
  function setPointer(x,y){pointer.x=THREE.MathUtils.clamp(Number(x)||0,-1,1);pointer.y=THREE.MathUtils.clamp(Number(y)||0,-1,1);if(mode==='hero'&&!reducedMotion.matches){desiredAzimuth=.42+pointer.x*.1;desiredPolar=1.17-pointer.y*.04;}}
  function onVisibility(){last=0;}
  function onContextLost(event){event.preventDefault();cancelDelivery();contextLost=true;running=false;container.dataset.running='false';container.dataset.sceneReady='false';if(raf)cancelAnimationFrame(raf);options.onError?.(new Error('WebGL context lost. Reload the page to restore 3D.'));}
  function updateRecoveredVisual(amount) {
    beaconLamp.material.color.setHex(amount > .05 ? C.mint : 0x73888b);
    beaconLamp.material.emissive.setHex(C.mint); beaconLamp.material.emissiveIntensity = amount * 1.2;
    beaconGlow.intensity = amount * 1.8;
    beaconRings.forEach((ring,i) => { ring.visible=amount>.02; ring.material.opacity=amount*(.62-i*.13); const pulse=!reducedMotion.matches?1+Math.sin(ambientTime*1.8-i*.5)*.055:1;ring.scale.set(pulse,pulse,pulse); });
    if(scene.fog)scene.fog.density=fogDensity*(1-amount);
  }
  function setStoryState(values = {}) {
    if(typeof values.signalRestored==='boolean')story.signalRestored=values.signalRestored;
    if(typeof values.awakened==='boolean')story.awakened=values.awakened;
    container.dataset.signalRestored=String(story.signalRestored);
    container.dataset.awakened=String(story.awakened);
    if(reducedMotion.matches){recovery=story.signalRestored?1:0;updateRecoveredVisual(recovery);}
    renderOnce();
  }
  function setEmotion(value) {
    emotion=['curious','thinking','happy','uncertain'].includes(value)?value:'curious';
    container.dataset.emotion=emotion;
  }
  function hidePayload() {
    if(payload.parent!==world)world.attach(payload);
    payload.visible=false;
  }
  function cancelDelivery() {
    if(!delivery)return;
    const previous=delivery;delivery=null;
    story.signalRestored=previous.wasRestored;container.dataset.signalRestored=String(story.signalRestored);
    container.dataset.delivery='cancelled';hidePayload();
    previous.resolve({cancelled:true});
  }
  function deliveryPositions() {
    container.dataset.deliveryPositionA=String((carts[0]?.group.position.x??-6)+6);
    container.dataset.deliveryPositionB=String((carts[1]?.group.position.x??-6)+6);
  }
  function placePayloadAtStation() {
    if(payload.parent!==world)world.attach(payload);
    payload.position.copy(stationPosition);payload.rotation.set(0,0,0);payload.visible=true;
  }
  function finishDelivery() {
    if(!delivery)return;
    const finished=delivery;
    carts[finished.index].group.position.x=6;
    placePayloadAtStation();payloadLight.material.color.setHex(C.mint);payloadLight.material.emissive.setHex(C.mint);payloadLight.material.emissiveIntensity=.8;story.signalRestored=true;story.awakened=true;emotion='happy';recovery=1;
    container.dataset.signalRestored='true';container.dataset.awakened='true';container.dataset.emotion='happy';container.dataset.delivery='complete';
    updateRecoveredVisual(1);deliveryPositions();delivery=null;renderOnce();finished.resolve({delivered:true});
  }
  function advanceDelivery(dt) {
    if(!delivery)return;
    delivery.time+=dt;
    const t=delivery.time, chosen=carts[delivery.index];
    const travel=Math.min(1,t/3.35);
    const smooth=travel*travel*(3-2*travel);
    chosen.group.position.x=-6+12*smooth;
    chosen.wheels.forEach(wheel=>wheel.rotation.y=-12*smooth/.16);
    if(t>=3.35){
      if(!delivery.liftStart){world.attach(payload);delivery.liftStart=payload.position.clone();}
      const lift=Math.min(1,(t-3.35)/1.1), blend=lift*lift*(3-2*lift);
      payload.position.lerpVectors(delivery.liftStart,stationPosition,blend);payload.position.y+=Math.sin(Math.PI*lift)*.5;
      if(lift===1){story.signalRestored=true;emotion='happy';container.dataset.signalRestored='true';container.dataset.emotion='happy';}
    }
    deliveryPositions();
    if(t>=5.4)finishDelivery();
  }
  function deliverBeacon(values = {}) {
    if(!isField||disposed||contextLost)return Promise.resolve({cancelled:true});
    cancelDelivery();
    const wasRestored=story.signalRestored;story.signalRestored=false;recovery=0;container.dataset.signalRestored='false';updateRecoveredVisual(0);
    running=false;userPaused=false;container.dataset.running='false';
    const index=values.cart==='b'?1:0;
    carts.forEach(cart=>{cart.group.position.x=-6;cart.wheels.forEach(wheel=>wheel.rotation.y=0);});
    payloadLight.material.color.setHex(C.gold);payloadLight.material.emissive.setHex(C.gold);payloadLight.material.emissiveIntensity=.3;
    carts[index].group.add(payload);payload.position.set(0,.83,0);payload.rotation.set(0,0,0);payload.visible=true;
    container.dataset.delivery='running';container.dataset.deliveryCart=index===1?'b':'a';
    deliveryPositions();emotion='thinking';container.dataset.emotion=emotion;
    return new Promise(resolve=>{
      delivery={resolve,index,time:0,liftStart:null,wasRestored};
      if(reducedMotion.matches)finishDelivery();
    });
  }
  canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointermove',onPointerMove);canvas.addEventListener('pointerup',onPointerUp);canvas.addEventListener('pointercancel',onPointerUp);canvas.addEventListener('pointerleave',onLeave);canvas.addEventListener('wheel',onWheel,{passive:false});canvas.addEventListener('webglcontextlost',onContextLost);document.addEventListener('visibilitychange',onVisibility);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
  const intersectionObserver=new IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting??true;last=0;},{threshold:0});intersectionObserver.observe(container);
  resize();raf=requestAnimationFrame(animate);
  return {
    run(values={}) {
      if(mode!=='lab'||disposed||contextLost)return false;
      const parsed={speedA:Number(values.speedA??3),speedB:Number(values.speedB??2),distance:Number(values.distance??12)};
      if(Object.values(parsed).some(value=>!Number.isFinite(value)||value<=0))throw new RangeError('Experiment values must be positive finite numbers.');
      cancelDelivery();experiment=parsed;elapsed=0;emitted=false;running=true;userPaused=false;last=0;container.dataset.running='true';setCartPositions();return true;
    },
    pause(){userPaused=true;container.dataset.running='false';},
    resume(){if(running&&!disposed&&!contextLost){userPaused=false;last=0;container.dataset.running='true';}},
    reset(){cancelDelivery();running=false;userPaused=false;elapsed=0;emitted=false;container.dataset.running='false';setCartPositions();renderOnce();},
    setView(view){const presets={perspective:[.48,.92],top:[0,.08],side:[0,1.42]};const preset=presets[view]??presets.perspective;desiredAzimuth=preset[0];desiredPolar=preset[1];},
    setFog(enabled){fogDensity=enabled?(isField?.018:.035):0;scene.fog=enabled?new THREE.FogExp2(0xe9eef4,fogDensity*(1-recovery)):null;renderOnce();},
    setPointer, setStoryState, setEmotion, deliverBeacon,
    dispose(){
      if(disposed)return;cancelDelivery();disposed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();intersectionObserver.disconnect();document.removeEventListener('visibilitychange',onVisibility);
      canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointermove',onPointerMove);canvas.removeEventListener('pointerup',onPointerUp);canvas.removeEventListener('pointercancel',onPointerUp);canvas.removeEventListener('pointerleave',onLeave);canvas.removeEventListener('wheel',onWheel);canvas.removeEventListener('webglcontextlost',onContextLost);
      const geometries=new Set(),mats=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{mats.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});});});materials.forEach(m=>mats.add(m));geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());mats.forEach(m=>m.dispose());renderer.dispose();canvas.remove();container.dataset.sceneReady='false';container.dataset.running='false';
    }
  };
}
