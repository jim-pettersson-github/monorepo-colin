import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Same camera, paint and lighting for a useful silhouette comparison; CFS_CAPTURE_CAR makes a close-up.
const destination = new URL('../test-results/', import.meta.url);
await mkdir(destination, { recursive: true });
const html = `<!doctype html><html><head><style>
body{margin:0;background:#dce3eb;color:#253047;font-family:Arial}canvas{display:block}
#labels{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,480px);grid-auto-rows:250px;pointer-events:none}
article{padding:16px 20px;font-size:18px;font-weight:bold}small{display:block;font-size:12px;opacity:.65;margin-top:4px}
</style></head><body><canvas></canvas><div id="labels"></div><script type="module">
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {buildCarModel} from '/src/render/car-model.ts';
import {cars,carName} from '/src/game/cars.ts';
const params=new URLSearchParams(location.search),neutral=params.has('gray'),side=params.has('side'),rear=params.has('rear'),hero=params.get('car'),night=params.has('night');
const roster=hero?cars.filter(car=>car.id===hero):cars;
const cellWidth=hero?960:480,cellHeight=hero?600:250,columns=hero?1:3;
const width=columns*cellWidth,height=Math.ceil(roster.length/columns)*cellHeight;
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});
renderer.setSize(width,height);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const scene=new THREE.Scene();scene.background=new THREE.Color('#dce3eb');
const generator=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),studio=generator.fromScene(room,.04);
scene.environment=studio.texture;generator.dispose();room.dispose();
scene.add(new THREE.HemisphereLight('#ffffff','#6f7788',2));
const sun=new THREE.DirectionalLight('#ffffff',3);sun.position.set(3,6,5);scene.add(sun);
const camera=new THREE.PerspectiveCamera(32,cellWidth/cellHeight,.1,100);
camera.position.set(...(side?[8,1.9,.01]:rear?[6,2.6,-7]:hero?[5.8,2.5,6.7]:[6,3.1,7]));camera.lookAt(0,.55,0);
const labels=document.querySelector('#labels');labels.style.gridTemplateColumns='repeat('+columns+','+cellWidth+'px)';labels.style.gridAutoRows=cellHeight+'px';
renderer.setScissorTest(true);window.carMetrics=[];
for(const [i,car]of roster.entries()){
 const model=buildCarModel(neutral?{...car,color:'#a4aebe',trim:'#343c49',stripe:undefined}:car,night);scene.add(model.group);
 const x=i%columns*cellWidth,y=height-(Math.floor(i/columns)+1)*cellHeight;
 renderer.setViewport(x,y,cellWidth,cellHeight);renderer.setScissor(x,y,cellWidth,cellHeight);
 model.setDistance(100);renderer.render(scene,camera);const distant={...renderer.info.render};
 model.setDistance(0);renderer.render(scene,camera);const detailed={...renderer.info.render};
 window.carMetrics.push({id:car.id,detailed:{calls:detailed.calls,triangles:detailed.triangles},distant:{calls:distant.calls,triangles:distant.triangles}});
 scene.remove(model.group);model.dispose();
 const label=document.createElement('article');label.textContent=carName(car);
 const sub=document.createElement('small');sub.textContent=neutral?'SAME PAINT · BODY SHAPE COMPARISON':car.blurb;
 label.append(sub);labels.append(label);
}
document.body.dataset.ready='true';
</script></body></html>`;
await writeFile(new URL('car-lineup.html', destination), html);
const browser = await chromium.launch({ headless: true, args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1250 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const selected = process.env.CFS_CAPTURE_CAR;
  if (selected) await page.setViewportSize({ width: 960, height: 600 });
  for (const [query, file] of [
    ['?gray', 'cars-grey.png'],
    ['?gray&side', 'cars-profiles.png'],
    ['', 'cars-colour.png'],
    ['?rear', 'cars-rear.png'],
    ['?night', 'cars-headlights.png'],
  ]) {
    const suffix = selected ? `${query ? '&' : '?'}car=${encodeURIComponent(selected)}` : '';
    await page.goto(`http://127.0.0.1:${process.env.CFS_DEV_PORT || 4014}/test-results/car-lineup.html${query}${suffix}`);
    await page.waitForSelector('body[data-ready=true]');
    const name = selected ? `${selected}-${file}` : file;
    await page.screenshot({ fullPage: true, path: new URL(name, destination).pathname.replace(/^\/(?=[A-Za-z]:)/, '') });
    if (query === '?gray')
      await writeFile(
        new URL(selected ? `${selected}-car-metrics.json` : 'car-metrics.json', destination),
        JSON.stringify(await page.evaluate(() => window.carMetrics), null, 2),
      );
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Saved front, side, rear and material comparisons plus draw budgets in test-results/.');
} finally {
  await browser.close();
}
