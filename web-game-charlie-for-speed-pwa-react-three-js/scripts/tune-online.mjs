import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

// Reproduce the online calibration without a browser, using an identical solo AI driver on all six tracks.
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, entries: [] },
  appType: 'custom',
  logLevel: 'error',
});
try {
  const { cars, arcadeSpec, arcadeTrim } = await server.ssrLoadModule('/src/game/cars.ts');
  const { createRace, stepRace } = await server.ssrLoadModule('/src/game/race.ts');
  const { trackDefs } = await server.ssrLoadModule('/src/game/tracks.ts');
  const write = process.argv.includes('--write');
  const trims = write ? Object.fromEntries(cars.map((car) => [car.id, 1])) : { ...arcadeTrim };
  const idle = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  let results = [];
  for (let round = 0; round < (write ? 6 : 1); round++) {
    results = cars.map((car) => ({ id: car.id, times: [] }));
    for (const track of trackDefs) {
      for (const [index, car] of cars.entries()) {
        const race = createRace({ trackId: track.id, carId: car.id, laps: 2, difficulty: 'normal', transmission: 'auto' }, 7, [
          { driverName: 'Kalibrering', spec: arcadeSpec(car, trims), skill: 1, isPlayer: false },
        ]);
        for (let tick = 0; tick < 120 * 260 && !race.player.finishTime; tick++) stepRace(race, idle);
        if (!race.player.finishTime || !Number.isFinite(race.player.bestLap) || !race.player.bestLap) throw Error(`No valid lap: ${car.id} / ${track.id}`);
        results[index].times.push(race.player.bestLap);
      }
    }
    const means = trackDefs.map((_, index) => results.reduce((sum, result) => sum + result.times[index], 0) / results.length);
    const scores = results.map((result) => result.times.reduce((sum, time, index) => sum + time / means[index], 0) / trackDefs.length);
    const spread = (Math.max(...scores) - Math.min(...scores)) * 100;
    console.log(`Round ${round + 1}: mean lap spread ${spread.toFixed(2)}%`);
    if (!write || spread < 0.25 || round === 5) break;
    results.forEach((result, index) => {
      trims[result.id] = Math.max(0.94, Math.min(1.06, (trims[result.id] ?? 1) * scores[index] ** 1.6));
    });
  }
  const summary = trackDefs.map((track, index) => {
    const times = results.map((result) => result.times[index]);
    return {
      track: track.id,
      fastest: +Math.min(...times).toFixed(2),
      slowest: +Math.max(...times).toFixed(2),
      spreadPercent: +((Math.max(...times) / Math.min(...times) - 1) * 100).toFixed(2),
    };
  });
  console.table(summary);
  if (write) {
    const values = Object.entries(trims).map(([id, value]) => `  ${id}: ${+value.toFixed(5)},`);
    await writeFile(
      'src/game/online-trims.ts',
      `// Measured by node scripts/tune-online.mjs --write across all six tracks.\nexport const onlineTrims: Record<string, number> = {\n${values.join('\n')}\n};\n`,
    );
  }
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/online-balance.json', JSON.stringify({ summary, results, trims }, null, 2));
} finally {
  await server.close();
}
