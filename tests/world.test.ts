import { describe, expect, it } from 'vitest';
import type { Action, WorldEvent } from '../src/logic/world';
import { World } from '../src/logic/world';
import { createPlayer } from '../src/logic/player';
import { createRng } from '../src/logic/rng';
import { GROUND_Y, MAPS } from '../src/data/maps';
import { countItem } from '../src/logic/inventory';

const DT = 1 / 60;

function setup(mapId = 'mushroom_town') {
  const p = createPlayer('Test');
  p.mapId = mapId;
  p.x = mapId === 'mushroom_town' ? 120 : 100;
  const world = new World(p, createRng(7));
  const events: WorldEvent[] = [];
  world.on((e) => events.push(e));
  let prev = new Set<Action>();
  const run = (seconds: number, ...held: Action[]) => {
    const h = new Set(held);
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      const pressed = new Set([...h].filter((a) => !prev.has(a)));
      world.step(DT, { held: h, pressed });
      prev = h;
    }
    prev = new Set();
    world.step(DT, { held: new Set(), pressed: new Set() });
  };
  return { world, events, run, p };
}

describe('world: movement', () => {
  it('stands on the ground, walks and jumps', () => {
    const { world, run } = setup();
    const b = world.pr.body;
    expect(b.onGround).toBe(true);
    expect(b.y).toBe(GROUND_Y);
    run(1, 'right');
    expect(b.x).toBeGreaterThan(220);
    let minY = b.y;
    for (let i = 0; i < 30; i++) {
      world.step(DT, { held: new Set(['jump']), pressed: new Set(i === 0 ? ['jump'] : []) });
      minY = Math.min(minY, b.y);
    }
    expect(GROUND_Y - minY).toBeGreaterThan(70);
    run(1);
    expect(b.y).toBe(GROUND_Y);
  });

  it('climbs a rope onto a platform and drops back through it', () => {
    const { world, run } = setup();
    const b = world.pr.body;
    b.x = 420; // rope from y=560 to 620
    run(0.1, 'up');
    expect(world.pr.climbing).toBeGreaterThanOrEqual(0);
    run(2, 'up');
    expect(world.pr.climbing).toBe(-1);
    expect(b.onGround).toBe(true);
    expect(b.y).toBe(560);
    b.x = 340;
    run(0.1, 'down', 'jump');
    run(1);
    expect(b.y).toBe(GROUND_Y);
  });

  it('climbs down a rope and lands on the ground below', () => {
    const { world, run } = setup('snail_hunting_1');
    const b = world.pr.body;
    world.loadMap('snail_hunting_1', undefined, { x: 400, y: 560 }); // top of the leftmost rope
    world.mobs = [];
    run(0.1, 'down');
    expect(world.pr.climbing).toBeGreaterThanOrEqual(0);
    run(3, 'down');
    expect(world.pr.climbing).toBe(-1);
    expect(b.onGround).toBe(true);
    expect(b.y).toBe(GROUND_Y);
  });

  it('climbs down every rope and ladder in every map without falling out', () => {
    for (const map of Object.values(MAPS)) {
      for (const rope of map.ropes) {
        const { world, run } = setup(map.id);
        world.loadMap(map.id, undefined, { x: rope.x, y: rope.top });
        world.mobs = [];
        run(0.1, 'down');
        expect(world.pr.climbing, `${map.id} rope at x=${rope.x}`).toBeGreaterThanOrEqual(0);
        run(4, 'down');
        run(1);
        const b = world.pr.body;
        expect(b.onGround, `${map.id} rope at x=${rope.x}`).toBe(true);
        expect(b.y, `${map.id} rope at x=${rope.x}`).toBeGreaterThan(rope.bottom);
        expect(b.y).toBeLessThanOrEqual(GROUND_Y);
      }
    }
  });

  it('returns a player who falls out of the map to the spawn point', () => {
    const { world, run } = setup('snail_hunting_1');
    world.mobs = [];
    Object.assign(world.pr.body, { x: 900, y: 5000, onGround: false, platform: -1 });
    run(0.1);
    expect(world.pr.body.onGround).toBe(true);
    expect(world.pr.body.x).toBe(world.map.spawn.x);
    expect(world.pr.body.y).toBe(GROUND_Y);
  });

  it('cannot drop through solid ground', () => {
    const { world, run } = setup();
    run(0.5, 'down', 'jump');
    expect(world.pr.body.y).toBe(GROUND_Y);
  });

  it('uses portals with the up key', () => {
    const { world, events, run } = setup();
    world.pr.body.x = 1740;
    run(0.05, 'up');
    expect(world.player.mapId).toBe('snail_hunting_1');
    expect(world.pr.body.x).toBe(60);
    expect(events.some((e) => e.type === 'mapChanged')).toBe(true);
  });
});

