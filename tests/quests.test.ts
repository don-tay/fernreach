import { describe, expect, it } from 'vitest';
import { createPlayer } from '../src/logic/player';
import { acceptQuest, completeQuest, npcMarker, questProgress, questStatus, recordKill } from '../src/logic/quests';
import { addItem, countItem } from '../src/logic/inventory';
import { createRng } from '../src/logic/rng';

describe('quests', () => {
  it('runs a collect quest from offer to completion', () => {
    const p = createPlayer('Test');
    expect(npcMarker(p, 'pella')).toBe('!');
    expect(acceptQuest(p, 'shell_garden')).toBe(true);
    expect(questStatus(p, 'shell_garden')).toBe('active');
    expect(npcMarker(p, 'pella')).toBeNull();
    addItem(p.inventory, 'mossy_shell', 12);
    expect(questStatus(p, 'shell_garden')).toBe('ready');
    expect(npcMarker(p, 'pella')).toBe('?');
    expect(completeQuest(p, 'shell_garden', createRng(1))).toBeNull();
    expect(countItem(p.inventory, 'mossy_shell')).toBe(2);
    expect(countItem(p.inventory, 'berry_tonic')).toBe(15);
    expect(p.level).toBe(2); // 40 EXP: 17 for level 2, 23 of 30 towards level 3
    expect(questStatus(p, 'shell_garden')).toBe('done');
  });

  it('gates a kill quest by level and counts only matching kills', () => {
    const p = createPlayer('Test');
    expect(questStatus(p, 'bouncecap_trouble')).toBe('unavailable');
    expect(npcMarker(p, 'hazel')).toBeNull();
    p.level = 5;
    acceptQuest(p, 'bouncecap_trouble');
    recordKill(p, 'shellbug');
    for (let i = 0; i < 15; i++) recordKill(p, 'bouncecap');
    expect(questProgress(p, 'bouncecap_trouble')).toBe(15);
    expect(completeQuest(p, 'bouncecap_trouble', createRng(1))).toBeNull();
    expect(p.acorns).toBe(450);
    expect(countItem(p.inventory, 'oak_cudgel')).toBe(1);
  });

  it('refuses to complete before the goal is met', () => {
    const p = createPlayer('Test');
    acceptQuest(p, 'shell_garden');
    expect(completeQuest(p, 'shell_garden', createRng(1))).toMatch(/not ready/);
  });
});
