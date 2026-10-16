import { describe, expect, it } from 'vitest';
import { createRng } from '../src/logic/rng';
import { addAp, addSp, createPlayer, equipFromInventory, expToNext, gainExp, MAX_LEVEL, unequip } from '../src/logic/player';
import { derive, hitChance, rollMobDamage, rollPlayerDamage } from '../src/logic/combat';
import { getMob } from '../src/data/mobs';
import { addItem } from '../src/logic/inventory';

describe('progression', () => {
  it('uses a smooth exponential EXP curve', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(expToNext)).toEqual([17, 30, 51, 88, 151, 259, 445, 766, 1318]);
    expect(expToNext(MAX_LEVEL)).toBe(0);
  });

  it('levels up with AP, SP and a full heal', () => {
    const p = createPlayer('Test');
    p.hp = 10;
    const levels = gainExp(p, 20, createRng(1));
    expect(levels).toBe(1);
    expect(p.level).toBe(2);
    expect(p.exp).toBe(3);
    expect(p.ap).toBe(4);
    expect(p.sp).toBe(1);
    expect(p.maxHp).toBeGreaterThan(55);
    expect(p.hp).toBe(p.maxHp);
  });

  it('handles multiple level ups and stops SP after level 9', () => {
    const p = createPlayer('Test');
    gainExp(p, [1, 2, 3, 4, 5, 6, 7].reduce((n, lv) => n + expToNext(lv), 0), createRng(1));
    expect(p.level).toBe(8);
    expect(p.sp).toBe(7);
    expect(p.ap).toBe(28);
    gainExp(p, 100_000, createRng(1));
    expect(p.sp).toBe(8);
  });

  it('caps at the max level with zero EXP', () => {
    const p = createPlayer('Test');
    gainExp(p, 1_000_000, createRng(1));
    expect(p.level).toBe(MAX_LEVEL);
    expect(p.exp).toBe(0);
    expect(gainExp(p, 100, createRng(1))).toBe(0);
    expect(p.exp).toBe(0);
  });

  it('spends AP and SP only when available', () => {
    const p = createPlayer('Test');
    expect(addAp(p, 'str')).toBe(false);
    p.ap = 1;
    expect(addAp(p, 'str')).toBe(true);
    expect(p.str).toBe(12);
    expect(p.ap).toBe(0);
    p.sp = 5;
    expect([1, 2, 3, 4].map(() => addSp(p, 'second_wind'))).toEqual([true, true, true, false]);
    expect(p.skills.second_wind).toBe(3);
    expect(p.sp).toBe(2);
  });
});

describe('equipment', () => {
  it('swaps equipment with the inventory and respects level requirements', () => {
    const p = createPlayer('Test');
    addItem(p.inventory, 'iron_shortsword', 1);
    addItem(p.inventory, 'woodcutters_hatchet', 1);
    expect(equipFromInventory(p, 1)).toMatch(/level 7/);
    expect(equipFromInventory(p, 0)).toBeNull();
    expect(p.equipment.weapon).toBe('iron_shortsword');
    expect(p.inventory.equip.map((s) => s.itemId)).toEqual(['woodcutters_hatchet', 'practice_blade']);
    expect(unequip(p, 'weapon')).toBeNull();
    expect(p.equipment.weapon).toBeNull();
  });
});

describe('combat', () => {
  it('computes the damage range from STR, DEX and weapon attack', () => {
    const p = createPlayer('Test');
    const d = derive(p);
    // (11*4 + 6*2) * 7 / 90 = 4.36
    expect(d.maxDamage).toBe(4);
    expect(d.minDamage).toBe(1);
    expect(d.wdef).toBe(4);
    p.equipment.weapon = 'iron_shortsword';
    expect(derive(p).maxDamage).toBe(8);
  });

  it('always hits a level 1 shellbug but often misses higher-level monsters', () => {
    const d = derive(createPlayer('Test'));
    expect(hitChance(d, 1, getMob('shellbug'))).toBe(1);
    expect(hitChance(d, 1, getMob('bouncecap'))).toBeLessThan(0.5);
    expect(hitChance(d, 8, getMob('bouncecap'))).toBeGreaterThan(0.8);
  });

  it('rolls damage within range', () => {
    const rng = createRng(42);
    const d = derive(createPlayer('Test'));
    for (let i = 0; i < 200; i++) {
      const dmg = rollPlayerDamage(rng, d, 1, getMob('shellbug'))!;
      expect(dmg).toBeGreaterThanOrEqual(d.minDamage);
      expect(dmg).toBeLessThanOrEqual(d.maxDamage);
      const taken = rollMobDamage(rng, d, 1, getMob('bouncecap'));
      if (taken !== null) expect(taken).toBeGreaterThanOrEqual(1);
    }
  });
});
