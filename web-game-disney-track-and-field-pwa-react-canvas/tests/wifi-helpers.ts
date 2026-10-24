import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
export async function peers(browser: Browser, url: string | undefined) {
  if (!url) throw new Error('No preview URL');
  const contexts: BrowserContext[] = [];
  const open = async (mobile: boolean) => {
    const context = await browser.newContext({
      viewport: mobile ? { width: 412, height: 915 } : { width: 1280, height: 800 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto(url);
    return page;
  };
  return {
    host: await open(false),
    guest: await open(true),
    open,
    contexts,
    close: async () => {
      for (const c of contexts) await c.close();
    },
  };
}
export async function imageTransfer(from: Page, to: Page) {
  await expect(from.locator('.connection-qr')).toBeVisible();
  const src = await from.locator('.connection-qr').getAttribute('src');
  if (!src) throw new Error('No QR');
  await to.locator('input[type=file]').setInputFiles({ name: 'pair.png', mimeType: 'image/png', buffer: Buffer.from(src.split(',')[1], 'base64') });
}
export async function paste(to: Page, code: string) {
  await to.getByRole('textbox', { name: 'Klistra in anslutningskod', exact: true }).fill(code);
  await to.getByRole('button', { name: 'Läs in koden', exact: true }).click();
}
export async function connect(host: Page, guest: Page, manual = false) {
  await guest.getByRole('button', { name: /^Spela via Wi-Fi/ }).click();
  await guest.getByRole('button', { name: /^Jag går med/ }).click();
  await expect(host.locator('.connection-qr')).toBeVisible();
  if (manual) {
    await paste(guest, await codeOf(host, 'Din matchkod'));
  } else await imageTransfer(host, guest);
  await expect(guest.locator('.connection-qr')).toBeVisible();
  if (manual) {
    await paste(host, await codeOf(guest, 'Din svarskod'));
  } else await imageTransfer(guest, host);
  await expect(guest.getByText(/Enheterna är anslutna!/)).toBeVisible({ timeout: 15000 });
  await expect(guest.getByRole('button', { name: 'Jag är redo', exact: true })).toBeEnabled();
}

// Reads a device's pairing code from the text shown under its QR image.
export async function codeOf(page: Page, name: 'Din matchkod' | 'Din svarskod') {
  await page.getByText('Visa koden som text', { exact: true }).click();
  const box = page.getByRole('textbox', { name, exact: true });
  await expect(box).not.toHaveValue('');
  return box.inputValue();
}
