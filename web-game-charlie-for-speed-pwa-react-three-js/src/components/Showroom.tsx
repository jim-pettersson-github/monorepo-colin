import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { carById } from '../game/cars';
import { placeCar } from '../game/physics';
import { trackById } from '../game/tracks';
import { buildCarModel, type CarModel } from '../render/car-model';

type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  turntable: THREE.Group;
  model?: CarModel;
};

export function Showroom({ carId, className = 'showroom' }: { carId: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      canvas.dataset.rendered = 'unsupported';
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 2.4, 10.5);
    camera.lookAt(0, -0.35, 0);
    scene.add(new THREE.HemisphereLight('#dfe6ff', '#2a2230', 1.4));
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(4, 6, 5);
    const rim = new THREE.DirectionalLight('#ffb070', 1.6);
    rim.position.set(-5, 3, -4);
    scene.add(key, rim);

    const turntable = new THREE.Group();
    const floorGeometry = new THREE.CylinderGeometry(3.6, 3.8, 0.24, 40);
    const floorMaterial = new THREE.MeshPhongMaterial({ color: '#1c2238', shininess: 90, specular: '#5566aa' });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -0.12;
    turntable.add(floor);
    scene.add(turntable);
    stageRef.current = { renderer, scene, camera, turntable };

    const resize = () => {
      const { clientWidth, clientHeight } = canvas;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.position.z = camera.aspect < 1 ? 15 : 10.5;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      turntable.rotation.y += delta * 0.45;
      renderer.render(scene, camera);
      canvas.dataset.rendered = 'true';
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      stageRef.current?.model?.dispose();
      floorGeometry.dispose();
      floorMaterial.dispose();
      renderer.dispose();
      stageRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.model?.dispose();
    if (stage.model) stage.turntable.remove(stage.model.group);
    const model = buildCarModel(carById(carId), true);
    // A parked state at the origin, with the wheels turned slightly for character.
    const parked = { ...placeCar(trackById('vaxjo'), 0, 0), x: 0, y: 0, z: 0, yaw: 0, steer: -0.5 };
    model.update(parked, 1);
    stage.turntable.add(model.group);
    stage.model = model;
  }, [carId]);

  return <canvas ref={canvasRef} className={className} />;
}
