import type { QuestId } from '../data/quests';
import { QUESTS, QUEST_IDS } from '../data/quests';
import { addItem, canAdd, countItem, removeItem } from './inventory';
import type { PlayerState } from './player';
import { gainExp } from './player';
import type { Rng } from './rng';

export type QuestStatus = 'unavailable' | 'available' | 'active' | 'ready' | 'done';

export function questStatus(p: PlayerState, id: QuestId): QuestStatus {
  const q = QUESTS[id];
  const progress = p.quests[id];
  if (!progress) return p.level >= q.minLevel ? 'available' : 'unavailable';
  if (progress.state === 'done') return 'done';
  return questProgress(p, id) >= q.goal.count ? 'ready' : 'active';
}

export function questProgress(p: PlayerState, id: QuestId): number {
  const goal = QUESTS[id].goal;
  const progress = p.quests[id];
  if (!progress) return 0;
  const n = goal.type === 'collect' ? countItem(p.inventory, goal.itemId) : progress.kills;
  return Math.min(n, goal.count);
}

export function acceptQuest(p: PlayerState, id: QuestId): boolean {
  if (questStatus(p, id) !== 'available') return false;
  p.quests[id] = { state: 'active', kills: 0 };
  return true;
}

/** Completes a ready quest and grants rewards. Returns an error message or null. */
export function completeQuest(p: PlayerState, id: QuestId, rng: Rng): string | null {
  if (questStatus(p, id) !== 'ready') return 'That quest is not ready yet.';
  const q = QUESTS[id];
  const rewardItems = q.reward.items ?? [];
  if (!rewardItems.every((r) => canAdd(p.inventory, r.itemId, r.qty))) return 'Please make room in your inventory first.';
  if (q.goal.type === 'collect') removeItem(p.inventory, q.goal.itemId, q.goal.count);
  for (const r of rewardItems) addItem(p.inventory, r.itemId, r.qty);
  p.acorns += q.reward.acorns ?? 0;
  gainExp(p, q.reward.exp, rng);
  p.quests[id] = { state: 'done', kills: p.quests[id]!.kills };
  return null;
}

export function recordKill(p: PlayerState, mobId: string): void {
  for (const id of QUEST_IDS) {
    const goal = QUESTS[id].goal;
    const progress = p.quests[id];
    if (progress?.state === 'active' && goal.type === 'kill' && goal.mobId === mobId) progress.kills++;
  }
}

/** Marker shown over an NPC: "!" for a new quest, "?" for one ready to hand in. */
export function npcMarker(p: PlayerState, npcId: string): '!' | '?' | null {
  const statuses = QUEST_IDS.filter((id) => QUESTS[id].npcId === npcId).map((id) => questStatus(p, id));
  if (statuses.includes('ready')) return '?';
  if (statuses.includes('available')) return '!';
  return null;
}
