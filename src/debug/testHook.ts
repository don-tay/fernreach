import { getMap } from '../data/maps';
import { addItem } from '../logic/inventory';
import type { World } from '../logic/world';

/**
 * Dev/test-only hook for Playwright: read game state and set up scenarios quickly.
 * Never included in production builds.
 */
export function installTestHook(world: World, save: () => void): void {
  const hook = {
    ready: true,
    world,
    state: () => {
      const p = world.player;
      const b = world.pr.body;
      return {
        mapId: p.mapId, x: b.x, y: b.y, onGround: b.onGround, climbing: world.pr.climbing, level: p.level, exp: p.exp,
        hp: p.hp, mp: p.mp, ap: p.ap, sp: p.sp, str: p.str, mesos: p.mesos, dead: world.pr.dead, blocked: world.blocked,
        inventory: structuredClone(p.inventory), equipment: { ...p.equipment }, quests: structuredClone(p.quests),
        drops: world.drops.length,
        mobs: world.mobs.map((m) => ({ id: m.def.id, x: m.x, y: m.y, hp: m.hp, state: m.state })),
      };
    },
    teleport: (x: number, y?: number) => {
      const b = world.pr.body;
      b.x = x;
      if (y !== undefined) b.y = y;
      b.vx = 0;
      b.vy = 0;
      b.onGround = false;
      b.platform = -1;
      world.pr.climbing = -1;
    },
    warp: (mapId: string) => world.loadMap(getMap(mapId).id),
    addExp: (n: number) => world.grantExpForTest(n),
    giveMesos: (n: number) => {
      world.player.mesos += n;
      world.version++;
    },
    giveItem: (itemId: string, qty = 1) => {
      addItem(world.player.inventory, itemId, qty);
      world.version++;
    },
    setHp: (hp: number) => {
      world.player.hp = hp;
      world.version++;
    },
    spawnDrop: (loot: { itemId?: string; mesos?: number }) => world.addDrop(world.pr.body.x, world.pr.body.y, loot),
    /** Teleports next to the nearest live monster of a kind, facing it, and makes the player briefly invulnerable. */
    approachMob: (mobId: string) => {
      const mob = world.mobs.find((m) => m.def.id === mobId && m.state === 'alive');
      if (!mob) return false;
      hook.teleport(mob.x - 30, mob.y - 1);
      world.pr.facing = 1;
      world.pr.invuln = 5;
      return true;
    },
    save,
  };
  (window as unknown as { __maple: typeof hook }).__maple = hook;
}
