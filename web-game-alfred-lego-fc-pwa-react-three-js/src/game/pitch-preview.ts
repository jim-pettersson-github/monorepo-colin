import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  RingGeometry,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three';
import { palette } from '../palette';

// A static rendering check for the foundation. Match rules and player models come later.
export function createPitchPreview(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  scene.background = new Color(palette.surface);
  const camera = new OrthographicCamera(-20, 20, 16, -16, 0.1, 150);
  camera.position.set(28, 38, 34);
  camera.lookAt(0, 0, 0);

  scene.add(new AmbientLight(0xffffff, 2));
  const sunlight = new DirectionalLight(0xfff2da, 3);
  sunlight.position.set(-10, 28, 14);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, far: 80 });
  sunlight.shadow.normalBias = 0.05;
  scene.add(sunlight);

  const pitch = new Group();
  scene.add(pitch);

  function box(x: number, y: number, z: number, width: number, height: number, depth: number, color: string) {
    const mesh = new Mesh(new BoxGeometry(width, height, depth), new MeshStandardMaterial({ color, roughness: 0.65 }));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pitch.add(mesh);
    return mesh;
  }

  box(0, -0.9, 0, 33, 1.5, 23, palette.pitchBase);
  box(0, -0.05, 0, 32, 0.3, 22, palette.pitch);
  for (let stripe = 0; stripe < 8; stripe++) {
    box(-14 + stripe * 4, 0.11, 0, 4, 0.02, 22, stripe % 2 ? palette.pitch : palette.pitchStripe);
  }

  const lineColor = palette.pitchLines;
  for (const z of [-9, 9]) box(0, 0.15, z, 28, 0.03, 0.1, lineColor);
  for (const x of [-14, 0, 14]) box(x, 0.15, 0, 0.1, 0.03, 18, lineColor);
  for (const side of [-1, 1]) {
    box(side * 10, 0.15, 0, 0.1, 0.03, 10, lineColor);
    for (const z of [-5, 5]) box(side * 12, 0.15, z, 4, 0.03, 0.1, lineColor);
    for (const z of [-3, 3]) {
      box(side * 14, 1.3, z, 0.18, 2.6, 0.18, lineColor);
      box(side * 15.7, 0.2, z, 0.14, 0.2, 0.14, lineColor);
      box(side * 14.85, 0.2, z, 1.7, 0.14, 0.14, lineColor);
    }
    box(side * 14, 2.6, 0, 0.18, 0.18, 6.2, lineColor);
    box(side * 15.7, 0.2, 0, 0.14, 0.14, 6.2, lineColor);
    for (let z = -3; z <= 3; z += 0.5) {
      const net = box(side * 14.85, 1.4, z, 0.035, 2.95, 0.035, lineColor);
      net.rotation.z = side * 0.61;
    }
    for (let i = -6; i <= 6; i++) {
      const stud = new Mesh(new CylinderGeometry(0.24, 0.24, 0.17, 12), new MeshStandardMaterial({ color: palette.pitchBase }));
      stud.position.set(i * 2.4, -0.05, side * 11.1);
      pitch.add(stud);
    }
  }

  const circle = new Mesh(new RingGeometry(2.6, 2.7, 64), new MeshStandardMaterial({ color: lineColor }));
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.18;
  pitch.add(circle);

  const ball = new Mesh(new SphereGeometry(0.38, 16, 12), new MeshStandardMaterial({ color: lineColor, roughness: 0.5 }));
  ball.position.set(0, 0.55, 0);
  ball.castShadow = true;
  pitch.add(ball);

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(15, 24 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
    canvas.dataset.rendered = 'true';
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return () => {
    observer.disconnect();
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
    sunlight.shadow.dispose();
    renderer.dispose();
  };
}
