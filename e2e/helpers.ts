import { expect, type Page } from '@playwright/test';

type Hook = {
  ready: boolean;
  state(): {
    mapId: string; x: number; y: number; onGround: boolean; climbing: number; level: number; exp: number; hp: number;
    mp: number; ap: number; sp: number; str: number; acorns: number; dead: boolean; blocked: boolean; drops: number;
    inventory: Record<'equip' | 'use' | 'etc', { itemId: string; qty: number }[]>;
    quests: Record<string, { state: string; kills: number }>;
    equipment: Record<string, string | null>;
    mobs: { id: string; x: number; y: number; hp: number; state: string }[];
  };
  teleport(x: number, y?: number): void;
  warp(mapId: string): void;
  addExp(n: number): void;
  giveAcorns(n: number): void;
  giveItem(itemId: string, qty?: number): void;
  setHp(hp: number): void;
  spawnDrop(loot: { itemId?: string; acorns?: number }): void;
  approachMob(mobId: string): boolean;
  save(): void;
  netState(): {
    status: string;
    room: string;
    players: { name: string; level: number; map: string | null; pose: string; bubble: string | null; x?: number; y?: number }[];
  };
};

declare global {
  interface Window {
    __game: Hook;
  }
}

export const GROUND_Y = 640;

/** Collects uncaught page errors so tests can assert none happened. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Starts a new game. Uses the in-browser transport so tests never touch public relays. */
export async function newGame(page: Page, name = 'Tester', net = 'local'): Promise<void> {
  await page.goto(`/?seed=1&net=${net}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#name', name);
  await page.click('[data-testid=new-game]');
  await page.waitForFunction(() => window.__game?.ready);
  await settle(page);
}

export const state = (page: Page) => page.evaluate(() => window.__game.state());

export async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/** Waits until the player is standing on something. */
export async function settle(page: Page): Promise<void> {
  await expect.poll(async () => (await state(page)).onGround).toBe(true);
}

export async function teleport(page: Page, x: number): Promise<void> {
  await page.evaluate((x) => window.__game.teleport(x, 600), x);
  await settle(page);
}

export const count = (s: Awaited<ReturnType<typeof state>>, itemId: string) =>
  Object.values(s.inventory).flat().filter((i) => i.itemId === itemId).reduce((n, i) => n + i.qty, 0);

export const netState = (page: Page) => page.evaluate(() => window.__game.netState());

export async function chat(page: Page, text: string): Promise<void> {
  await page.keyboard.press('Enter');
  await page.getByTestId('chat-input').fill(text);
  await page.getByTestId('chat-input').press('Enter');
}
