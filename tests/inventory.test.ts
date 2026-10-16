import { describe, expect, it } from 'vitest';
import { addItem, canAdd, countItem, emptyInventory, removeAt, removeItem, STACK_MAX, TAB_CAPACITY } from '../src/logic/inventory';

describe('inventory', () => {
  it('stacks use and etc items up to the stack limit', () => {
    const inv = emptyInventory();
    expect(addItem(inv, 'berry_tonic', 150)).toBe(150);
    expect(inv.use).toEqual([
      { itemId: 'berry_tonic', qty: STACK_MAX },
      { itemId: 'berry_tonic', qty: 50 },
    ]);
    addItem(inv, 'mossy_shell', 3);
    expect(inv.etc).toEqual([{ itemId: 'mossy_shell', qty: 3 }]);
  });

  it('never stacks equipment', () => {
    const inv = emptyInventory();
    addItem(inv, 'iron_shortsword', 2);
    expect(inv.equip).toHaveLength(2);
  });

  it('stops adding when the tab is full', () => {
    const inv = emptyInventory();
    expect(addItem(inv, 'iron_shortsword', TAB_CAPACITY + 3)).toBe(TAB_CAPACITY);
    expect(canAdd(inv, 'iron_shortsword', 1)).toBe(false);
    expect(canAdd(inv, 'berry_tonic', 1)).toBe(true);
  });

  it('removes items across stacks atomically', () => {
    const inv = emptyInventory();
    addItem(inv, 'mossy_shell', 120);
    expect(removeItem(inv, 'mossy_shell', 500)).toBe(false);
    expect(countItem(inv, 'mossy_shell')).toBe(120);
    expect(removeItem(inv, 'mossy_shell', 30)).toBe(true);
    expect(countItem(inv, 'mossy_shell')).toBe(90);
  });

  it('removes from a slot and drops empty slots', () => {
    const inv = emptyInventory();
    addItem(inv, 'berry_tonic', 2);
    expect(removeAt(inv, 'use', 0, 5)).toEqual({ itemId: 'berry_tonic', qty: 2 });
    expect(inv.use).toHaveLength(0);
    expect(removeAt(inv, 'use', 0, 1)).toBeNull();
  });
});
