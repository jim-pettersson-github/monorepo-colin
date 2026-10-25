import * as THREE from 'three';
import type { CarSpec } from '../game/cars';
import type { BodyShape } from './car-body';
import type { CarDesign } from './car-designs';
import { svLiveryTexture } from './car-textures';

type Panel = [number, number][];
type Context = {
  spec: CarSpec;
  design: CarDesign;
  shape: BodyShape;
  add: (
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    x?: number,
    y?: number,
    z?: number,
    rx?: number,
    ry?: number,
    rz?: number,
  ) => THREE.Mesh;
  rounded: (
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx?: number,
    rz?: number,
    radius?: number,
  ) => THREE.Mesh;
  sidePatch: (side: number, outline: Panel, material?: THREE.Material, lift?: number) => THREE.Mesh;
  hoodPatch: (outline: Panel, material: THREE.Material, lift?: number, bulge?: number) => THREE.Mesh;
  rearPanel: (x: number, y: number, w: number, h: number, material: THREE.Material, lift?: number) => void;
  materials: Record<'paint' | 'black' | 'chrome' | 'head' | 'trim' | 'tail' | 'amber', THREE.Material>;
  registerMaterial: (material: THREE.Material) => void;
  lampCentres: THREE.Vector3[];
};

// The extra geometry is used exclusively by the three cars with supplementary user references.
export function addFavoriteDetails(ctx: Context): THREE.Texture | undefined {
  const { spec, design, shape, add, rounded, sidePatch, hoodPatch, rearPanel, materials: m } = ctx;
  const { length: l, width: w } = spec;
  const tube = (points: THREE.Vector3[], radius = 0.006, material = m.black) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), Math.max(12, points.length * 2), radius, 4, false), material);
  const pod = (x: number, width: number, front: number, rear: number, frontY: number, rearY: number, height: number) => {
    const profile = new THREE.Shape();
    profile.moveTo(front, frontY);
    profile.lineTo(front, frontY + height);
    profile.quadraticCurveTo((front + rear) / 2, Math.max(frontY, rearY) + height, rear, rearY + height * 0.35);
    profile.lineTo(rear, rearY);
    profile.closePath();
    const geometry = new THREE.ExtrudeGeometry(profile, {
      depth: width,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 2,
      curveSegments: 6,
    });
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(width / 2, 0, 0);
    add(geometry, m.paint, x);
    rounded(width * 0.73, height * 0.65, 0.014, m.black, x, frontY + height * 0.53, front + 0.015, 0, 0, 0.008);
  };
  const engineCover = (front: number, rear: number, width: number, slats: number) => {
    hoodPatch(
      [
        [-width / 2, rear],
        [width / 2, rear],
        [width / 2, front],
        [-width / 2, front],
      ],
      m.black,
      0.004,
    );
    for (let i = 0; i < slats; i++) {
      const z = THREE.MathUtils.lerp(rear, front, (i + 0.5) / slats);
      rounded(width * 0.98, 0.017, ((front - rear) / slats) * 0.48, m.paint, 0, shape.surface(z, 0.25) + 0.015, z, 0.08, 0, 0.006);
    }
  };
  const windowPoint = (side: number, u: number, height: number) => {
    const cabin = shape.cabin(u * l);
    return new THREE.Vector3(
      side * (THREE.MathUtils.lerp(cabin.baseWidth, cabin.roofWidth, height * 0.85) + 0.007),
      THREE.MathUtils.lerp(cabin.base, cabin.roof, height),
      u * l,
    );
  };

  if (spec.id === 'countach') {
    for (const side of [-1, 1]) {
      const front = -l * 0.17,
        rear = -l * 0.315;
      pod(side * (w / 2 - 0.19), 0.28, front, rear, 0.825, 0.87, 0.135);
      add(new THREE.PlaneGeometry(0.34, 0.095), m.black, side * (w / 2 - 0.044), 0.901, -l * 0.245, 0, (side * Math.PI) / 2);
      for (let i = 0; i < 3; i++) {
        const y = 0.21 + i * 0.052;
        sidePatch(
          side,
          [
            [l * 0.17, y],
            [-l * 0.19, y + 0.025],
            [-l * 0.19, y + 0.038],
            [l * 0.17, y + 0.013],
          ],
          m.black,
          0.006,
        );
        sidePatch(
          side,
          [
            [l * 0.17, y + 0.014],
            [-l * 0.19, y + 0.039],
            [-l * 0.19, y + 0.054],
            [l * 0.17, y + 0.029],
          ],
          m.paint,
          0.016,
        );
      }
      // The Countach's lower opening window is a characteristic part of its angular side glass.
      tube(
        Array.from({ length: 18 }, (_, i) => windowPoint(side, THREE.MathUtils.lerp(-0.065, 0.25, i / 17), 0.35)),
        0.007,
      );
      tube([windowPoint(side, 0.045, 0.04), windowPoint(side, 0.045, 0.35)], 0.007);
      const ventZ = -l * 0.36;
      for (let i = 0; i < 4; i++)
        sidePatch(
          side,
          [
            [ventZ + i * 0.045, 0.67],
            [ventZ + i * 0.045 - 0.02, 0.67],
            [ventZ + i * 0.045 - 0.02, 0.8],
            [ventZ + i * 0.045, 0.8],
          ],
          m.black,
          0.008,
        );
    }
    engineCover(-l * 0.29, -l * 0.45, w * 0.45, 9);
  }

  if (spec.id === 'diablo') {
    for (const side of [-1, 1]) {
      sidePatch(
        side,
        [
          [-l * 0.105, 0.57],
          [-l * 0.215, 0.61],
          [-l * 0.22, 0.3],
          [-l * 0.14, 0.29],
        ],
        m.black,
        0.009,
      );
      sidePatch(
        side,
        [
          [-l * 0.12, 0.77],
          [-l * 0.21, 0.83],
          [-l * 0.215, 0.72],
          [-l * 0.16, 0.65],
        ],
        m.black,
        0.008,
      );
      const z0 = -l * 0.015,
        z1 = -l * 0.105;
      pod(side * 0.31, 0.18, z0, z1, shape.cabin(z0).roof - 0.005, shape.cabin(z1).roof - 0.005, 0.075);
      const filler = new THREE.CircleGeometry(0.049, 24);
      add(filler, m.chrome, side * (shape.flank(-l * 0.31, 0.79) + 0.006), 0.79, -l * 0.31, 0, (side * Math.PI) / 2);
    }
    engineCover(-l * 0.29, -l * 0.445, w * 0.49, 10);
    const map = svLiveryTexture();
    const decal = new THREE.MeshStandardMaterial({ map, alphaTest: 0.4, roughness: 0.5 });
    ctx.registerMaterial(decal);
    for (const side of [-1, 1])
      sidePatch(
        side,
        [
          [l * 0.16, 0.74],
          [-l * 0.22, 0.74],
          [-l * 0.22, 0.43],
          [l * 0.16, 0.43],
        ],
        decal,
        0.012,
      );
    return map;
  }

  if (spec.id === 'clkgtr') {
    for (const side of [-1, 1]) {
      sidePatch(
        side,
        [
          [l * 0.19, 0.43],
          [l * 0.08, 0.45],
          [l * 0.07, 0.17],
          [l * 0.18, 0.16],
        ],
        m.black,
        0.01,
      );
      sidePatch(
        side,
        [
          [-l * 0.12, 0.68],
          [-l * 0.205, 0.76],
          [-l * 0.215, 0.54],
          [-l * 0.145, 0.5],
        ],
        m.black,
        0.009,
      );
      for (const y of [0.23, 0.29])
        sidePatch(
          side,
          [
            [l * 0.06, y],
            [-l * 0.2, y],
            [-l * 0.2, y + 0.012],
            [l * 0.06, y + 0.012],
          ],
          m.trim,
          0.011,
        );
      const z = -l * 0.4;
      for (let i = 0; i < 4; i++)
        sidePatch(
          side,
          [
            [z + i * 0.045, 0.66],
            [z + i * 0.045 - 0.018, 0.66],
            [z + i * 0.045 - 0.018, 0.78],
            [z + i * 0.045, 0.78],
          ],
          m.black,
          0.009,
        );
      // Stacked rear strips and the large exhaust openings read from the chase camera.
      const x = side * w * 0.31,
        y = 0.615;
      rearPanel(x, y, 0.46, 0.18, m.black, 0.008);
      rearPanel(x, y, 0.43, 0.15, m.tail, 0.012);
      for (const offset of [-0.035, 0.025]) rearPanel(x, y + offset, 0.43, 0.009, m.black, 0.014);
      rearPanel(x - side * 0.1, y - 0.04, 0.15, 0.028, m.head, 0.015);
      rearPanel(x + side * 0.13, y + 0.035, 0.12, 0.025, m.amber, 0.015);
      ctx.lampCentres.push(new THREE.Vector3(x, y, shape.bumperZ(x, y, -1) - 0.035));
    }
    const plan = new THREE.Shape();
    const nose = l / 2;
    const outline: Panel = [
      [-w * 0.48, nose - 0.33],
      [-w * 0.49, nose - 0.08],
      [-w * 0.41, nose + 0.015],
      [w * 0.41, nose + 0.015],
      [w * 0.49, nose - 0.08],
      [w * 0.48, nose - 0.33],
    ];
    outline.forEach(([x, z], i) => {
      if (i) plan.lineTo(x, -z);
      else plan.moveTo(x, -z);
    });
    plan.closePath();
    const splitter = new THREE.ExtrudeGeometry(plan, { depth: 0.021, bevelEnabled: false });
    splitter.rotateX(-Math.PI / 2);
    add(splitter, m.black, 0, (design.rideHeight ?? 0.105) - 0.02);
  }
  return undefined;
}
