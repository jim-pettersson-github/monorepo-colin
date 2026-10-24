import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Review every character using the same framing, at both portrait and track sizes.
const destination = new URL('../test-results/', import.meta.url);
await mkdir(destination, { recursive: true });
const html = `<!doctype html><html><head><style>
body{margin:0;background:#eee9df;font-family:system-ui;color:#302a44}canvas{display:block}
</style></head><body><canvas width="1200" height="1120"></canvas><script type="module">
import{characters}from'/src/game/model.ts';import{drawCharacter}from'/src/game/characters.ts';
const canvas=document.querySelector('canvas'),c=canvas.getContext('2d');
for(const [i,char]of characters.entries()){
 const x=i%5*240,y=Math.floor(i/5)*280;
 c.fillStyle='#faf7ef';c.beginPath();c.roundRect(x+8,y+8,224,264,16);c.fill();
 const g=c.createRadialGradient(x+120,y+130,2,x+120,y+130,100);g.addColorStop(0,char.color+'50');g.addColorStop(1,char.color+'00');c.fillStyle=g;c.fillRect(x+10,y+10,220,220);
 c.fillStyle='#52425a24';c.beginPath();c.ellipse(x+120,y+210,40,7,0,0,Math.PI*2);c.fill();
 drawCharacter(c,char.id,x+120,y+204,1.65,0.7);
 c.textAlign='center';c.fillStyle='#302a44';c.font='bold 17px system-ui';c.fillText(char.name,x+120,y+239);
 c.fillStyle='#786f80';c.font='12px system-ui';c.fillText(char.film,x+120,y+259);
}
document.body.dataset.ready='true';
</script></body></html>`;
await writeFile(new URL('character-lineup.html', destination), html);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1120 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4016/test-results/character-lineup.html');
  await page.waitForSelector('body[data-ready=true]');
  await page.screenshot({ path: new URL('characters-lineup.png', destination).pathname.replace(/^\/(?=[A-Za-z]:)/, '') });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Saved test-results/characters-lineup.png');
} finally {
  await browser.close();
}
