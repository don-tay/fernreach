import type { EquipSlot, InvTab, UseItem } from '../data/items';
import { getItem, SHOP } from '../data/items';
import type { MapDef, MobSpawn, NpcDef } from '../data/maps';
import { getMap, TOWN_MAP } from '../data/maps';
import type { MobDef } from '../data/mobs';
import { getMob } from '../data/mobs';
import type { QuestId } from '../data/quests';
import type { SkillId } from '../data/skills';
import {
  NIMBLE_DURATION, NIMBLE_SPEED, RECOVERY_DURATION, RECOVERY_HEAL, RECOVERY_INTERVAL, SKILLS, THREE_SNAILS_DAMAGE,
} from '../data/skills';
import { derive, rollMobDamage, rollPlayerDamage } from './combat';
import { addItem, canAdd, countItem, removeAt } from './inventory';
import type { Body } from './physics';
import {
  CLIMB_SPEED, createBody, JUMP_SPEED, land, platformAt, ropeToClimbDown, ropeToClimbUp, stepBody, WALK_SPEED,
} from './physics';
import type { PlayerState, StatName } from './player';
import { addAp, addSp, equipFromInventory, gainExp, MAX_LEVEL, unequip } from './player';
import { acceptQuest, completeQuest, recordKill } from './quests';
import type { Rng } from './rng';

export type Action =
  | 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'pickup'
  | 'three_snails' | 'recovery' | 'nimble_feet' | 'red_potion' | 'blue_potion';

export interface Input {
  held: ReadonlySet<Action>;
  /** Actions newly pressed since the last step. */
  pressed: ReadonlySet<Action>;
}

export type WorldEvent =
  | { type: 'damage'; target: 'mob' | 'player'; x: number; y: number; amount: number | null }
  | { type: 'message'; text: string; kind: 'gain' | 'info' | 'warn' }
  | { type: 'levelUp' }
  | { type: 'mapChanged' }
  | { type: 'npc'; npc: NpcDef }
  | { type: 'death' }
  | { type: 'ending' }
  | { type: 'swing' }
  | { type: 'skill'; skill: SkillId };

export const PLAYER_HALF_WIDTH = 14;
export const PLAYER_HEIGHT = 56;
export const RESPAWN_HP = 50;
const INVULN_TIME = 1.5;
const KNOCK_TIME = 0.35;
const ATTACK_ANIM = 0.35;
const MOB_RESPAWN = 8;
const MOB_DYING = 0.6;
const DROP_LIFETIME = 120;
const REGEN_INTERVAL = 10;
const INTERACT_RANGE = 40;
const PICKUP_RANGE = 30;
const PROJECTILE_SPEED = 450;
const PROJECTILE_RANGE = 280;

export interface PlayerRuntime {
  body: Body;
  facing: 1 | -1;
  /** Rope index being climbed, or -1. */
  climbing: number;
  attackTimer: number;
  attackCooldown: number;
  invuln: number;
  knockTimer: number;
  pickupCooldown: number;
  regenTimer: number;
  dead: boolean;
  recovery: { remaining: number; tick: number; level: number } | null;
  nimble: { remaining: number; level: number } | null;
}

export interface Mob {
  uid: number;
  def: MobDef;
  spawn: MobSpawn;
  x: number;
  y: number;
  hp: number;
  dir: -1 | 0 | 1;
  state: 'alive' | 'dying' | 'dead';
  timer: number;
  aggro: number;
  stun: number;
  hpBarTimer: number;
  minX: number;
  maxX: number;
}

export interface DropEntity {
  uid: number;
  x: number;
  y: number;
  vy: number;
  targetY: number;
  settled: boolean;
  age: number;
  itemId?: string;
  mesos?: number;
}

export interface Projectile {
  uid: number;
  x: number;
  y: number;
  dir: 1 | -1;
  travelled: number;
  damage: number;
}

type Listener = (e: WorldEvent) => void;

export class World {
  map!: MapDef;
  pr: PlayerRuntime;
  mobs: Mob[] = [];
  drops: DropEntity[] = [];
  projectiles: Projectile[] = [];
  /** Incremented whenever player-facing state changes, so the UI knows to re-render. */
  version = 0;
  /** True while a modal UI (dialog, shop) is open: player input is ignored. */
  blocked = false;
  private uid = 1;
  private listeners: Listener[] = [];

