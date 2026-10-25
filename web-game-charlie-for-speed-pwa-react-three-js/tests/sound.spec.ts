import { expect, test } from '@playwright/test';

test('volume persists, mute is silent, pause suspends audio and exiting releases its context', async ({ page }) => {
  await page.addInitScript(() => {
    const probe = { contexts: [] as AudioContext[], outputs: [] as GainNode[] };
    Object.assign(window, { soundProbe: probe });
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.contexts.push(this);
      }
    };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (this: AudioNode, destination: AudioNode | AudioParam, output = 0, input = 0) {
      if (this instanceof GainNode && destination instanceof AudioDestinationNode) probe.outputs.push(this);
      return Reflect.apply(connect, this, destination instanceof AudioNode ? [destination, output, input] : [destination, output]);
    } as typeof connect;
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button', { name: 'Inställningar' }).click();
  const volume = page.getByRole('slider', { name: /Ljudvolym/ });
  await volume.press('Home');
  for (let i = 0; i < 7; i++) await volume.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('charlie-for-speed:settings') ?? '{}').volume)).toBe(0.35);
  await page.reload();
  await page.getByRole('button', { name: 'Inställningar' }).click();
  await expect(volume).toHaveValue('35');
  await page.getByRole('button', { name: 'Stäng', exact: true }).click();
  await page.getByRole('button', { name: /Snabbstart/ }).click();
  const audioState = () =>
    page.evaluate(() => {
      const probe = (window as unknown as { soundProbe: { contexts: AudioContext[]; outputs: GainNode[] } }).soundProbe;
      return { state: probe.contexts.at(-1)?.state, gain: probe.outputs.at(-1)?.gain.value ?? -1 };
    });
  await expect.poll(async () => (await audioState()).state).toBe('running');
  await expect.poll(async () => (await audioState()).gain).toBeCloseTo(0.35 * 0.75, 2);
  await page.keyboard.press('m');
  await expect.poll(async () => (await audioState()).gain).toBeLessThan(0.001);
  await page.keyboard.press('m');
  await expect.poll(async () => (await audioState()).gain).toBeCloseTo(0.35 * 0.75, 2);
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();
  await expect.poll(async () => (await audioState()).state).toBe('suspended');
  await volume.press('Home');
  await volume.press('ArrowRight');
  await volume.press('ArrowRight');
  await page.getByRole('button', { name: 'Fortsätt', exact: true }).click();
  await expect.poll(async () => (await audioState()).gain).toBeCloseTo(0.1 * 0.75, 2);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('heading', { name: 'Paus', exact: true })).toBeVisible();
  await expect.poll(async () => (await audioState()).state).toBe('suspended');
  await page.getByRole('button', { name: 'Avsluta racet' }).click();
  await expect.poll(async () => (await audioState()).state).toBe('closed');
  expect(errors).toEqual([]);
});

test('old and malformed volume settings recover without losing the chosen car', async ({ page }) => {
  for (const volume of [undefined, 'loud', null, -2, 5]) {
    await page.goto('./');
    await page.evaluate((volume) => localStorage.setItem('charlie-for-speed:settings', JSON.stringify({ carId: 'nxr', volume })), volume);
    await page.reload();
    await expect(page.getByRole('button', { name: /Snabbstart.*Kaida NX-R/ })).toBeVisible();
    await page.getByRole('button', { name: 'Inställningar' }).click();
    await expect(page.getByRole('slider', { name: /Ljudvolym/ })).toHaveValue(
      String(typeof volume === 'number' ? Math.max(0, Math.min(100, volume * 100)) : 70),
    );
  }
});
