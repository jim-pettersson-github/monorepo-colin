import { expect, test } from '@playwright/test';

test('assets, app links, manifest, and offline worker stay inside the hosted base path', async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error('Missing preview URL');
  const base = new URL(baseURL);
  const escaped: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === base.origin && !url.pathname.startsWith(base.pathname)) escaped.push(url.pathname);
  });
  await page.goto('./');
  await expect(page.locator('.scene')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.brand')).toHaveAttribute('href', base.pathname);
  await expect(page.locator('.brand img')).toHaveJSProperty('naturalWidth', 512);
  await page.locator('.brand').click();
  await expect(page).toHaveURL(baseURL);

  const response = await request.get(new URL('manifest.webmanifest', baseURL).href);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ id: base.pathname, start_url: base.pathname, scope: base.pathname });
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, baseURL);
    expect(url.pathname.startsWith(base.pathname)).toBe(true);
    const image = await request.get(url.href);
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toContain('image/png');
  }
  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return { scope: registration.scope, script: registration.active?.scriptURL };
  });
  expect(worker).toEqual({ scope: baseURL, script: new URL('sw.js', baseURL).href });
  expect(escaped).toEqual([]);
});