  constructor(public player: PlayerState, public rng: Rng) {
    this.pr = {
      body: createBody(player.x, player.y, PLAYER_HALF_WIDTH),
      facing: 1, climbing: -1, attackTimer: 0, attackCooldown: 0, invuln: 0, knockTimer: 0, pickupCooldown: 0,
      regenTimer: 0, dead: false, recovery: null, nimble: null,
    };
    if (player.hp <= 0) {
      player.hp = Math.min(RESPAWN_HP, player.maxHp);
      this.loadMap(TOWN_MAP);
    } else {
      this.loadMap(player.mapId, undefined, { x: player.x, y: player.y });
    }
  }

  on(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => (this.listeners = this.listeners.filter((l) => l !== listener));
  }

  private emit(e: WorldEvent): void {
    for (const l of this.listeners) l(e);
  }

  private message(text: string, kind: 'gain' | 'info' | 'warn' = 'info'): void {
    this.emit({ type: 'message', text, kind });
  }

  private changed(): void {
    this.version++;
  }

  // ---------------------------------------------------------------- maps

  loadMap(mapId: string, portalId?: string, at?: { x: number; y: number }): void {
    this.map = getMap(mapId);
    const portal = this.map.portals.find((p) => p.id === portalId);
    const pos = at ?? portal ?? this.map.spawn;
    const b = this.pr.body;
    Object.assign(b, createBody(pos.x, pos.y - 1, PLAYER_HALF_WIDTH));
    const pi = platformAt(this.map.platforms, pos.x, pos.y);
    if (pi >= 0) land(b, this.map.platforms, pi);
    this.pr.climbing = -1;
    this.player.mapId = mapId;
    this.syncPosition();
    this.mobs = this.map.mobSpawns.map((s) => this.createMob(s));
    this.drops = [];
    this.projectiles = [];
    this.changed();
    this.emit({ type: 'mapChanged' });
  }

  private createMob(spawn: MobSpawn): Mob {
    const def = getMob(spawn.mobId);
    const p = this.map.platforms[spawn.platform];
    const margin = def.width / 2;
    const wide = p.x2 - p.x1 > 600;
    return {
      uid: this.uid++, def, spawn, x: spawn.x, y: p.y, hp: def.hp, dir: 0, state: 'alive',
      timer: this.rng.next() * 2, aggro: 0, stun: 0, hpBarTimer: 0,
      minX: Math.max(p.x1 + margin, wide ? spawn.x - 220 : -Infinity),
      maxX: Math.min(p.x2 - margin, wide ? spawn.x + 220 : Infinity),
    };
  }

  private syncPosition(): void {
    this.player.x = Math.round(this.pr.body.x);
    this.player.y = Math.round(this.pr.body.y);
  }

  // ---------------------------------------------------------------- loop

  step(dt: number, input: Input): void {
    const none: Input = { held: new Set(), pressed: new Set() };
    const inp = this.blocked || this.pr.dead || this.player.finished ? none : input;
    this.updatePlayer(dt, inp);
    this.updateMobs(dt);
    this.updateProjectiles(dt);
    this.updateDrops(dt);
    if (!this.pr.dead) this.checkMobContact();
  }

  get derived() {
    return derive(this.player);
  }

  get speed(): number {
    return WALK_SPEED * (1 + (this.pr.nimble ? NIMBLE_SPEED[this.pr.nimble.level - 1] : 0) / 100);
  }

