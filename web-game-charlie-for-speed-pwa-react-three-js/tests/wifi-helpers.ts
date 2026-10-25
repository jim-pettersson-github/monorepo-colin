import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

// The local room server that Playwright starts next to the preview (see playwright.config.ts).
export const roomServer = `http://127.0.0.1:${process.env.CFS_ROOM_PORT || 4024}/api.php`;

export async function peers(browser: Browser, url: string | undefined) {
  if (!url) throw new Error('No preview URL');
  const contexts: BrowserContext[] = [];
  const open = async (mobile: boolean) => {
    const context = await browser.newContext({
      viewport: mobile ? { width: 412, height: 915 } : { width: 1280, height: 800 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    await context.addInitScript((server) => localStorage.setItem('charlie-for-speed:room-server', server), roomServer);
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

// Only the room server stays reachable, so the race itself has to run between the devices.
export async function onlyRoomServer(page: Page) {
  await page.context().route('**/*', (route) => (route.request().url().startsWith(new URL(roomServer).origin) ? route.continue() : route.abort()));
}

export async function roomCode(host: Page) {
  const code = host.getByTestId('room-code');
  await expect(code).toHaveText(/^[A-Z0-9]{4}$/, { timeout: 15000 });
  return (await code.textContent()) ?? '';
}

// The guest joins the host's open room by its code; the host must already be hosting. A late career guest skips the lobby.
export async function connect(host: Page, guest: Page, menu: RegExp | null = /^Spela online/, lobby = true) {
  const code = await roomCode(host);
  if (menu) await guest.getByRole('button', { name: menu }).click();
  await guest.getByRole('button', { name: /^Jag går med/ }).click();
  await guest.getByRole('textbox', { name: 'Rumskod', exact: true }).fill(code);
  await guest.getByRole('button', { name: 'Gå med i rummet', exact: true }).click();
  if (lobby) await expect(guest.getByText(/Enheterna är anslutna!/)).toBeVisible({ timeout: 30000 });
}
