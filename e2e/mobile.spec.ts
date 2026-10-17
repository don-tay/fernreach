import { expect, test, type Page } from '@playwright/test';
import { count, newGame, state } from './helpers';

/** Real multi-touch through the Chrome DevTools Protocol: each point is one finger. */
async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const fingers = new Map<number, { x: number; y: number; id: number }>();
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd') => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...fingers.values()] });
  const centre = async (testid: string, fx = 0.5, fy = 0.5) => {
    const b = (await page.getByTestId(testid).boundingBox())!;
    return { x: b.x + b.width * fx, y: b.y + b.height * fy };
  };
  return {
    async down(id: number, testid: string, fx?: number, fy?: number) {
      const isNew = !fingers.has(id);
      fingers.set(id, { ...(await centre(testid, fx, fy)), id });
      await send(isNew ? 'touchStart' : 'touchMove');
    },
    async up(id: number) {
      fingers.delete(id);
      await send('touchEnd');
    },
  };
}

test('fills the landscape screen and shows touch controls', async ({ page }) => {
  await newGame(page);
  await expect(page.getByTestId('touch-pad')).toBeVisible();
  await expect(page.getByTestId('touch-attack')).toBeVisible();
  await expect(page.getByTestId('rotate')).toBeHidden();
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(canvas.width).toBeGreaterThan(vp.width - 2);
});

test('walks with the pad and jumps while walking (multi-touch)', async ({ page }) => {
  await newGame(page);
  const t = await touch(page);
  const x0 = (await state(page)).x;
  await t.down(1, 'touch-pad', 0.95, 0.5);
  await expect.poll(async () => (await state(page)).x).toBeGreaterThan(x0 + 40);
  await t.down(2, 'touch-jump');
  await expect.poll(async () => (await state(page)).onGround).toBe(false);
  await t.up(2);
  await t.up(1);
  await expect.poll(async () => (await state(page)).onGround).toBe(true);
  const x1 = (await state(page)).x;
  await page.waitForTimeout(400);
  expect((await state(page)).x).toBe(x1);
});

test('attacks a monster with the Attack button', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => window.__game.warp('shellgrass_meadow_1'));
  const t = await touch(page);
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.__game.approachMob('shellbug'));
        await t.down(1, 'touch-attack');
        await page.waitForTimeout(600);
        await t.up(1);
        return (await state(page)).exp;
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
});

test('drinks a tonic from its button', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => window.__game.setHp(5));
  await page.getByTestId('touch-berry_tonic').tap();
  await expect.poll(async () => (await state(page)).hp).toBeGreaterThan(5);
});

test('equips gear by tapping an item and then Equip', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => window.__game.giveItem('iron_shortsword'));
  await page.getByTestId('touch-item').tap();
  await expect(page.getByTestId('touch-attack')).toBeHidden();
  await page.locator('.win-inventory [data-item=iron_shortsword]').tap();
  await expect(page.getByTestId('inv-detail')).toContainText('Iron Shortsword');
  await page.getByTestId('inv-use').tap();
  await expect.poll(async () => (await page.evaluate(() => window.__game.state())).equipment.weapon).toBe('iron_shortsword');
  await page.locator('.win-inventory .x').tap();
  await expect(page.getByTestId('touch-attack')).toBeVisible();
});

test('opens chat and the menu from the top bar', async ({ page }) => {
  await newGame(page);
  await page.getByTestId('touch-chat').tap();
  await expect(page.getByTestId('chat-input')).toBeFocused();
  await page.getByTestId('chat-input').fill('hi from my phone');
  await page.getByTestId('chat-input').press('Enter');
  await expect(page.locator('.log')).toContainText('hi from my phone');
  await page.getByTestId('touch-menu').tap();
  await expect(page.getByTestId('dialog-menu')).toBeVisible();
});

test('asks to rotate in portrait', async ({ page }) => {
  await newGame(page);
  await page.setViewportSize({ width: 412, height: 839 });
  await expect(page.getByTestId('rotate')).toBeVisible();
});

test('a save code moves a character to another device', async ({ page, browser }) => {
  await newGame(page, 'Mover');
  await page.evaluate(() => {
    window.__game.addExp(40);
    window.__game.giveItem('mossy_shell', 3);
  });
  await page.getByTestId('touch-menu').tap();
  await page.getByRole('button', { name: 'Export save' }).tap();
  const code = await page.getByTestId('save-code').inputValue();
  expect(code).toMatch(/^FERN1:/);

  const other = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await newGame(other, 'Someone');
  await other.getByTestId('touch-menu').tap();
  await other.getByRole('button', { name: 'Import save' }).tap();
  await other.getByTestId('save-code').fill(code);
  await other.getByRole('button', { name: 'Load save' }).tap();
  await other.getByTestId('continue').tap();
  await other.waitForFunction(() => window.__game?.ready);
  const s = await state(other);
  expect(s.level).toBe(2); // 40 EXP: 17 to level 2, then 23 of 30
  expect(s.exp).toBe(23);
  expect(count(s, 'mossy_shell')).toBe(3);
});
