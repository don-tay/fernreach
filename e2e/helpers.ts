import { expect, type Page } from '@playwright/test';

type Hook = {
  ready: boolean;
  state(): {
    mapId: string; x: number; y: number; onGround: boolean; climbing: number; level: number; exp: number; hp: number;
    mp: number; ap: number; sp: number; str: number; mesos: number; dead: boolean; blocked: boolean; drops: number;
    inventory: Record<'equip' | 'use' | 'etc', { itemId: string; qty: number }[]>;
    quests: Record<string, { state: string; kills: number }>;
    mobs: { id: string; x: number; y: number; hp: number; state: string }[];
  };
  teleport(x: number, y?: number): void;
  warp(mapId: string): void;
  addExp(n: number): void;
  giveMesos(n: number): void;
  giveItem(itemId: string, qty?: number): void;
  setHp(hp: number): void;
  spawnDrop(loot: { itemId?: string; mesos?: number }): void;
  approachMob(mobId: string): boolean;
  save(): void;
};

declare global {
  interface Window {
    __maple: Hook;
  }
}

export const GROUND_Y = 640;

/** Collects uncaught page errors so tests can assert none happened. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

export async function newGame(page: Page, name = 'Tester'): Promise<void> {
  await page.goto('/?seed=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#name', name);
  await page.click('[data-testid=new-game]');
  await page.waitForFunction(() => window.__maple?.ready);
  await settle(page);
}

export const state = (page: Page) => page.evaluate(() => window.__maple.state());

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
  await page.evaluate((x) => window.__maple.teleport(x, 600), x);
  await settle(page);
}

export const count = (s: Awaited<ReturnType<typeof state>>, itemId: string) =>
  Object.values(s.inventory).flat().filter((i) => i.itemId === itemId).reduce((n, i) => n + i.qty, 0);
