import { expect, test, type Page } from '@playwright/test';
import { chat, newGame, netState, state } from './helpers';

/** Two players in the same browser context, connected through BroadcastChannel (`?net=local`). */
async function twoPlayers(context: import('@playwright/test').BrowserContext): Promise<[Page, Page]> {
  const alice = await context.newPage();
  await newGame(alice, 'Alice');
  const bob = await context.newPage();
  await newGame(bob, 'Bob');
  await expect.poll(async () => (await netState(alice)).players.map((p) => p.name)).toEqual(['Bob']);
  await expect.poll(async () => (await netState(bob)).players.map((p) => p.name)).toEqual(['Alice']);
  return [alice, bob];
}

test('players see each other and follow each other’s movement', async ({ context }) => {
  const [alice, bob] = await twoPlayers(context);
  await expect(alice.getByTestId('net-status')).toHaveText('● Ch 1 · 1 nearby');
  const before = (await netState(alice)).players[0].x!;
  await bob.keyboard.down('ArrowRight');
  await expect.poll(async () => (await netState(alice)).players[0].x!).toBeGreaterThan(before + 40);
  await bob.keyboard.up('ArrowRight');
});

test('players only see each other on the same map', async ({ context }) => {
  const [alice, bob] = await twoPlayers(context);
  await bob.evaluate(() => window.__game.warp('shellgrass_meadow_1'));
  await expect(alice.locator('.log')).toContainText('Bob left the map.');
  await expect(alice.getByTestId('net-status')).toHaveText('● Ch 1 · 0 nearby');
  expect((await netState(alice)).players[0].map).toBe('shellgrass_meadow_1');
  await alice.evaluate(() => window.__game.warp('shellgrass_meadow_1'));
  await expect(alice.getByTestId('net-status')).toHaveText('● Ch 1 · 1 nearby');
});

test('chat shows in the log and as a speech bubble', async ({ context }) => {
  const [alice, bob] = await twoPlayers(context);
  await chat(bob, 'hello friends');
  await expect(alice.locator('.log')).toContainText('Bob: hello friends');
  await expect(bob.locator('.log')).toContainText('Bob: hello friends');
  expect((await netState(alice)).players[0].bubble).toBe('hello friends');
  // Game keys are ignored while typing.
  const x = (await state(bob)).x;
  await bob.keyboard.press('Enter');
  await bob.keyboard.down('ArrowRight');
  await bob.waitForTimeout(300);
  await bob.keyboard.up('ArrowRight');
  expect((await state(bob)).x).toBe(x);
  await bob.keyboard.press('Escape');
  await expect(bob.getByTestId('chat-input')).toBeHidden();
});

test('chat is plain text only', async ({ context }) => {
  const [alice, bob] = await twoPlayers(context);
  await chat(bob, '<img src=x onerror="window.pwned=1">');
  await expect(alice.locator('.log')).toContainText('<img src=x');
  expect(await alice.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined();
});

test('a player who leaves disappears', async ({ context }) => {
  const [alice, bob] = await twoPlayers(context);
  await bob.close();
  await expect(alice.locator('.log')).toContainText('Bob left the map.');
  await expect.poll(async () => (await netState(alice)).players).toEqual([]);
});

test('the Players window lists everyone in the channel', async ({ context }) => {
  const [alice, bob] = await twoPlayers(context);
  await bob.evaluate(() => window.__game.warp('shellgrass_meadow_1'));
  await alice.keyboard.press('p');
  const win = alice.getByTestId('win-players');
  await expect(win).toContainText('Alice');
  await expect(win).toContainText('Bob');
  await expect(win).toContainText('Shellgrass Meadow I');
});

test('going offline from the menu hides other players and chat stays local', async ({ context }) => {
  const [alice, bob] = await twoPlayers(context);
  await alice.keyboard.press('Escape');
  await alice.getByTestId('net-menu').getByRole('button', { name: 'Go offline' }).click();
  await expect(alice.getByTestId('net-status')).toHaveText('○ Offline');
  expect((await netState(alice)).players).toEqual([]);
  await expect.poll(async () => (await netState(bob)).players).toEqual([]);
  await alice.getByRole('button', { name: 'Close' }).click();
  await chat(alice, 'anyone?');
  await expect(alice.locator('.log')).toContainText('Alice: anyone? (offline)');
  await alice.keyboard.press('Escape');
  await alice.getByTestId('net-menu').getByRole('button', { name: 'Go online' }).click();
  await expect.poll(async () => (await netState(alice)).players.map((p) => p.name)).toEqual(['Bob']);
});

test('players on different channels do not see each other', async ({ context }) => {
  const [alice, bob] = await twoPlayers(context);
  await alice.keyboard.press('Escape');
  await alice.getByTestId('net-menu').getByRole('button', { name: 'Ch 2' }).click();
  await expect(alice.getByTestId('net-status')).toHaveText('● Ch 2 · 0 nearby');
  await expect.poll(async () => (await netState(bob)).players).toEqual([]);
});

test('falls back to offline when the connection fails', async ({ page }) => {
  test.setTimeout(30_000);
  await newGame(page, 'Solo', 'down');
  await expect(page.getByTestId('net-status')).toContainText('Connecting');
  await expect(page.getByTestId('net-status')).toContainText('Offline · retrying in', { timeout: 15_000 });
  // Single-player still works.
  const x = (await state(page)).x;
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await state(page)).x).toBeGreaterThan(x + 20);
  await page.keyboard.up('ArrowRight');
});