describe('world: combat and loot', () => {
  it('kills a snail for EXP and loot', () => {
    const { world, events, run } = setup('snail_hunting_1');
    const snail = world.mobs.find((m) => m.def.id === 'snail' && m.spawn.platform === 0)!;
    for (let i = 0; i < 40 && snail.state === 'alive'; i++) {
      world.pr.body.x = snail.x - 30;
      world.pr.facing = 1;
      world.pr.invuln = 10;
      run(0.1, 'attack');
    }
    expect(snail.state).not.toBe('alive');
    expect(world.player.exp).toBe(3);
    expect(events.some((e) => e.type === 'message' && e.text.includes('experience'))).toBe(true);
  });

  it('picks up drops', () => {
    const { world, run } = setup('snail_hunting_1');
    world.mobs = [];
    world.addDrop(world.pr.body.x, GROUND_Y, { itemId: 'snail_shell' });
    world.addDrop(world.pr.body.x + 10, GROUND_Y, { mesos: 7 });
    run(1);
    run(0.5, 'pickup');
    expect(countItem(world.player.inventory, 'snail_shell')).toBe(1);
    expect(world.player.mesos).toBe(7);
    expect(world.drops).toHaveLength(0);
  });

  it('takes touch damage with knockback, dies and respawns in town', () => {
    const { world, events, run } = setup('snail_hunting_1');
    const mob = world.mobs[0];
    world.player.hp = 1;
    for (let i = 0; i < 300 && !world.pr.dead; i++) {
      world.pr.body.x = mob.x;
      world.pr.invuln = 0;
      run(DT);
    }
    expect(world.pr.dead).toBe(true);
    expect(events.some((e) => e.type === 'death')).toBe(true);
    world.respawn();
    expect(world.player.mapId).toBe('mushroom_town');
    expect(world.player.hp).toBe(50);
  });
});

describe('world: skills, items and shop', () => {
  it('requires learning skills and spending MP', () => {
    const { world, run } = setup();
    run(0.05, 'recovery');
    expect(world.pr.recovery).toBeNull();
    world.player.skills.recovery = 1;
    world.player.mp = 20;
    run(0.05, 'recovery');
    expect(world.pr.recovery).not.toBeNull();
    expect(world.player.mp).toBe(10);
    world.player.hp = 10;
    run(3.1);
    expect(world.player.hp).toBeGreaterThanOrEqual(20);
  });

  it('nimble feet increases speed', () => {
    const { world, run } = setup();
    const base = world.speed;
    world.player.skills.nimble_feet = 1;
    run(0.05, 'nimble_feet');
    expect(world.speed).toBeGreaterThan(base);
  });

  it('uses potions from hotkeys', () => {
    const { world, run } = setup();
    world.player.hp = 1;
    run(0.05, 'red_potion');
    expect(world.player.hp).toBe(50);
    expect(countItem(world.player.inventory, 'red_potion')).toBe(4);
  });

  it('buys and sells', () => {
    const { world } = setup();
    expect(world.buy('red_potion', 1)).toMatch(/mesos/);
    world.player.mesos = 100;
    expect(world.buy('red_potion', 2)).toBeNull();
    expect(world.player.mesos).toBe(50);
    expect(countItem(world.player.inventory, 'red_potion')).toBe(7);
    expect(world.sell('use', 0, 7)).toBeNull();
    expect(world.player.mesos).toBe(50 + 12 * 7);
  });

  it('only sails to Victoria at the level cap', () => {
    const { world, events } = setup();
    expect(world.travelToVictoria()).toMatch(/level 10/);
    world.grantExpForTest(100000);
    expect(world.travelToVictoria()).toBeNull();
    expect(events.some((e) => e.type === 'ending')).toBe(true);
  });
});
