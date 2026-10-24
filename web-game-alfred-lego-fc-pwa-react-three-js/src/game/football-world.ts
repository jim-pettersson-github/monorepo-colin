import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  PlaneGeometry,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  WebGLRenderer,
} from 'three';
import { palette } from '../palette';
import { matchCameraFrame } from './camera';
import { getMatchClubs } from './clubs';
import type { MatchState, Player } from './model';
import { attackDirection, FALL_DURATION, FIELD, SLIDE_DURATION } from './model';

export function createFootballWorld(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
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
  function box(parent: Group | Scene, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    const mesh = new Mesh(cube, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  scene.add(new AmbientLight(0xe5f3ff, 2));
  const sunlight = new DirectionalLight(0xfff2da, 3.2);
  sunlight.position.set(-28, 70, 40);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, { left: -68, right: 68, top: 50, bottom: -50, far: 180 });
  sunlight.shadow.normalBias = 0.04;
  scene.add(sunlight);

  const stadium = new Group();
  stadium.scale.set(FIELD.scale, 1, FIELD.scale);
  scene.add(stadium);
  box(stadium, 0, -1.1, 0, 58, 1.5, 40, palette.pitchBase);
  box(stadium, 0, -0.27, 0, 56.5, 0.25, 38.5, palette.pitchEdge);
  box(stadium, 0, -0.08, 0, 48.5, 0.2, 30.5, palette.pitch);
  for (let i = 0; i < 12; i++) box(stadium, -22 + i * 4, 0.025, 0, 4, 0.03, 30, i % 2 ? palette.pitch : palette.pitchStripe);
  for (const z of [-15, 15]) {
    box(stadium, 0, 0.06, z, 48, 0.04, 0.12, palette.pitchLines);
    box(stadium, 0, 0.4, z + Math.sign(z) * 0.6, 50, 0.8, 0.35, palette.board);
    for (let i = 0; i < 8; i++) box(stadium, -21 + i * 6, 0.75, z + Math.sign(z) * 0.65, 4.9, 0.18, 0.5, i % 2 ? palette.home : palette.away);
  }
  for (const x of [-24, 0, 24]) box(stadium, x, 0.06, 0, 0.12, 0.04, 30, palette.pitchLines);
  for (const side of [-1, 1]) {
    for (const z of [-9.7, 9.7]) box(stadium, side * 24.6, 0.4, z, 0.35, 0.8, 10.8, palette.board);
    box(stadium, (side * FIELD.penaltyAreaStart) / FIELD.scale, 0.06, 0, 0.12, 0.04, (FIELD.penaltyAreaHalfWidth * 2) / FIELD.scale, palette.pitchLines);
    for (const z of [-FIELD.penaltyAreaHalfWidth / FIELD.scale, FIELD.penaltyAreaHalfWidth / FIELD.scale])
      box(stadium, side * 20.5, 0.06, z, (FIELD.halfLength - FIELD.penaltyAreaStart) / FIELD.scale, 0.04, 0.12, palette.pitchLines);
    const spot = new Mesh(new CylinderGeometry(0.19, 0.19, 0.04, 16), material(palette.pitchLines));
    spot.position.set((side * FIELD.penaltySpot) / FIELD.scale, 0.09, 0);
    stadium.add(spot);
    for (const z of [-4.1, 4.1]) {
      box(stadium, side * 24, 1.45, z, 0.22, 2.9, 0.22, palette.pitchLines);
      box(stadium, side * 25.1, 0.14, z, 2.2, 0.18, 0.18, palette.pitchLines);
    }
    box(stadium, side * 24, 2.9, 0, 0.22, 0.22, 8.4, palette.pitchLines);
    box(stadium, side * 26.1, 0.14, 0, 0.18, 0.18, 8.4, palette.pitchLines);
    for (let z = -4; z <= 4; z += 0.55) {
      const net = box(stadium, side * 25.05, 1.5, z, 0.035, 3.5, 0.035, palette.net);
      net.rotation.z = side * 0.64;
    }
    for (let h = 0.5; h < 3; h += 0.5) box(stadium, side * (26.1 - (h / 2.9) * 2.1), h, 0, 0.035, 0.035, 8.2, palette.net);
  }
  const circle = new Mesh(new RingGeometry(4, 4.12, 64), material(palette.pitchLines));
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.08;
  stadium.add(circle);

  // One instanced mesh for the studs around the baseplate.
  const studs = new InstancedMesh(new CylinderGeometry(0.28, 0.28, 0.14, 10), material(palette.pitchBase), 48);
  const matrix = new Matrix4();
  for (let i = 0; i < 48; i++) {
    matrix.makeTranslation(-27 + (i % 24) * 2.35, -0.2, i < 24 ? -19.2 : 19.2);
    studs.setMatrixAt(i, matrix);
  }
  stadium.add(studs);
  for (const side of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      box(stadium, 0, row * 0.5 + 0.15, side * (17.3 + row), 40, 0.5, 0.8, palette.stands);
      for (let i = 0; i < 20; i++)
        box(stadium, -19 + i * 2, row * 0.5 + 0.55, side * (17.3 + row), 1.4, 0.35, 0.7, (i + row) % 3 ? palette.home : palette.away);
    }
  }

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
  const faceMaterial = new MeshStandardMaterial({ map: faceTexture, roughness: 0.5 });
  const headGeometry = new CylinderGeometry(0.35, 0.35, 0.55, 12);
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
  const keeperBadgeMaterial = new SpriteMaterial({ map: keeperTexture });
  function figure(id: number) {
    const group = new Group();
    group.rotation.order = 'YXZ';
    group.scale.setScalar(1.15);
    const teamColor = id < 5 ? palette.home : palette.away;
    const shirt = id % 5 === 0 ? palette.keeper : teamColor;
    const shirtParts = [box(group, 0, 1.18, 0, 0.79, 0.73, 0.46, shirt)];
    const trimPart = box(group, 0, 1.33, 0.242, 0.15, 0.32, 0.025, palette.pitchLines);
    box(group, 0, 0.77, 0, 0.75, 0.16, 0.46, palette.shorts);
    const head = new Mesh(headGeometry, material(palette.skin));
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);
    const stud = new Mesh(headStud, material(palette.skin));
    stud.position.y = 2.19;
    group.add(stud);
    const face = new Mesh(new PlaneGeometry(0.52, 0.48), faceMaterial);
    face.position.set(0, 1.85, 0.322);
    group.add(face);
    if (id % 3 !== 0) box(group, 0, 2.1, -0.06, 0.7, 0.17, 0.54, id % 2 ? palette.hair : palette.blond);
    const limbs: Group[] = [];
    for (const side of [-1, 1]) {
      const leg = new Group();
      leg.position.set(side * 0.21, 0.75, 0);
      box(leg, 0, -0.29, 0, 0.35, 0.55, 0.4, palette.shorts);
      box(leg, 0, -0.57, 0.06, 0.37, 0.2, 0.53, palette.boots);
      group.add(leg);
      limbs.push(leg);
    }
    for (const side of [-1, 1]) {
      const arm = new Group();
      arm.position.set(side * 0.52, 1.48, 0);
      arm.rotation.z = side * 0.12;
      shirtParts.push(box(arm, 0, -0.26, 0, 0.25, 0.55, 0.3, shirt));
      const hand = new Mesh(handGeometry, material(id % 5 === 0 ? palette.keeperTrim : palette.skin));
      hand.position.y = -0.6;
      arm.add(hand);
      group.add(arm);
      limbs.push(arm);
    }
    scene.add(group);
    if (id % 5 === 0) {
      const badge = new Sprite(keeperBadgeMaterial);
      badge.position.y = 2.75;
      badge.scale.set(1.4, 0.7, 1);
      group.add(badge);
      const keeperRing = new Mesh(new RingGeometry(0.82, 0.93, 32), material(palette.keeperTrim));
      keeperRing.rotation.x = -Math.PI / 2;
      keeperRing.position.y = 0.09;
      group.add(keeperRing);
    }
    const marker = new Mesh(new RingGeometry(0.78, 0.98, 32), material(teamColor));
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.12;
    scene.add(marker);
    return { group, limbs, marker, shirtParts, trimPart };
  }
  const figures = Array.from({ length: 10 }, (_, id) => figure(id));
  const ballGroup = new Group();
  const ball = new Mesh(new SphereGeometry(0.37, 16, 12), material(palette.pitchLines));
  ball.castShadow = true;
  ballGroup.add(ball);
  for (const side of [-1, 1]) {
    box(ballGroup, side * 0.32, 0, 0, 0.08, 0.22, 0.22, palette.face);
    box(ballGroup, 0, side * 0.32, 0, 0.22, 0.08, 0.22, palette.face);
    box(ballGroup, 0, 0, side * 0.32, 0.22, 0.22, 0.08, palette.face);
  }
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

  function positionPlayer(player: Player, state: MatchState, time: number) {
    const { group, limbs, marker } = figures[player.id];
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
    marker.visible = !state.watching && state.selected[player.team] === player.id && (player.team === 0 || state.mode === 'versus');
  }

  function draw(state: MatchState, time: number, preview = false) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return portrait;
    const teams = getMatchClubs(state);
    const signature = teams.map((club) => club.id).join(':');
    if (kitSignature !== signature) {
      kitSignature = signature;
      for (const player of state.players) {
        const figure = figures[player.id];
        const club = teams[player.team];
        for (const part of figure.shirtParts) part.material = material(player.role === 0 ? palette.keeper : club.shirt);
        figure.trimPart.material = material(player.role === 0 ? palette.keeperTrim : club.trim);
        figure.marker.material = material(club.shirt);
      }
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
    camera.position.set(cameraFrame.x + (portrait ? -50 : preview ? 48 : 0), preview ? 130 : 65, cameraFrame.z + (portrait ? 0 : preview ? 88 : 44));
    camera.lookAt(cameraFrame.x, 0, cameraFrame.z);
    camera.updateProjectionMatrix();
    for (const player of state.players) positionPlayer(player, state, time);
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
    ballGroup.rotation.set(time * Math.hypot(state.ball.vx, state.ball.vz) * 0.1, 0, time * state.ball.vx * 0.1);
    renderer.render(scene, camera);
    canvas.dataset.rendered = 'true';
    canvas.dataset.orientation = portrait ? 'portrait' : 'landscape';
    canvas.dataset.cameraX = cameraFrame.x.toFixed(2);
    canvas.dataset.cameraZ = cameraFrame.z.toFixed(2);
    return portrait;
  }

  return {
    draw,
    dispose() {
      const geometries = new Set<Mesh['geometry']>();
      scene.traverse((object) => {
        if (object instanceof Mesh) geometries.add(object.geometry);
        if (object instanceof InstancedMesh) object.dispose();
      });
      for (const geometry of geometries) geometry.dispose();
      for (const value of materials.values()) value.dispose();
      faceTexture.dispose();
      faceMaterial.dispose();
      keeperTexture.dispose();
      keeperBadgeMaterial.dispose();
      sunlight.shadow.dispose();
      renderer.dispose();
    },
  };
}