  private updatePlayer(dt: number, input: Input): void {
    const pr = this.pr;
    const b = pr.body;
    const plats = this.map.platforms;
    pr.attackTimer = Math.max(0, pr.attackTimer - dt);
    pr.attackCooldown = Math.max(0, pr.attackCooldown - dt);
    pr.invuln = Math.max(0, pr.invuln - dt);
    pr.knockTimer = Math.max(0, pr.knockTimer - dt);
    pr.pickupCooldown = Math.max(0, pr.pickupCooldown - dt);
    this.updateBuffs(dt);

    const dir = (input.held.has('right') ? 1 : 0) - (input.held.has('left') ? 1 : 0);

    if (pr.climbing >= 0) {
      this.updateClimbing(dt, input, dir);
    } else {
      if (dir !== 0 && pr.attackTimer === 0) pr.facing = dir as 1 | -1;

      if (input.pressed.has('up') && b.onGround && this.tryPortalOrNpc()) return;

      if (input.held.has('up')) {
        const r = ropeToClimbUp(this.map.ropes, b);
        if (r >= 0) return this.grabRope(r);
      }
      if (input.held.has('down')) {
        const r = ropeToClimbDown(this.map.ropes, b);
        if (r >= 0) {
          this.grabRope(r);
          b.y += 4;
          return;
        }
      }

      if (pr.knockTimer === 0) {
        const target = dir * this.speed;
        if (b.onGround) b.vx = pr.attackTimer > 0 ? 0 : target;
        else if (dir !== 0) b.vx += Math.sign(target - b.vx) * Math.min(Math.abs(target - b.vx), 400 * dt);
      }

      if (input.pressed.has('jump') && b.onGround) {
        const p = plats[b.platform];
        if (input.held.has('down') && p && !p.solid) {
          b.dropThrough = b.platform;
          b.dropTimer = 0.25;
          b.onGround = false;
          b.platform = -1;
        } else if (!input.held.has('down')) {
          b.vy = -JUMP_SPEED;
          b.onGround = false;
          b.platform = -1;
        }
      }

      stepBody(b, plats, this.map.width, dt);
      if (b.onGround && pr.knockTimer === 0 && dir === 0) b.vx = 0;

      if (input.held.has('attack')) this.basicAttack();
      if (input.held.has('pickup')) this.tryPickup();
    }

    if (input.pressed.has('three_snails')) this.castThreeSnails();
    if (input.pressed.has('recovery')) this.castBuff('recovery');
    if (input.pressed.has('nimble_feet')) this.castBuff('nimble_feet');
    if (input.pressed.has('red_potion')) this.useItemById('red_potion');
    if (input.pressed.has('blue_potion')) this.useItemById('blue_potion');

    if (!pr.dead) {
      pr.regenTimer += dt;
      if (pr.regenTimer >= REGEN_INTERVAL) {
        pr.regenTimer = 0;
        this.heal(5, 3);
      }
    }
    this.syncPosition();
  }

  private grabRope(index: number): void {
    const b = this.pr.body;
    this.pr.climbing = index;
    b.x = this.map.ropes[index].x;
    b.vx = 0;
    b.vy = 0;
    b.onGround = false;
    b.platform = -1;
  }

  private updateClimbing(dt: number, input: Input, dir: number): void {
    const pr = this.pr;
    const b = pr.body;
    const rope = this.map.ropes[pr.climbing];
    if (input.pressed.has('jump') && dir !== 0) {
      pr.climbing = -1;
      pr.facing = dir as 1 | -1;
      b.vx = dir * WALK_SPEED * 0.8;
      b.vy = -JUMP_SPEED * 0.55;
      return;
    }
    const dy = ((input.held.has('down') ? 1 : 0) - (input.held.has('up') ? 1 : 0)) * CLIMB_SPEED * dt;
    b.y += dy;
    if (b.y <= rope.top) {
      b.y = rope.top;
      const pi = platformAt(this.map.platforms, rope.x, rope.top);
      if (pi >= 0) {
        pr.climbing = -1;
        land(b, this.map.platforms, pi);
      }
    } else if (b.y >= rope.bottom + 20) {
      pr.climbing = -1;
      b.vy = 0;
      stepBody(b, this.map.platforms, this.map.width, dt);
    }
  }

  private tryPortalOrNpc(): boolean {
    const b = this.pr.body;
    const portal = this.map.portals.find((p) => Math.abs(p.x - b.x) < 25 && Math.abs(p.y - b.y) < 5);
    if (portal) {
      this.loadMap(portal.target, portal.targetPortal);
      return true;
    }
    const npc = this.nearbyNpc();
    if (npc) {
      this.emit({ type: 'npc', npc });
      return true;
    }
    return false;
  }

  nearbyNpc(): NpcDef | null {
    const b = this.pr.body;
    return this.map.npcs.find((n) => Math.abs(n.x - b.x) < INTERACT_RANGE && Math.abs(n.y - b.y) < 10) ?? null;
  }

  /** Talk to an NPC by id (e.g. when clicked), if it is in this map. */
  talkTo(npcId: string): void {
    const npc = this.map.npcs.find((n) => n.id === npcId);
    if (npc && !this.blocked && !this.pr.dead) this.emit({ type: 'npc', npc });
  }

  private updateBuffs(dt: number): void {
    const pr = this.pr;
    if (pr.recovery) {
      pr.recovery.remaining -= dt;
      pr.recovery.tick -= dt;
      if (pr.recovery.tick <= 0) {
        pr.recovery.tick += RECOVERY_INTERVAL;
        this.heal(RECOVERY_HEAL[pr.recovery.level - 1], 0);
      }
      if (pr.recovery.remaining <= 0) pr.recovery = null;
    }
    if (pr.nimble) {
      pr.nimble.remaining -= dt;
      if (pr.nimble.remaining <= 0) pr.nimble = null;
    }
  }

