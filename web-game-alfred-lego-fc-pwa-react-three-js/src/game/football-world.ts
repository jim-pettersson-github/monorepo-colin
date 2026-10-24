import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  PlaneGeometry,
  RingGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { palette } from '../palette';
import { CAMERA_DEPTH, CAMERA_HEIGHT, matchCameraFrame } from './camera';
import { getMatchClubs } from './clubs';
import type { MatchState, Player } from './model';
import { attackDirection, FALL_DURATION, FIELD, SLIDE_DURATION } from './model';
import { footballGeometry, kitTexture, pitchTexture } from './pitch-art';
import { instanceParts } from './render-batches';

export function createFootballWorld(canvas: HTMLCanvasElement) {
  const phone = matchMedia('(pointer: coarse)').matches;
  const renderer = new WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 1.5, powerPreference: 'high-performance' });
  const maxPixelRatio = Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(maxPixelRatio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !phone;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const scene = new Scene();
  scene.background = new Color(palette.background);
  const camera = new OrthographicCamera(-34, 34, 22, -22, 0.1, 360);
  const materials = new Map<string, MeshStandardMaterial>();
  const material = (color: string) => {
    let value = materials.get(color);
    if (!value) {
      value = new MeshStandardMaterial({ color, roughness: 0.48 });
      materials.set(color, value);
    }
    return value;
  };
  const cube = new BoxGeometry(1, 1, 1);
  const roundedCube = new RoundedBoxGeometry(1, 1, 1, 1, 0.075);
  function box(parent: Group | Scene, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    const mesh = new Mesh(cube, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = parent !== stadium;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  scene.add(new HemisphereLight(0xdcecff, 0x435b36, 2.1));
  const sunlight = new DirectionalLight(0xfff2da, 3.2);
  sunlight.position.set(-28, 70, 40);
  sunlight.castShadow = !phone;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -68, right: 68, top: 50, bottom: -50, far: 180 });
  sunlight.shadow.normalBias = 0.035;
  sunlight.shadow.bias = -0.0002;
  scene.add(sunlight);

  const stadium = new Group();
  stadium.scale.set(FIELD.scale, 1, FIELD.scale);
  box(stadium, 0, -1.1, 0, 58, 1.5, 40, palette.pitchBase);
  box(stadium, 0, -0.27, 0, 56.5, 0.25, 38.5, palette.pitchEdge);
  box(stadium, 0, -0.08, 0, 48.5, 0.2, 30.5, palette.pitch);
  const turfMap = pitchTexture();
  turfMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const turfMaterial = new MeshStandardMaterial({ map: turfMap, roughness: 0.98 });
  const turf = new Mesh(new PlaneGeometry(48, 30), turfMaterial);
  turf.rotation.x = -Math.PI / 2;
  turf.position.y = 0.055;
  turf.receiveShadow = true;
  stadium.add(turf);
  for (const z of [-15, 15]) {
    box(stadium, 0, 0.4, z + Math.sign(z) * 0.6, 50, 0.8, 0.35, palette.board);
    for (let i = 0; i < 8; i++) box(stadium, -21 + i * 6, 0.75, z + Math.sign(z) * 0.65, 4.9, 0.18, 0.5, i % 2 ? palette.home : palette.away);
  }
  for (const side of [-1, 1]) {
    for (const z of [-9.7, 9.7]) box(stadium, side * 24.6, 0.4, z, 0.35, 0.8, 10.8, palette.board);
    for (const z of [-4.1, 4.1]) {
      box(stadium, side * 24, 1.45, z, 0.22, 2.9, 0.22, palette.pitchLines);
      box(stadium, side * 25.1, 0.14, z, 2.2, 0.18, 0.18, palette.pitchLines);
    }
    box(stadium, side * 24, 2.9, 0, 0.22, 0.22, 8.4, palette.pitchLines);
    box(stadium, side * 26.1, 0.14, 0, 0.18, 0.18, 8.4, palette.pitchLines);
    for (let z = -4; z <= 4; z += 0.28) {
      const net = box(stadium, side * 25.05, 1.5, z, 0.018, 3.5, 0.018, palette.net);
      net.rotation.z = side * 0.64;
    }
    for (let h = 0.28; h < 2.9; h += 0.28) {
      const depth = 2.1 * (1 - h / 2.9);
      box(stadium, side * (24 + depth), h, 0, 0.018, 0.018, 8.2, palette.net);
      for (const z of [-4.1, 4.1]) box(stadium, side * (24 + depth / 2), h, z, depth, 0.018, 0.018, palette.net);
    }
    for (const z of [-14.7, 14.7]) {
      box(stadium, side * 23.7, 0.75, z, 0.045, 1.5, 0.045, palette.pitchLines);
      box(stadium, side * 23.7 + 0.27, 1.35, z, 0.55, 0.35, 0.025, palette.accent);
    }
  }

  // One instanced mesh for the studs around the baseplate.
  const studs = new InstancedMesh(new CylinderGeometry(0.28, 0.28, 0.14, 10), material(palette.pitchBase), 48);
  const matrix = new Matrix4();
  for (let i = 0; i < 48; i++) {
    matrix.makeTranslation(-27 + (i % 24) * 2.35, -0.2, i < 24 ? -19.2 : 19.2);
    studs.setMatrixAt(i, matrix);
  }
  scene.add(studs);
  studs.scale.copy(stadium.scale);
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const z = side * (17 + row * 0.85);
      box(stadium, 0, row * 0.55 + 0.15, z, 43, 0.55, 0.85, palette.stands);
      for (let i = 0; i < 32; i++) {
        const x = -20.5 + i * 1.32;
        if (i % 8 === 7) continue;
        const color = (i + row) % 3 ? palette.home : palette.away;
        box(stadium, x, row * 0.55 + 0.56, z, 0.8, 0.16, 0.55, color);
        box(stadium, x, row * 0.55 + 0.8, z + side * 0.25, 0.8, 0.45, 0.1, color);
        if ((i * 7 + row * 3) % 5 === 0) continue;
        box(stadium, x, row * 0.55 + 0.93, z - side * 0.05, 0.38, 0.6, 0.28, (i + row) % 4 ? color : palette.ink);
        box(stadium, x, row * 0.55 + 1.4, z - side * 0.05, 0.28, 0.32, 0.28, palette.skin);
      }
    }
    box(stadium, 0, 0.1, side * 16.3, 44, 0.12, 0.65, palette.walkway);
    box(stadium, 0, 2.1, side * 19.2, 45, 0.08, 0.06, palette.board);
    for (const x of [-22, -11, 0, 11, 22]) box(stadium, x, 1.25, side * 19.2, 0.07, 1.7, 0.07, palette.board);
  }
  // Two compact light towers leave the playing surface and camera sightlines clear.
  for (const x of [-26.8, 26.8]) {
    box(stadium, x, 3.7, -18, 0.18, 7.4, 0.18, palette.stands);
    box(stadium, x, 7.4, -18, 2.3, 0.8, 0.3, palette.boots);
    for (const offset of [-0.75, 0, 0.75]) box(stadium, x + offset, 7.4, -17.8, 0.58, 0.5, 0.06, palette.pitchLines);
  }
  const staticParts = instanceParts(stadium);
  scene.add(staticParts.group);

  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 128;
  faceCanvas.height = 128;
  const ctx = faceCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = palette.skin;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = palette.face;
    for (const x of [42, 86]) {
      ctx.beginPath();
      ctx.ellipse(x, 51, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = palette.face;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 68, 21, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }
  const faceTexture = new CanvasTexture(faceCanvas);
  faceTexture.colorSpace = SRGBColorSpace;
  const faceMaterial = new MeshStandardMaterial({ map: faceTexture, roughness: 0.5 });
  const headGeometry = new CylinderGeometry(0.35, 0.35, 0.55, 20);
  const handGeometry = new CylinderGeometry(0.14, 0.14, 0.2, 8);
  const headStud = new CylinderGeometry(0.17, 0.17, 0.14, 10);
  const keeperCanvas = document.createElement('canvas');
  keeperCanvas.width = 96;
  keeperCanvas.height = 48;
  const keeperContext = keeperCanvas.getContext('2d');
  if (keeperContext) {
    keeperContext.fillStyle = palette.keeper;
    keeperContext.fillRect(0, 0, 96, 48);
    keeperContext.strokeStyle = palette.keeperTrim;
    keeperContext.lineWidth = 5;
    keeperContext.strokeRect(3, 3, 90, 42);
    keeperContext.fillStyle = palette.keeperTrim;
    keeperContext.font = 'bold 30px Arial';
    keeperContext.textAlign = 'center';
    keeperContext.fillText('MV', 48, 35);
  }
  const keeperTexture = new CanvasTexture(keeperCanvas);
  keeperTexture.colorSpace = SRGBColorSpace;
  const keeperBadgeMaterial = new SpriteMaterial({ map: keeperTexture });
  const actors = new Group();
  const facePlane = new PlaneGeometry(0.52, 0.48);
  const shirtPlane = new PlaneGeometry(0.7, 0.66);
  const keeperRingGeometry = new RingGeometry(0.82, 0.93, 32);
  const markerGeometry = new RingGeometry(0.78, 0.98, 32);
  const kitMaterials = new Map<string, MeshStandardMaterial>();
  const kitMaterial = (number: number, shirt: string, trim: string) => {
    const key = `${number}:${shirt}:${trim}`;
    let value = kitMaterials.get(key);
    if (!value) {
      value = new MeshStandardMaterial({ map: kitTexture(number, shirt, trim), roughness: 0.72 });
      kitMaterials.set(key, value);
    }
    return value;
  };
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d');
  if (shadowContext) {
    const gradient = shadowContext.createRadialGradient(32, 32, 5, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0,0,0,0.32)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    shadowContext.fillStyle = gradient;
    shadowContext.fillRect(0, 0, 64, 64);
  }
  const contactTexture = new CanvasTexture(shadowCanvas);
  const contactMaterial = new MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false });
  const contactGeometry = new PlaneGeometry(2.6, 2.2);
  function figure(id: number) {
    const group = new Group();
    group.rotation.order = 'YXZ';
    group.scale.setScalar(1.15);
    const teamColor = id < 5 ? palette.home : palette.away;
    const shirt = id % 5 === 0 ? palette.keeper : teamColor;
    const shirtParts = [box(group, 0, 1.18, 0, 0.79, 0.73, 0.46, shirt)];
    const jerseyParts = [1, -1].map((side) => {
      const jersey = new Mesh(shirtPlane, kitMaterial((id % 5) + 1, shirt, palette.pitchLines));
      jersey.position.set(0, 1.18, side * 0.235);
      jersey.rotation.y = side < 0 ? Math.PI : 0;
      group.add(jersey);
      return jersey;
    });
    const trimParts = [box(group, 0, 1.52, 0, 0.35, 0.07, 0.49, palette.pitchLines)];
    box(group, 0, 0.77, 0, 0.75, 0.16, 0.46, palette.shorts);
    const head = new Mesh(headGeometry, material(palette.skin));
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);
    const stud = new Mesh(headStud, material(palette.skin));
    stud.position.y = 2.19;
    group.add(stud);
    const face = new Mesh(facePlane, faceMaterial);
    face.position.set(0, 1.85, 0.322);
    group.add(face);
    if (id % 3 !== 0) {
      const hair = id % 2 ? palette.hair : palette.blond;
      box(group, 0, 2.1, -0.06, 0.7, 0.17, 0.54, hair);
      box(group, 0, 1.94, -0.28, 0.65, 0.28, 0.13, hair);
      box(group, id % 2 ? -0.2 : 0.2, 2.08, 0.18, 0.27, 0.2, 0.23, hair);
    }
    const limbs: Group[] = [];
    for (const side of [-1, 1]) {
      const leg = new Group();
      leg.position.set(side * 0.21, 0.75, 0);
      box(leg, 0, -0.16, 0, 0.35, 0.3, 0.4, palette.shorts);
      box(leg, 0, -0.39, 0, 0.32, 0.24, 0.36, palette.pitchLines);
      trimParts.push(box(leg, 0, -0.3, 0, 0.33, 0.055, 0.37, palette.pitchLines));
      box(leg, 0, -0.57, 0.06, 0.37, 0.2, 0.53, palette.boots);
      box(leg, 0, -0.49, 0.22, 0.19, 0.025, 0.13, palette.pitchLines);
      group.add(leg);
      limbs.push(leg);
    }
    for (const side of [-1, 1]) {
      const arm = new Group();
      arm.position.set(side * 0.52, 1.48, 0);
      arm.rotation.z = side * 0.12;
      shirtParts.push(box(arm, 0, -0.16, 0, 0.28, 0.34, 0.32, shirt));
      trimParts.push(box(arm, 0, -0.31, 0, 0.29, 0.06, 0.33, palette.pitchLines));
      box(arm, 0, -0.44, 0, 0.22, 0.23, 0.25, palette.skin);
      const hand = new Mesh(handGeometry, material(id % 5 === 0 ? palette.keeperTrim : palette.skin));
      hand.position.y = -0.6;
      arm.add(hand);
      group.add(arm);
      limbs.push(arm);
    }
    group.traverse((object) => {
      if (object instanceof Mesh && object.geometry === cube) object.geometry = roundedCube;
    });
    actors.add(group);
    const contact = new Mesh(contactGeometry, contactMaterial);
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.07;
    scene.add(contact);
    let badge: Sprite | undefined;
    if (id % 5 === 0) {
      badge = new Sprite(keeperBadgeMaterial);
      badge.scale.set(1.4, 0.7, 1);
      scene.add(badge);
      const keeperRing = new Mesh(keeperRingGeometry, material(palette.keeperTrim));
      keeperRing.rotation.x = -Math.PI / 2;
      keeperRing.position.y = 0.09;
      group.add(keeperRing);
    }
    const marker = new Mesh(markerGeometry, material(teamColor));
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.12;
    scene.add(marker);
    return { group, limbs, marker, shirtParts, trimParts, jerseyParts, contact, badge };
  }
  const figures = Array.from({ length: 10 }, (_, id) => figure(id));
  let actorParts: ReturnType<typeof instanceParts> | undefined;
  const ballGroup = new Group();
  const ballMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });
  const ball = new Mesh(footballGeometry(), ballMaterial);
  ball.castShadow = true;
  ballGroup.add(ball);
  const ballContact = new Mesh(contactGeometry, contactMaterial);
  ballContact.rotation.x = -Math.PI / 2;
  ballContact.scale.setScalar(0.45);
  scene.add(ballContact);
  scene.add(ballGroup);
  const penaltyAim = new Group();
  const aimLine = box(penaltyAim, 0, 0.12, 0, 1, 0.035, 0.1, palette.accent);
  const aimTarget = new Mesh(new RingGeometry(0.4, 0.55, 32), material(palette.accent));
  aimTarget.rotation.x = -Math.PI / 2;
  aimTarget.position.y = 0.14;
  penaltyAim.add(aimTarget);
  penaltyAim.visible = false;
  scene.add(penaltyAim);
  let portrait = false;
  let currentWidth = 0;
  let currentHeight = 0;
  let kitSignature = '';
  let cameraFrame: ReturnType<typeof matchCameraFrame> | null = null;
  let previousTime = 0;
  let previousFrame = 0;
  let frameAverage = 1 / 60;
  let qualityTime = 0;
  let previousBall: { x: number; z: number } | undefined;

  function positionPlayer(player: Player, state: MatchState, time: number) {
    const { group, limbs, marker, contact, badge } = figures[player.id];
    const moving = Math.hypot(player.vx, player.vz) > 0.1 && state.phase === 'playing';
    const stride = moving ? Math.sin(time * 15 + player.id) * 0.52 : 0;
    group.position.set(player.x, moving ? Math.abs(stride) * 0.12 : 0, player.z);
    group.rotation.set(0, Math.atan2(player.facingX, player.facingZ), 0);
    limbs[0].rotation.x = stride;
    limbs[1].rotation.x = player.kick > 0 ? -0.9 : -stride;
    limbs[2].rotation.x = -stride * 0.7;
    limbs[3].rotation.x = stride * 0.7;
    if (player.slide > 0) {
      const tilt = Math.min(1, (SLIDE_DURATION - player.slide) / 0.08, player.slide / 0.1);
      group.rotation.x = 1.15 * tilt;
      group.position.y = 0.12;
      limbs[0].rotation.x = -0.15;
      limbs[1].rotation.x = 0.35;
      limbs[2].rotation.x = 0.9;
      limbs[3].rotation.x = 0.9;
    } else if (player.fallen > 0) {
      const tilt = Math.min(1, (FALL_DURATION - player.fallen) / 0.12, player.fallen / 0.25);
      group.rotation.x = -1.5 * tilt;
      group.position.y = 0.08 + tilt * 0.25;
      for (const limb of limbs) limb.rotation.x = 0;
    }
    marker.position.x = player.x;
    marker.position.z = player.z;
    contact.position.set(player.x, 0.07, player.z);
    if (badge) badge.position.set(player.x, 3.2, player.z);
    marker.visible = !state.watching && state.selected[player.team] === player.id && (player.team === 0 || state.mode === 'versus');
  }

  function draw(state: MatchState, time: number, preview = false) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return portrait;
    // Use wall time, independent of pause and spectator playback speed; ignore background gaps.
    const now = performance.now();
    const frameTime = (now - previousFrame) / 1000;
    previousFrame = now;
    if (!preview && frameTime > 0 && frameTime < 0.1) {
      frameAverage += (frameTime - frameAverage) * 0.05;
      qualityTime += frameTime;
      if (qualityTime > 2) {
        qualityTime = 0;
        const ratio = renderer.getPixelRatio();
        const next = frameAverage > 1 / 45 ? Math.max(0.75, ratio - 0.15) : frameAverage < 1 / 57 ? Math.min(maxPixelRatio, ratio + 0.1) : ratio;
        if (Math.abs(next - ratio) > 0.01) renderer.setPixelRatio(next);
      }
    }
    const teams = getMatchClubs(state);
    const signature = teams.map((club) => club.id).join(':');
    if (kitSignature !== signature) {
      kitSignature = signature;
      for (const player of state.players) {
        const figure = figures[player.id];
        const club = teams[player.team];
        for (const part of figure.shirtParts) part.material = material(player.role === 0 ? palette.keeper : club.shirt);
        const shirt = player.role === 0 ? palette.keeper : club.shirt;
        const trim = player.role === 0 ? palette.keeperTrim : club.trim;
        for (const part of figure.trimParts) part.material = material(trim);
        for (const part of figure.jerseyParts) part.material = kitMaterial((player.id % 5) + 1, shirt, trim);
        figure.marker.material = material(club.shirt);
      }
      actorParts?.dispose();
      actorParts = instanceParts(actors);
      scene.add(actorParts.group);
    }
    const resized = width !== currentWidth || height !== currentHeight;
    if (resized) {
      currentWidth = width;
      currentHeight = height;
      portrait = !preview && height > width;
      renderer.setSize(width, height, false);
    }
    const aspect = width / height;
    const target = matchCameraFrame(state, aspect, portrait, preview);
    const follow = 1 - Math.exp(-Math.max(0, time - previousTime) * 7);
    previousTime = time;
    if (!cameraFrame || resized) cameraFrame = target;
    else {
      cameraFrame.x += (target.x - cameraFrame.x) * follow;
      cameraFrame.z += (target.z - cameraFrame.z) * follow;
      cameraFrame.halfHeight += (target.halfHeight - cameraFrame.halfHeight) * follow;
    }
    camera.left = -cameraFrame.halfHeight * aspect;
    camera.right = cameraFrame.halfHeight * aspect;
    camera.top = cameraFrame.halfHeight;
    camera.bottom = -cameraFrame.halfHeight;
    camera.position.set(
      cameraFrame.x + (portrait ? -50 : preview ? 48 : 0),
      preview ? 130 : CAMERA_HEIGHT,
      cameraFrame.z + (portrait ? 0 : preview ? 88 : CAMERA_DEPTH),
    );
    camera.lookAt(cameraFrame.x, 0, cameraFrame.z);
    camera.updateProjectionMatrix();
    for (const player of state.players) positionPlayer(player, state, time);
    actorParts?.update();
    penaltyAim.visible = state.phase === 'penalty-ready' && state.foul?.taker !== null && !!state.foul;
    if (penaltyAim.visible && state.foul?.taker !== null && state.foul) {
      const taker = state.players[state.foul.taker];
      const targetX = attackDirection(taker.team) * FIELD.halfLength;
      const targetZ = (taker.facingZ / 0.55) * (FIELD.goalHalfWidth - 0.7);
      const dx = targetX - state.ball.x;
      aimLine.position.set((state.ball.x + targetX) / 2, 0.12, targetZ / 2);
      aimLine.scale.x = Math.hypot(dx, targetZ);
      aimLine.rotation.y = -Math.atan2(targetZ, dx);
      aimTarget.position.set(targetX, 0.14, targetZ);
    }
    ballGroup.position.set(state.ball.x, 0.42, state.ball.z);
    ballContact.position.set(state.ball.x, 0.07, state.ball.z);
    if (previousBall) {
      const dx = state.ball.x - previousBall.x;
      const dz = state.ball.z - previousBall.z;
      if (Math.hypot(dx, dz) < 5) {
        ballGroup.rotation.x += dz / 0.37;
        ballGroup.rotation.z -= dx / 0.37;
      }
    }
    previousBall = { x: state.ball.x, z: state.ball.z };
    renderer.render(scene, camera);
    canvas.dataset.rendered = 'true';
    canvas.dataset.orientation = portrait ? 'portrait' : 'landscape';
    canvas.dataset.cameraX = cameraFrame.x.toFixed(2);
    canvas.dataset.cameraZ = cameraFrame.z.toFixed(2);
    return portrait;
  }

  return {
    draw,
    get stats() {
      return { ...renderer.info.render, pixelRatio: renderer.getPixelRatio() };
    },
    dispose() {
      const geometries = new Set<Mesh['geometry']>([cube, roundedCube]);
      // The stadium and the figures stay off-scene as sources for their instanced copies.
      for (const root of [scene, stadium, actors])
        root.traverse((object) => {
          if (object instanceof Mesh) geometries.add(object.geometry);
        });
      for (const geometry of geometries) geometry.dispose();
      studs.dispose();
      staticParts.dispose();
      actorParts?.dispose();
      for (const value of materials.values()) value.dispose();
      for (const value of kitMaterials.values()) {
        value.map?.dispose();
        value.dispose();
      }
      turfMap.dispose();
      turfMaterial.dispose();
      ballMaterial.dispose();
      contactMaterial.dispose();
      contactTexture.dispose();
      faceTexture.dispose();
      faceMaterial.dispose();
      keeperTexture.dispose();
      keeperBadgeMaterial.dispose();
      sunlight.shadow.dispose();
      renderer.dispose();
    },
  };
}
