export type SkillId = 'shell_toss' | 'second_wind' | 'quickstep';

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
  shell_toss: {
    id: 'shell_toss', name: 'Shell Toss', key: 'A', maxLevel: 3, mpCost: [4, 6, 8],
    description: 'Hurls a spinning shell at the first monster ahead.',
  },
  second_wind: {
    id: 'second_wind', name: 'Second Wind', key: 'D', maxLevel: 3, mpCost: [8, 10, 12],
    description: 'Restores HP every 4 seconds for 32 seconds.',
  },
  quickstep: {
    id: 'quickstep', name: 'Quickstep', key: 'F', maxLevel: 3, mpCost: [5, 7, 9],
    description: 'Briefly boosts your movement speed.',
  },
};

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

export const SHELL_TOSS_DAMAGE = [12, 24, 36];
export const SECOND_WIND_HEAL = [10, 18, 26];
export const SECOND_WIND_DURATION = 32;
export const SECOND_WIND_INTERVAL = 4;
export const QUICKSTEP_SPEED = [12, 18, 24];
export const QUICKSTEP_DURATION = [6, 10, 14];