  private heal(hp: number, mp: number): void {
    if (this.pr.dead) return;
    const p = this.player;
    const before = p.hp + p.mp;
    p.hp = Math.min(p.maxHp, p.hp + hp);
    p.mp = Math.min(p.maxMp, p.mp + mp);
    if (p.hp + p.mp !== before) this.changed();
  }

  // ---------------------------------------------------------------- combat

  private basicAttack(): void {
    const pr = this.pr;
    if (pr.attackCooldown > 0) return;
    const d = this.derived;
    pr.attackCooldown = d.attackDelay;
    pr.attackTimer = ATTACK_ANIM;
    this.emit({ type: 'swing' });
    const b = pr.body;
    const x1 = pr.facing > 0 ? b.x - 5 : b.x - 70;
    const x2 = pr.facing > 0 ? b.x + 70 : b.x + 5;
    const target = this.mobs
      .filter((m) => m.state === 'alive' && m.x + m.def.width / 2 >= x1 && m.x - m.def.width / 2 <= x2)
      .filter((m) => m.y - m.def.height <= b.y + 5 && m.y >= b.y - PLAYER_HEIGHT)
      .sort((a, c) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x))[0];
    if (!target) return;
    this.damageMob(target, rollPlayerDamage(this.rng, d, this.player.level, target.def));
  }

  private castThreeSnails(): void {
    const level = this.player.skills.three_snails;
    if (this.pr.climbing >= 0 || this.pr.attackCooldown > 0) return;
    if (!this.spendMp('three_snails', level)) return;
    const b = this.pr.body;
    this.pr.attackCooldown = 0.6;
    this.pr.attackTimer = ATTACK_ANIM;
    this.projectiles.push({
      uid: this.uid++, x: b.x + this.pr.facing * 16, y: b.y - 32, dir: this.pr.facing, travelled: 0,
      damage: THREE_SNAILS_DAMAGE[level - 1],
    });
    this.emit({ type: 'skill', skill: 'three_snails' });
  }

  private castBuff(skill: 'recovery' | 'nimble_feet'): void {
    const level = this.player.skills[skill];
    if (!this.spendMp(skill, level)) return;
    if (skill === 'recovery') this.pr.recovery = { remaining: RECOVERY_DURATION, tick: RECOVERY_INTERVAL, level };
    else this.pr.nimble = { remaining: NIMBLE_DURATION[level - 1], level };
    this.emit({ type: 'skill', skill });
  }

  private spendMp(skill: SkillId, level: number): boolean {
    if (level <= 0) {
      this.message(`You haven't learned ${SKILLS[skill].name} yet. Open the skill window (K).`, 'warn');
      return false;
    }
    const cost = SKILLS[skill].mpCost[level - 1];
    if (this.player.mp < cost) {
      this.message('Not enough MP.', 'warn');
      return false;
    }
    this.player.mp -= cost;
    this.changed();
    return true;
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      const dx = PROJECTILE_SPEED * dt;
      p.x += p.dir * dx;
      p.travelled += dx;
      const hit = this.mobs.find(
        (m) => m.state === 'alive' && Math.abs(m.x - p.x) <= m.def.width / 2 && p.y >= m.y - m.def.height - 10 && p.y <= m.y + 10,
      );
      if (hit) {
        this.damageMob(hit, p.damage);
        p.travelled = Infinity;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.travelled < PROJECTILE_RANGE);
  }

  private damageMob(mob: Mob, amount: number | null): void {
    this.emit({ type: 'damage', target: 'mob', x: mob.x, y: mob.y - mob.def.height, amount });
    if (amount === null) return;
    mob.hp -= amount;
    mob.stun = 0.3;
    mob.aggro = 6;
    mob.hpBarTimer = 5;
    mob.x = Math.min(mob.maxX, Math.max(mob.minX, mob.x + Math.sign(mob.x - this.pr.body.x) * 8));
    if (mob.hp <= 0) this.killMob(mob);
  }

  private killMob(mob: Mob): void {
    mob.hp = 0;
    mob.state = 'dying';
    mob.timer = MOB_DYING;
    const p = this.player;
    if (p.level < MAX_LEVEL) this.message(`You have gained experience (+${mob.def.exp})`, 'gain');
    this.grantExp(mob.def.exp);
    recordKill(p, mob.def.id);
    this.spawnDrops(mob);
    this.changed();
  }

  private grantExp(amount: number): void {
    const levels = gainExp(this.player, amount, this.rng);
    for (let i = 0; i < levels; i++) {
      this.message(`Congratulations! You reached level ${this.player.level - levels + i + 1}!`, 'gain');
      this.emit({ type: 'levelUp' });
    }
    this.changed();
  }

  private spawnDrops(mob: Mob): void {
    const loot: Omit<DropEntity, 'uid' | 'x' | 'y' | 'vy' | 'targetY' | 'settled' | 'age'>[] = [];
    if (this.rng.chance(0.7)) loot.push({ mesos: this.rng.int(mob.def.meso[0], mob.def.meso[1]) });
    for (const d of mob.def.drops) if (this.rng.chance(d.chance)) loot.push({ itemId: d.itemId });
    loot.forEach((l, i) => this.addDrop(mob.x + (i - (loot.length - 1) / 2) * 22, mob.y, l));
  }

  addDrop(x: number, y: number, loot: { itemId?: string; mesos?: number }): void {
    this.drops.push({ uid: this.uid++, x, y: y - 20, vy: -380, targetY: y, settled: false, age: 0, ...loot });
  }

  private checkMobContact(): void {
    const pr = this.pr;
    if (pr.invuln > 0) return;
    const b = pr.body;
    const mob = this.mobs.find(
      (m) =>
        m.state === 'alive' &&
        Math.abs(m.x - b.x) < PLAYER_HALF_WIDTH + m.def.width * 0.4 &&
        b.y > m.y - m.def.height * 0.8 &&
        b.y - PLAYER_HEIGHT < m.y,
    );
    if (!mob) return;
    const dmg = rollMobDamage(this.rng, this.derived, this.player.level, mob.def);
    this.emit({ type: 'damage', target: 'player', x: b.x, y: b.y - PLAYER_HEIGHT, amount: dmg });
    pr.invuln = INVULN_TIME;
    if (dmg === null) return;
    const away = b.x < mob.x ? -1 : 1;
    pr.climbing = -1;
    pr.knockTimer = KNOCK_TIME;
    b.vx = away * 150;
    b.vy = -250;
    b.onGround = false;
    b.platform = -1;
    this.player.hp = Math.max(0, this.player.hp - dmg);
    this.changed();
    if (this.player.hp === 0) {
      pr.dead = true;
      pr.recovery = null;
      pr.nimble = null;
      this.emit({ type: 'death' });
    }
  }

  private updateMobs(dt: number): void {
    const b = this.pr.body;
    for (const m of this.mobs) {
      m.hpBarTimer = Math.max(0, m.hpBarTimer - dt);
      if (m.state === 'dying') {
        m.timer -= dt;
        if (m.timer <= 0) {
          m.state = 'dead';
          m.timer = MOB_RESPAWN;
        }
        continue;
      }
      if (m.state === 'dead') {
        m.timer -= dt;
        if (m.timer <= 0) Object.assign(m, this.createMob(m.spawn), { x: this.rng.int(Math.round(m.minX), Math.round(m.maxX)) });
        continue;
      }
      if (m.stun > 0) {
        m.stun -= dt;
        continue;
      }
      let speed = m.def.speed;
      if (m.aggro > 0) {
        m.aggro -= dt;
        const samePlatform = Math.abs(b.y - m.y) < 40 && !this.pr.dead;
        m.dir = samePlatform && Math.abs(b.x - m.x) > 4 ? (b.x > m.x ? 1 : -1) : m.dir;
        speed *= 1.3;
      } else {
        m.timer -= dt;
        if (m.timer <= 0) {
          m.timer = 1.5 + this.rng.next() * 2.5;
          m.dir = this.rng.chance(0.3) ? 0 : this.rng.chance(0.5) ? 1 : -1;
        }
      }
      m.x += m.dir * speed * dt;
      if (m.x <= m.minX || m.x >= m.maxX) {
        m.x = Math.min(m.maxX, Math.max(m.minX, m.x));
        if (m.aggro <= 0) m.dir = m.x <= m.minX ? 1 : -1;
      }
    }
  }

  private updateDrops(dt: number): void {
    for (const d of this.drops) {
      d.age += dt;
      if (d.settled) continue;
      d.vy += 1600 * dt;
      d.y += d.vy * dt;
      if (d.vy > 0 && d.y >= d.targetY) {
        d.y = d.targetY;
        d.settled = true;
      }
    }
    this.drops = this.drops.filter((d) => d.age < DROP_LIFETIME);
  }

  private tryPickup(): void {
    const b = this.pr.body;
    if (this.pr.pickupCooldown > 0) return;
    const drop = this.drops
      .filter((d) => d.settled && Math.abs(d.x - b.x) < PICKUP_RANGE && Math.abs(d.y - b.y) < PICKUP_RANGE)
      .sort((a, c) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x))[0];
    if (!drop) return;
    this.pr.pickupCooldown = 0.15;
    if (drop.mesos) {
      this.player.mesos += drop.mesos;
      this.message(`You have gained mesos (+${drop.mesos})`, 'gain');
    } else if (drop.itemId) {
      if (addItem(this.player.inventory, drop.itemId, 1) === 0) {
        this.message('Your inventory is full.', 'warn');
        return;
      }
      this.message(`You have gained an item (${getItem(drop.itemId).name})`, 'gain');
    }
    this.drops = this.drops.filter((d) => d !== drop);
    this.changed();
  }

  // ---------------------------------------------------------------- UI actions

  useItemById(itemId: string): void {
    const index = this.player.inventory.use.findIndex((s) => s.itemId === itemId);
    if (index < 0) return this.message(`You have no ${getItem(itemId).name}s.`, 'warn');
    this.useItem(index);
  }

  useItem(index: number): void {
    const slot = this.player.inventory.use[index];
    if (!slot || this.pr.dead) return;
    const item = getItem(slot.itemId) as UseItem;
    removeAt(this.player.inventory, 'use', index, 1);
    this.heal(item.hp ?? 0, item.mp ?? 0);
    this.changed();
  }

  equip(index: number): void {
    const err = equipFromInventory(this.player, index);
    if (err) this.message(err, 'warn');
    this.changed();
  }

  unequip(slot: EquipSlot): void {
    const err = unequip(this.player, slot);
    if (err) this.message(err, 'warn');
    this.changed();
  }

  addAp(stat: StatName): void {
    if (addAp(this.player, stat)) this.changed();
  }

  addSp(skill: SkillId): void {
    if (addSp(this.player, skill)) this.changed();
  }

  buy(itemId: string, qty: number): string | null {
    const entry = SHOP.find((s) => s.itemId === itemId);
    if (!entry) return 'That item is not for sale.';
    const cost = entry.price * qty;
    if (this.player.mesos < cost) return 'You do not have enough mesos.';
    if (!canAdd(this.player.inventory, itemId, qty)) return 'Your inventory is full.';
    this.player.mesos -= cost;
    addItem(this.player.inventory, itemId, qty);
    this.changed();
    return null;
  }

  sell(tab: InvTab, index: number, qty: number): string | null {
    const removed = removeAt(this.player.inventory, tab, index, qty);
    if (!removed) return 'Nothing to sell.';
    this.player.mesos += getItem(removed.itemId).sell * removed.qty;
    this.changed();
    return null;
  }

  acceptQuest(id: QuestId): void {
    if (acceptQuest(this.player, id)) this.changed();
  }

  completeQuest(id: QuestId): string | null {
    const levelBefore = this.player.level;
    const err = completeQuest(this.player, id, this.rng);
    if (err) return err;
    for (let lv = levelBefore + 1; lv <= this.player.level; lv++) {
      this.message(`Congratulations! You reached level ${lv}!`, 'gain');
      this.emit({ type: 'levelUp' });
    }
    this.changed();
    return null;
  }

  countItem(itemId: string): number {
    return countItem(this.player.inventory, itemId);
  }

  respawn(): void {
    if (!this.pr.dead) return;
    this.pr.dead = false;
    this.pr.invuln = 2;
    this.player.hp = Math.min(RESPAWN_HP, this.player.maxHp);
    this.loadMap(TOWN_MAP);
  }

  /** Sail to Victoria Island: the end of the MVP. */
  travelToVictoria(): string | null {
    if (this.player.level < MAX_LEVEL) return `Come back when you're level ${MAX_LEVEL}.`;
    this.player.finished = true;
    this.changed();
    this.emit({ type: 'ending' });
    return null;
  }

  keepPlaying(): void {
    this.player.finished = false;
    this.changed();
  }

  // Test helpers (used by the dev-only test hook).
  grantExpForTest(amount: number): void {
    this.grantExp(amount);
  }
}
