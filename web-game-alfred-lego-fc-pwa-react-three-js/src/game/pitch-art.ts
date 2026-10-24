import { BufferGeometry, CanvasTexture, Float32BufferAttribute, IcosahedronGeometry, SRGBColorSpace, Vector3 } from 'three';
import { palette } from '../palette';

function painted(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  draw(context);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

export function pitchTexture() {
  return painted(1536, 960, (ctx) => {
    ctx.fillStyle = palette.pitch;
    ctx.fillRect(0, 0, 1536, 960);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? palette.pitch : palette.pitchStripe;
      ctx.fillRect(i * 128, 0, 128, 960);
    }
    let seed = 37;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 110000; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(227,239,166,0.035)' : 'rgba(12,49,31,0.045)';
      ctx.fillRect(random() * 1536, random() * 960, 0.6 + random(), 1 + random() * 3);
    }
    ctx.scale(32, 32);
    ctx.translate(24, 15);
    ctx.strokeStyle = palette.pitchLines;
    ctx.fillStyle = palette.pitchLines;
    ctx.lineWidth = 0.12;
    ctx.strokeRect(-23.94, -14.94, 47.88, 29.88);
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(0, 15);
    ctx.stroke();
    const circle = (x: number, z: number, radius: number, fill = false) => {
      ctx.beginPath();
      ctx.arc(x, z, radius, 0, Math.PI * 2);
      if (fill) ctx.fill();
      else ctx.stroke();
    };
    circle(0, 0, 4);
    circle(0, 0, 0.15, true);
    for (const side of [-1, 1]) {
      ctx.strokeRect(side < 0 ? -24 : 17, -7, 7, 14);
      ctx.strokeRect(side < 0 ? -24 : 21.2, -4.7, 2.8, 9.4);
      circle(side * 18, 0, 0.19, true);
      for (const z of [-15, 15]) circle(side * 24, z, 0.7);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-17, -10, 34, 20);
      ctx.clip();
      circle(side * 18, 0, 3.3);
      ctx.restore();
    }
  });
}

export function kitTexture(number: number, shirt: string, trim: string) {
  return painted(128, 128, (ctx) => {
    ctx.fillStyle = shirt;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 8, 128);
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(64, 22);
    ctx.lineTo(94, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(0, 115, 128, 7);
    ctx.beginPath();
    ctx.arc(100, 32, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(number), 64, 96);
  });
}

// Truncate an icosahedron into twelve black pentagons and twenty ivory hexagons.
export function footballGeometry() {
  const ico = new IcosahedronGeometry(1, 0);
  const source = ico.attributes.position;
  const vertices: Vector3[] = [];
  const faces: number[][] = [];
  for (let i = 0; i < source.count; i += 3) {
    const face: number[] = [];
    for (let j = 0; j < 3; j++) {
      const v = new Vector3().fromBufferAttribute(source, i + j);
      let index = vertices.findIndex((entry) => entry.distanceToSquared(v) < 0.00001);
      if (index < 0) index = vertices.push(v) - 1;
      face.push(index);
    }
    faces.push(face);
  }
  ico.dispose();
  const positions: number[] = [];
  const colors: number[] = [];
  const edge = (a: number, b: number) =>
    vertices[a]
      .clone()
      .lerp(vertices[b], 1 / 3)
      .normalize()
      .multiplyScalar(0.37);
  const polygon = (points: Vector3[], shade: number) => {
    const center = points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(points.length);
    if (points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).dot(center) < 0) points.reverse();
    for (let i = 0; i < points.length; i++) {
      for (const p of [center, points[i], points[(i + 1) % points.length]]) {
        positions.push(p.x, p.y, p.z);
        colors.push(shade, shade, shade);
      }
    }
  };
  for (const [a, b, c] of faces) polygon([edge(a, b), edge(b, a), edge(b, c), edge(c, b), edge(c, a), edge(a, c)], 0.88);
  vertices.forEach((vertex, index) => {
    const neighbours = [...new Set(faces.filter((face) => face.includes(index)).flat())].filter((other) => other !== index);
    const up = vertex.clone().normalize();
    const tangent = edge(index, neighbours[0]).sub(vertex).projectOnPlane(up).normalize();
    const across = up.clone().cross(tangent);
    const points = neighbours.map((other) => edge(index, other));
    points.sort((a, b) => Math.atan2(a.dot(across), a.dot(tangent)) - Math.atan2(b.dot(across), b.dot(tangent)));
    polygon(points, 0.025);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
