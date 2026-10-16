import { describe, expect, it } from 'vitest';
import { createPlayer } from '../src/logic/player';
import { clearSave, deserialize, load, save, serialize } from '../src/logic/save';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('save', () => {
  it('round-trips a player', () => {
    const p = createPlayer('Hero');
    p.level = 4;
    p.acorns = 123;
    p.quests.shell_garden = { state: 'active', kills: 0 };
    expect(deserialize(serialize(p))).toEqual(p);
  });

  it('saves, loads and clears through storage', () => {
    const s = memoryStorage();
    expect(load(s)).toBeNull();
    save(s, createPlayer('Hero'));
    expect(load(s)?.name).toBe('Hero');
    clearSave(s);
    expect(load(s)).toBeNull();
  });

  it('rejects corrupt or incompatible data', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize(JSON.stringify({ version: 99, player: {} }))).toBeNull();
    const bad = createPlayer('x') as unknown as Record<string, unknown>;
    bad.level = 'ten';
    expect(deserialize(JSON.stringify({ version: 2, player: bad }))).toBeNull();
    const unknownItem = createPlayer('x');
    unknownItem.inventory.etc.push({ itemId: 'mystery', qty: 1 });
    expect(deserialize(serialize(unknownItem))).toBeNull();
  });

  it('fills in missing fields and fixes unknown maps', () => {
    const p = createPlayer('Old') as unknown as Record<string, unknown>;
    delete p.finished;
    p.mapId = 'nowhere';
    const loaded = deserialize(JSON.stringify({ version: 2, player: p }))!;
    expect(loaded.finished).toBe(false);
    expect(loaded.mapId).toBe('capwood');
  });
});

describe('migration from the pre-rename (v1) save', () => {
  const v1 = {
    version: 1,
    player: {
      id: 'abc', name: 'Old', level: 4, exp: 10, hp: 80, mp: 30, maxHp: 90, maxMp: 40, str: 20, dex: 6, int: 4, luk: 4,
      ap: 0, sp: 1, mesos: 321,
      skills: { three_snails: 2, recovery: 1, nimble_feet: 0 },
      inventory: {
        equip: [{ itemId: 'hand_axe', qty: 1 }],
        use: [{ itemId: 'red_potion', qty: 12 }, { itemId: 'blue_potion', qty: 3 }],
        etc: [{ itemId: 'snail_shell', qty: 7 }, { itemId: 'orange_mushroom_cap', qty: 2 }],
      },
      equipment: { weapon: 'sword', hat: 'blue_bandana', top: 'white_undershirt', shoes: 'leather_sandals' },
      quests: { snail_shells: { state: 'active', kills: 0 }, orange_mushrooms: { state: 'done', kills: 15 } },
      mapId: 'snail_hunting_2', x: 300, y: 640, finished: false,
    },
  };

  it('renames IDs, currency, skills, quests and map', () => {
    const p = deserialize(JSON.stringify(v1))!;
    expect(p).not.toBeNull();
    expect(p.acorns).toBe(321);
    expect('mesos' in p).toBe(false);
    expect(p.skills).toEqual({ shell_toss: 2, second_wind: 1, quickstep: 0 });
    expect(p.inventory.use).toEqual([{ itemId: 'berry_tonic', qty: 12 }, { itemId: 'dew_tonic', qty: 3 }]);
    expect(p.inventory.etc.map((s) => s.itemId)).toEqual(['mossy_shell', 'bouncy_cap']);
    expect(p.inventory.equip[0].itemId).toBe('woodcutters_hatchet');
    expect(p.equipment).toEqual({ weapon: 'iron_shortsword', hat: 'sky_headscarf', top: 'linen_tunic', shoes: 'rope_sandals' });
    expect(Object.keys(p.quests)).toEqual(['shell_garden', 'bouncecap_trouble']);
    expect(p.mapId).toBe('shellgrass_meadow_2');
    expect(p.id).toBe('abc');
  });

  it('loads from the legacy key and moves the save to the new key on save', () => {
    const s = memoryStorage();
    s.setItem('maple-mvp-save-v1', JSON.stringify(v1));
    const p = load(s)!;
    expect(p.name).toBe('Old');
    save(s, p);
    expect(s.getItem('maple-mvp-save-v1')).toBeNull();
    expect(load(s)!.acorns).toBe(321);
  });
});
