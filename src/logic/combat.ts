import type { MobDef } from '../data/mobs';
import type { PlayerState } from './player';
import { equippedItems } from './player';
import type { Rng } from './rng';

/** Bare-handed attack power. */
const UNARMED_WATK = 3;

export interface Derived {
  watk: number;
  wdef: number;
  acc: number;
  avoid: number;
  minDamage: number;
  maxDamage: number;
  attackDelay: number;
}

export function derive(p: PlayerState): Derived {
  const items = equippedItems(p);
  const weapon = items.find((i) => i.slot === 'weapon');
  const watk = weapon?.watk ?? UNARMED_WATK;
  const wdef = items.reduce((n, i) => n + (i.wdef ?? 0), 0);
  // STR drives the top of the damage range, DEX lifts the bottom.
  const maxDamage = Math.max(1, Math.floor(((p.str * 4 + p.dex * 2) * watk) / 90));
  const minDamage = Math.max(1, Math.min(maxDamage, Math.floor(((p.str * 0.5 + p.dex * 2) * watk) / 90)));
  return {
    watk,
    wdef,
    acc: p.dex + p.luk * 0.4,
    avoid: p.dex * 0.3 + p.luk * 0.4,
    minDamage,
    maxDamage,
    attackDelay: weapon?.attackDelay ?? 0.5,
  };
}

/** Chance for the player to hit a monster: falls off with monster avoid and level gap. */
export function hitChance(d: Derived, playerLevel: number, mob: MobDef): number {
  const gap = Math.max(0, mob.level - playerLevel);
  return clamp(1 - mob.avoid * 0.04 - gap * 0.08 + d.acc * 0.01, 0.05, 1);
}

/** Damage dealt to a monster by a basic attack; null means a miss. */
export function rollPlayerDamage(rng: Rng, d: Derived, playerLevel: number, mob: MobDef): number | null {
  if (!rng.chance(hitChance(d, playerLevel, mob))) return null;
  return rng.int(d.minDamage, d.maxDamage);
}

/** Damage a monster deals on touch; null means the player dodged. */
export function rollMobDamage(rng: Rng, d: Derived, playerLevel: number, mob: MobDef): number | null {
  const dodge = clamp((d.avoid - Math.max(0, mob.level - playerLevel) * 2) * 0.015, 0, 0.4);
  if (rng.chance(dodge)) return null;
  const roll = mob.atk * (0.8 + rng.next() * 0.2);
  return Math.max(1, Math.round(roll - d.wdef * 0.5));
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
