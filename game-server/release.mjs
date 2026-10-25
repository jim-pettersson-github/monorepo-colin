// npm run release: redeploys games.charliecare.se from this computer, on the home network or Tailscale.
// Dokploy builds the stack from origin/main, so the script first checks that game-server/ is pushed,
// then deploys through Dokploy's API, waits for the build, and checks the live API and relay.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const SITE = 'https://games.charliecare.se';
const COMPOSE_ID = '5eI3seglgGND2zmfzcAWD'; // Dokploy project "games", stack "game-server"
const SSH_HOST = 'jim@192.168.1.221';

function env() {
  let text = '';
  try {
    text = readFileSync(new URL('.env', here), 'utf8');
  } catch {
    // Values may also come from the shell.
  }
  const file = Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
  return (name, fallback) => process.env[name] || file[name] || fallback;
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: here, encoding: 'utf8' }).trim();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const setting = env();
const url = setting('DOKPLOY_URL', 'http://192.168.1.221:3000').replace(/\/$/, '');
const key = setting('DOKPLOY_API_KEY');
if (!key) fail('DOKPLOY_API_KEY is missing. Put it in game-server/.env (see .env.example).');

async function api(path, body) {
  const response = await fetch(`${url}/api/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  }).catch((error) => fail(`Dokploy at ${url} did not answer (${error.message}). Are you on the home network or Tailscale?`));
  if (!response.ok) fail(`Dokploy ${path} answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

// 1. Dokploy builds what is on GitHub, so a local change that is not pushed would silently not ship.
console.log('Checking that game-server/ is committed and pushed…');
if (git('status', '--porcelain', '--', '.')) fail('game-server/ has uncommitted changes. Commit and push them first.');
git('fetch', '--quiet', 'origin', 'main');
try {
  git('diff', '--quiet', 'origin/main', '--', '.');
} catch {
  fail('game-server/ differs from origin/main. Push your commits first: Dokploy builds from GitHub.');
}
const commit = git('rev-parse', '--short', 'origin/main');

// 2. Deploy and wait for the new deployment to finish.
const before = (await api(`compose.one?composeId=${COMPOSE_ID}`)).deployments?.[0]?.deploymentId;
await api('compose.deploy', { composeId: COMPOSE_ID });
console.log(`Deploying origin/main (${commit}) through Dokploy…`);
const started = Date.now();
let deployment;
while (Date.now() - started < 10 * 60_000) {
  await wait(5_000);
  const latest = (await api(`compose.one?composeId=${COMPOSE_ID}`)).deployments?.[0];
  if (latest && latest.deploymentId !== before && latest.status !== 'running') {
    deployment = latest;
    break;
  }
  process.stdout.write('.');
}
console.log();
if (!deployment) fail('The deployment did not finish within ten minutes. Check it in Dokploy.');
if (deployment.status !== 'done') {
  try {
    console.error(execFileSync('ssh', ['-o', 'BatchMode=yes', SSH_HOST, `tail -n 40 '${deployment.logPath}'`], { encoding: 'utf8' }));
  } catch {
    console.error(`(Could not read the build log over SSH: ${deployment.logPath})`);
  }
  fail(`The deployment ended as "${deployment.status}". The build log is above.`);
}
console.log(`Built and started in ${Math.round((Date.now() - started) / 1000)} s.`);

// 3. The new container needs a passing health check before Traefik routes to it.
console.log(`Checking ${SITE}…`);
let health;
for (let attempt = 0; attempt < 24; attempt++) {
  health = await fetch(`${SITE}/api.php?a=health`, { signal: AbortSignal.timeout(10_000) })
    .then((response) => (response.ok ? response.json() : undefined))
    .catch(() => undefined);
  if (health?.ok) break;
  await wait(5_000);
}
if (!health?.ok) fail(`${SITE} does not answer after the deployment.`);
if (!health.relay) fail('The server answers, but its relay is off: is GAMES_TURN_SECRET set in Dokploy?');
const ice = await (await fetch(`${SITE}/api.php?a=ice`)).json();
const relays = ice.iceServers.filter((server) => server.username).flatMap((server) => server.urls);
if (!relays.length) fail('The server hands out no relay addresses.');

console.log(`✓ Released ${commit}: PHP ${health.php}, ${health.rooms} open rooms, relay ${relays.join(', ')}`);
