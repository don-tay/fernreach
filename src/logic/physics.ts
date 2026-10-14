import type { Platform, Rope } from '../data/maps';

export const GRAVITY = 2000;
export const MAX_FALL_SPEED = 670;
export const JUMP_SPEED = 600;
export const WALK_SPEED = 125;
export const CLIMB_SPEED = 100;

/** A physics body positioned by its feet (bottom-centre). */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  halfWidth: number;
  onGround: boolean;
  /** Index of the platform stood on, or -1. */
  platform: number;
  /** Platform temporarily ignored while dropping through it. */
  dropThrough: number;
  dropTimer: number;
}

export function createBody(x: number, y: number, halfWidth: number): Body {
  return { x, y, vx: 0, vy: 0, halfWidth, onGround: false, platform: -1, dropThrough: -1, dropTimer: 0 };
}

/** Integrates gravity and velocity, landing on one-way platforms from above. */
export function stepBody(b: Body, platforms: Platform[], mapWidth: number, dt: number): void {
  if (b.dropTimer > 0) {
    b.dropTimer -= dt;
    if (b.dropTimer <= 0) b.dropThrough = -1;
  }

  b.x = Math.min(mapWidth - b.halfWidth, Math.max(b.halfWidth, b.x + b.vx * dt));

  if (b.onGround) {
    const p = platforms[b.platform];
    if (p && b.x >= p.x1 && b.x <= p.x2) {
      b.y = p.y;
      b.vy = 0;
      return;
    }
    b.onGround = false;
    b.platform = -1;
  }

  const prevY = b.y;
  b.vy = Math.min(MAX_FALL_SPEED, b.vy + GRAVITY * dt);
  b.y += b.vy * dt;
  if (b.vy < 0) return;

  let landed = -1;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (i === b.dropThrough || b.x < p.x1 || b.x > p.x2) continue;
    if (prevY <= p.y + 0.01 && b.y >= p.y && (landed === -1 || p.y < platforms[landed].y)) landed = i;
  }
  if (landed !== -1) land(b, platforms, landed);
}

export function land(b: Body, platforms: Platform[], index: number): void {
  b.y = platforms[index].y;
  b.vy = 0;
  b.onGround = true;
  b.platform = index;
}

/** Index of the platform whose surface is at (x, y), or -1. */
export function platformAt(platforms: Platform[], x: number, y: number): number {
  return platforms.findIndex((p) => Math.abs(p.y - y) < 1 && x >= p.x1 && x <= p.x2);
}

const GRAB_RANGE = 12;

/** Rope the body can grab while pressing up (body overlaps the rope). */
export function ropeToClimbUp(ropes: Rope[], b: Body): number {
  return ropes.findIndex((r) => Math.abs(b.x - r.x) <= GRAB_RANGE && b.y > r.top + 2 && b.y - 30 <= r.bottom);
}

/** Rope hanging below the platform the body stands on (pressing down). */
export function ropeToClimbDown(ropes: Rope[], b: Body): number {
  if (!b.onGround) return -1;
  return ropes.findIndex((r) => Math.abs(b.x - r.x) <= GRAB_RANGE && Math.abs(b.y - r.top) < 2);
}
