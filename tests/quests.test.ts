import { describe, expect, it } from 'vitest';
import { createPlayer } from '../src/logic/player';
import { acceptQuest, completeQuest, npcMarker, questProgress, questStatus, recordKill } from '../src/logic/quests';
import { addItem, countItem } from '../src/logic/inventory';
import { createRng } from '../src/logic/rng';

describe('quests', () => {
  it('runs a collect quest from offer to completion', () => {
    const p = createPlayer('Test');
    expect(npcMarker(p, 'mai')).toBe('!');
    expect(acceptQuest(p, 'snail_shells')).toBe(true);
    expect(questStatus(p, 'snail_shells')).toBe('active');
    expect(npcMarker(p, 'mai')).toBeNull();
    addItem(p.inventory, 'snail_shell', 12);
    expect(questStatus(p, 'snail_shells')).toBe('ready');
    expect(npcMarker(p, 'mai')).toBe('?');
    expect(completeQuest(p, 'snail_shells', createRng(1))).toBeNull();
    expect(countItem(p.inventory, 'snail_shell')).toBe(2);
    expect(countItem(p.inventory, 'red_potion')).toBe(15);
    expect(p.level).toBe(3); // 50 EXP: 15 + 34 = level 3 with 1 EXP left
    expect(questStatus(p, 'snail_shells')).toBe('done');
  });

  it('gates a kill quest by level and counts only matching kills', () => {
    const p = createPlayer('Test');
    expect(questStatus(p, 'orange_mushrooms')).toBe('unavailable');
    expect(npcMarker(p, 'yoona')).toBeNull();
    p.level = 5;
    acceptQuest(p, 'orange_mushrooms');
    recordKill(p, 'snail');
    for (let i = 0; i < 15; i++) recordKill(p, 'orange_mushroom');
    expect(questProgress(p, 'orange_mushrooms')).toBe(15);
    expect(completeQuest(p, 'orange_mushrooms', createRng(1))).toBeNull();
    expect(p.mesos).toBe(500);
    expect(countItem(p.inventory, 'wooden_club')).toBe(1);
  });

  it('refuses to complete before the goal is met', () => {
    const p = createPlayer('Test');
    acceptQuest(p, 'snail_shells');
    expect(completeQuest(p, 'snail_shells', createRng(1))).toMatch(/not ready/);
  });
});
