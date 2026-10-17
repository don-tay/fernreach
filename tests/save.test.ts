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
    expect(deserialize(JSON.stringify({ version: 1, player: createPlayer('old') }))).toBeNull();
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

