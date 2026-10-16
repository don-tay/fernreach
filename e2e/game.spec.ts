import { expect, test } from '@playwright/test';
import { count, GROUND_Y, hold, newGame, settle, state, teleport, trackErrors } from './helpers';

test('boots to the title screen and starts a new game', async ({ page }) => {
  const errors = trackErrors(page);
  await newGame(page, 'Smoke');
  await expect(page.locator('.map-name')).toHaveText('Capwood');
  await expect(page.locator('.hud .pname')).toHaveText('Smoke');
  await expect(page.locator('.hud .lv b')).toHaveText('1');
  await expect(page.locator('#game canvas')).toBeVisible();
  const s = await state(page);
  expect(s.mapId).toBe('capwood');
  expect(s.y).toBe(GROUND_Y);
  expect(errors).toEqual([]);
});

test('walks and jumps', async ({ page }) => {
  await newGame(page);
  const start = await state(page);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await state(page)).x).toBeGreaterThan(start.x + 40);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).y, { timeout: 2000 }).toBeLessThan(GROUND_Y - 30);
  await settle(page);
  expect((await state(page)).y).toBe(GROUND_Y);
});

test('climbs a rope onto a platform', async ({ page }) => {
  await newGame(page);
  await teleport(page, 420);
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await state(page)).y, { timeout: 10_000 }).toBe(560);
  await page.keyboard.up('ArrowUp');
  expect((await state(page)).onGround).toBe(true);
});

test('climbs down the leftmost rope in Shellgrass Meadow I to the ground', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => {
    window.__game.warp('shellgrass_meadow_1');
    window.__game.teleport(400, 550);
  });
  await settle(page);
  expect((await state(page)).y).toBe(560);
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await state(page)).climbing, { timeout: 5000 }).toBeGreaterThanOrEqual(0);
  await expect.poll(async () => (await state(page)).climbing, { timeout: 10_000 }).toBe(-1);
  await page.keyboard.up('ArrowDown');
  await settle(page);
  expect((await state(page)).y).toBe(GROUND_Y);
});

test('kills a shellbug and gains EXP', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => window.__game.warp('shellgrass_meadow_1'));
  await expect(page.locator('.map-name')).toHaveText('Shellgrass Meadow I');
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.__game.approachMob('shellbug'));
        await hold(page, 'c', 700);
        return (await state(page)).exp;
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await expect(page.locator('.log')).toContainText('You have gained experience');
});

test('picks up an item and acorns with Z', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => {
    window.__game.spawnDrop({ itemId: 'mossy_shell' });
    window.__game.spawnDrop({ acorns: 9 });
  });
  await page.keyboard.down('z');
  await expect.poll(async () => (await state(page)).drops, { timeout: 10_000 }).toBe(0);
  await page.keyboard.up('z');
  const s = await state(page);
  expect(count(s, 'mossy_shell')).toBe(1);
  expect(s.acorns).toBe(9);
  await page.keyboard.press('i');
  await page.click('.win-inventory .tab:has-text("ETC")');
  await expect(page.locator('.win-inventory [data-item=mossy_shell]')).toBeVisible();
});

test('levels up and spends AP in the stat window', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => window.__game.addExp(17));
  await expect(page.locator('.hud .lv b')).toHaveText('2');
  await page.keyboard.press('s');
  await expect(page.getByTestId('ap')).toHaveText('4');
  await page.getByTestId('ap-str').click();
  await expect(page.getByTestId('stat-str')).toHaveText('12');
  await expect(page.getByTestId('ap')).toHaveText('3');
  await page.keyboard.press('k');
  await expect(page.getByTestId('sp')).toHaveText('1');
});

test('uses a portal with the up arrow', async ({ page }) => {
  await newGame(page);
  await teleport(page, 1740);
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await state(page)).mapId).toBe('shellgrass_meadow_1');
  await expect(page.locator('.map-name')).toHaveText('Shellgrass Meadow I');
});

test('buys and sells in the shop', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => window.__game.giveAcorns(100));
  await teleport(page, 880);
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('dialog-npc')).toContainText('Tobin');
  await page.getByRole('button', { name: 'Open shop' }).click();
  await page.getByTestId('buy-berry_tonic').click();
  await expect(page.getByTestId('shop-acorns')).toHaveText('70');
  expect(count(await state(page), 'berry_tonic')).toBe(6);
  await page.click('.shop .tab:has-text("USE")');
  await page.getByTestId('sell-berry_tonic').click();
  await expect(page.getByTestId('shop-acorns')).toHaveText('85');
  expect((await state(page)).blocked).toBe(true);
  await page.getByRole('button', { name: 'Leave' }).click();
  expect((await state(page)).blocked).toBe(false);
});

test('accepts and completes a quest', async ({ page }) => {
  await newGame(page);
  await teleport(page, 220);
  await page.keyboard.press('ArrowUp');
  await page.getByRole('button', { name: 'Accept' }).click();
  await page.evaluate(() => window.__game.giveItem('mossy_shell', 10));
  await page.keyboard.press('q');
  await expect(page.getByTestId('win-quests')).toContainText('Ready to complete');
  await page.keyboard.press('ArrowUp');
  await page.getByRole('button', { name: 'Complete quest' }).click();
  await expect(page.getByTestId('dialog-npc')).toContainText('Rewards');
  const s = await state(page);
  expect(s.quests.shell_garden.state).toBe('done');
  expect(s.level).toBe(2);
  expect(count(s, 'berry_tonic')).toBe(15);
});

test('dies and respawns in town', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => {
    window.__game.warp('shellgrass_meadow_1');
    window.__game.setHp(1);
  });
  await expect
    .poll(
      async () => {
        await page.evaluate(() => {
          const m = window.__game.state().mobs.find((m) => m.state === 'alive')!;
          window.__game.teleport(m.x, m.y - 1);
        });
        return (await state(page)).dead;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  await page.getByTestId('dialog-death').getByRole('button', { name: 'OK' }).click();
  const s = await state(page);
  expect(s.mapId).toBe('capwood');
  expect(s.hp).toBe(50);
});

test('sails for the Mainland at level 10', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => window.__game.addExp(100_000));
  await expect(page.locator('.bar.exp .val')).toHaveText('MAX');
  await teleport(page, 1500);
  await page.keyboard.press('ArrowUp');
  await page.getByRole('button', { name: 'Set sail!' }).click();
  await expect(page.getByTestId('ending')).toContainText('Thanks for playing');
  await page.getByRole('button', { name: 'Keep playing on Fernreach' }).click();
  await expect(page.getByTestId('ending')).toHaveCount(0);
  expect((await state(page)).blocked).toBe(false);
});

test('progress survives a page reload', async ({ page }) => {
  await newGame(page, 'Saver');
  await page.evaluate(() => {
    window.__game.addExp(20);
    window.__game.giveAcorns(42);
    window.__game.warp('shellgrass_meadow_1'); // map changes trigger an autosave
  });
  await page.reload();
  await page.getByTestId('continue').click();
  await page.waitForFunction(() => window.__game?.ready);
  const s = await state(page);
  expect(s.level).toBe(2);
  expect(s.acorns).toBe(42);
  expect(s.mapId).toBe('shellgrass_meadow_1');
  await expect(page.locator('.hud .pname')).toHaveText('Saver');
});
