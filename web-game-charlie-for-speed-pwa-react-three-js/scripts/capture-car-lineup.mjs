import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Development-only shape review: one renderer, identical lighting and framing for every car.
const destination = new URL('../test-results/', import.meta.url);
await mkdir(destination, { recursive: true });
const html =
  "<!doctype html><html><head><style>body{margin:0;background:#dce3eb;color:#253047;font-family:Arial}canvas{display:block}#labels{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,480px);grid-auto-rows:250px;pointer-events:none}article{padding:16px 20px;font-size:18px;font-weight:bold}small{display:block;font-size:12px;opacity:.65;margin-top:4px}</style></head><body><canvas id=\"view\"></canvas><div id=\"labels\"></div><script type=\"module\">\nimport * as THREE from 'three';\nimport {RoomEnvironment}from'three/examples/jsm/environments/RoomEnvironment.js';\nimport{buildCarModel}from'/src/render/car-model.ts';\nimport{cars,carName}from'/src/game/cars.ts';\nconst params=new URLSearchParams(location.search),neutral=params.has('gray'),side=params.has('side');\nconst renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,1250);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;\nconst scene=new THREE.Scene();scene.background=new THREE.Color('#dce3eb');\nconst generator=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),studio=generator.fromScene(room,.04);scene.environment=studio.texture;generator.dispose();room.dispose();\nscene.add(new THREE.HemisphereLight('#ffffff','#6f7788',2));const sun=new THREE.DirectionalLight('#ffffff',3);sun.position.set(3,6,5);scene.add(sun);\nconst camera=new THREE.PerspectiveCamera(32,480/250,.1,100);camera.position.set(...(side?[8,1.9,.01]:[6,3.1,7]));camera.lookAt(0,.55,0);\nrenderer.setScissorTest(true);\nfor(const [i,car]of cars.entries()){\n const model=buildCarModel(neutral?{...car,color:'#a4aebe',trim:'#343c49',stripe:undefined}:car,false);scene.add(model.group);\n const x=i%3*480,y=1250-(Math.floor(i/3)+1)*250;renderer.setViewport(x,y,480,250);renderer.setScissor(x,y,480,250);renderer.render(scene,camera);scene.remove(model.group);model.dispose();\n const label=document.createElement('article');label.textContent=carName(car);const sub=document.createElement('small');sub.textContent=neutral?'SAME PAINT · BODY SHAPE COMPARISON':car.blurb;label.append(sub);document.querySelector('#labels').append(label);\n}\ndocument.body.dataset.ready='true';\n</script></body></html>";
await writeFile(new URL('car-lineup.html', destination), html);
const browser = await chromium.launch({ headless: true, args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1250 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [query, file] of [
    ['?gray', 'cars-grey.png'],
    ['?gray&side', 'cars-profiles.png'],
    ['', 'cars-colour.png'],
  ]) {
    await page.goto(`http://127.0.0.1:4014/test-results/car-lineup.html${query}`);
    await page.waitForSelector('body[data-ready=true]');
    await page.screenshot({ path: new URL(file, destination).pathname.replace(/^\/(?=[A-Za-z]:)/, '') });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Saved car shape comparisons in test-results/.');
} finally {
  await browser.close();
}
