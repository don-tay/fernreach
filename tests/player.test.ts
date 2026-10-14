import { describe, expect, it } from 'vitest';
import { createRng } from '../src/logic/rng';
import { addAp, addSp, createPlayer, equipFromInventory, expToNext, gainExp, MAX_LEVEL, unequip } from '../src/logic/player';
import { derive, hitChance, rollMobDamage, rollPlayerDamage } from '../src/logic/combat';
import { getMob } from '../src/data/mobs';
import { addItem } from '../src/logic/inventory';

describe('progression', () => {
  it('uses the classic EXP table', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(expToNext)).toEqual([15, 34, 57, 92, 135, 372, 560, 840, 1242]);
  });

  it('levels up with AP, SP and a full heal', () => {
    const p = createPlayer('Test');
    p.hp = 10;
    const levels = gainExp(p, 20, createRng(1));
    expect(levels).toBe(1);
    expect(p.level).toBe(2);
    expect(p.exp).toBe(5);
    expect(p.ap).toBe(5);
    expect(p.sp).toBe(1);
    expect(p.maxHp).toBeGreaterThan(50);
    expect(p.hp).toBe(p.maxHp);
  });

  it('handles multiple level ups and stops SP after level 7', () => {
    const p = createPlayer('Test');
    gainExp(p, 15 + 34 + 57 + 92 + 135 + 372 + 560, createRng(1));
    expect(p.level).toBe(8);
    expect(p.sp).toBe(6);
    expect(p.ap).toBe(35);
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
    expect(p.str).toBe(13);
    expect(p.ap).toBe(0);
    p.sp = 5;
    expect([1, 2, 3, 4].map(() => addSp(p, 'recovery'))).toEqual([true, true, true, false]);
    expect(p.skills.recovery).toBe(3);
    expect(p.sp).toBe(2);
  });
});

describe('equipment', () => {
  it('swaps equipment with the inventory and respects level requirements', () => {
    const p = createPlayer('Test');
    addItem(p.inventory, 'sword', 1);
    addItem(p.inventory, 'hand_axe', 1);
    expect(equipFromInventory(p, 1)).toMatch(/level 8/);
    expect(equipFromInventory(p, 0)).toBeNull();
    expect(p.equipment.weapon).toBe('sword');
    expect(p.inventory.equip.map((s) => s.itemId)).toEqual(['hand_axe', 'training_sword']);
    expect(unequip(p, 'weapon')).toBeNull();
    expect(p.equipment.weapon).toBeNull();
  });
});

describe('combat', () => {
  it('computes the pre-Big Bang damage range', () => {
    const p = createPlayer('Test');
    const d = derive(p);
    // (12*4 + 5) * 8 / 100 = 4.24
    expect(d.maxDamage).toBe(4);
    expect(d.minDamage).toBe(1);
    expect(d.wdef).toBe(5);
    p.equipment.weapon = 'sword';
    expect(derive(p).maxDamage).toBe(7);
  });

  it('always hits a level 1 snail but often misses higher-level monsters', () => {
    const d = derive(createPlayer('Test'));
    expect(hitChance(d, 1, getMob('snail'))).toBe(1);
    expect(hitChance(d, 1, getMob('orange_mushroom'))).toBeLessThan(0.5);
    expect(hitChance(d, 8, getMob('orange_mushroom'))).toBeGreaterThan(0.8);
  });

  it('rolls damage within range', () => {
    const rng = createRng(42);
    const d = derive(createPlayer('Test'));
    for (let i = 0; i < 200; i++) {
      const dmg = rollPlayerDamage(rng, d, 1, getMob('snail'))!;
      expect(dmg).toBeGreaterThanOrEqual(d.minDamage);
      expect(dmg).toBeLessThanOrEqual(d.maxDamage);
      const taken = rollMobDamage(rng, d, 1, getMob('orange_mushroom'));
      if (taken !== null) expect(taken).toBeGreaterThanOrEqual(1);
    }
  });
});
