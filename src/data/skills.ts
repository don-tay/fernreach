export type SkillId = 'three_snails' | 'recovery' | 'nimble_feet';

export interface SkillDef {
  id: SkillId;
  name: string;
  key: string;
  maxLevel: number;
  /** Indexed by skill level - 1. */
  mpCost: number[];
  description: string;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  three_snails: {
    id: 'three_snails', name: 'Three Snails', key: 'A', maxLevel: 3, mpCost: [3, 5, 7],
    description: 'Throws a snail shell at a monster in front of you.',
  },
  recovery: {
    id: 'recovery', name: 'Recovery', key: 'D', maxLevel: 3, mpCost: [10, 10, 10],
    description: 'Recovers HP every 3 seconds for 30 seconds.',
  },
  nimble_feet: {
    id: 'nimble_feet', name: 'Nimble Feet', key: 'F', maxLevel: 3, mpCost: [4, 7, 10],
    description: 'Temporarily increases movement speed.',
  },
};

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

export const THREE_SNAILS_DAMAGE = [10, 25, 40];
export const RECOVERY_HEAL = [10, 20, 30];
export const RECOVERY_DURATION = 30;
export const RECOVERY_INTERVAL = 3;
export const NIMBLE_SPEED = [10, 15, 20];
export const NIMBLE_DURATION = [4, 8, 12];
