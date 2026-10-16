import type { PlayerRuntime } from './world';

export const POSES = ['stand', 'walk', 'jump', 'climb', 'attack', 'dead'] as const;
export type Pose = (typeof POSES)[number];

/** The character's current animation, shared by the renderer and the network. */
export function poseOf(pr: PlayerRuntime): Pose {
  if (pr.dead) return 'dead';
  if (pr.climbing >= 0) return 'climb';
  if (pr.attackTimer > 0) return 'attack';
  if (!pr.body.onGround) return 'jump';
  if (Math.abs(pr.body.vx) > 1) return 'walk';
  return 'stand';
}
