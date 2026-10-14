import * as Phaser from 'phaser';
import type { CharFrame } from '../art/draw';
import {
  CHAR_FRAMES, drawCharacter, drawHatOverlay, drawHills, drawItemIcon, drawMapLayer, drawMeso, drawMob, drawPortal, drawSky,
  drawWeapon,
} from '../art/draw';
import { ITEMS } from '../data/items';
import { MOBS } from '../data/mobs';
import { MAPS } from '../data/maps';
import { npcMarker } from '../logic/quests';
import type { World, WorldEvent } from '../logic/world';
import { PLAYER_HEIGHT } from '../logic/world';
import type { Keyboard } from './input';

export const VIEW_W = 800;
export const VIEW_H = 600;
const STEP = 1 / 60;
const ATTACK_ANIM = 0.35;

const PLAYER_LOOK = { hair: '#6a3a1a', shirt: '#f4f4f4', pants: '#3a5aa0', shoes: '#a87a4a' };
const NAME_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Verdana, sans-serif', fontSize: '11px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.55)',
  padding: { x: 4, y: 1 },
};

interface MobView {
  sprite: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
}

/** Renders the World and drives it with a fixed timestep. All game rules live in World. */
export class WorldScene extends Phaser.Scene {
  private acc = 0;
  private mapObjects: Phaser.GameObjects.GameObject[] = [];
  private hills?: Phaser.GameObjects.TileSprite;
  private mobViews = new Map<number, MobView>();
  private dropViews = new Map<number, Phaser.GameObjects.Image>();
  private projectileViews = new Map<number, Phaser.GameObjects.Image>();
  private npcMarkers = new Map<string, Phaser.GameObjects.Text>();
  private player!: Phaser.GameObjects.Image;
  private weapon!: Phaser.GameObjects.Image;
  private hat!: Phaser.GameObjects.Image;
  private nameTag!: Phaser.GameObjects.Text;
  private mapDirty = true;

  constructor(private world: World, private keyboard: Keyboard) {
    super('world');
  }

  create(): void {
    this.registerTextures();
    this.player = this.add.image(0, 0, 'player_stand').setOrigin(0.5, 1).setDepth(7);
    this.weapon = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 0.9).setDepth(7.1);
    this.hat = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1).setDepth(7.2);
    this.nameTag = this.add.text(0, 0, this.world.player.name, NAME_STYLE).setOrigin(0.5, 0).setDepth(7);
    const off = this.world.on((e) => this.onEvent(e));
    this.events.once('shutdown', off);
  }

  private registerTextures(): void {
    const add = (key: string, canvas: HTMLCanvasElement) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, canvas);
    };
    for (const f of CHAR_FRAMES) add(`player_${f}`, drawCharacter(PLAYER_LOOK, f));
    for (const map of Object.values(MAPS)) {
      for (const npc of map.npcs) {
        add(`npc_${npc.id}`, drawCharacter({ hair: npc.hair, shirt: npc.shirt, pants: '#5a4a3a', shoes: '#4a3a2a' }, 'stand'));
      }
    }
    for (const id of Object.keys(MOBS)) {
      add(`mob_${id}_0`, drawMob(id, 0));
      add(`mob_${id}_1`, drawMob(id, 1));
    }
    for (const [id, item] of Object.entries(ITEMS)) {
      add(`item_${id}`, drawItemIcon(id));
      if (item.tab === 'equip' && item.slot === 'weapon') add(`weapon_${id}`, drawWeapon(id));
      if (item.tab === 'equip' && item.slot === 'hat') add(`hat_${id}`, drawHatOverlay(id));
    }
    add('meso', drawMeso());
    add('portal', drawPortal());
  }

  private onEvent(e: WorldEvent): void {
    if (e.type === 'mapChanged') this.mapDirty = true;
    else if (e.type === 'damage') this.damageNumber(e);
    else if (e.type === 'levelUp') this.levelUpEffect();
  }

  // ---------------------------------------------------------------- map

  private buildMap(): void {
    for (const o of this.mapObjects) o.destroy();
    this.mapObjects = [];
    for (const v of this.mobViews.values()) this.destroyMobView(v);
    this.mobViews.clear();
    for (const v of this.dropViews.values()) v.destroy();
    this.dropViews.clear();
    for (const v of this.projectileViews.values()) v.destroy();
    this.projectileViews.clear();
    this.npcMarkers.clear();

    const map = this.world.map;
    const key = (k: string, canvas: () => HTMLCanvasElement) => {
      if (!this.textures.exists(k)) this.textures.addCanvas(k, canvas());
      return k;
    };
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.mapObjects.push(o);
      return o;
    };

    keep(this.add.image(0, 0, key(`sky_${map.theme}`, () => drawSky(map.theme))).setOrigin(0).setScrollFactor(0).setDepth(0));
    this.hills = keep(
      this.add.tileSprite(0, 0, VIEW_W, VIEW_H, key(`hills_${map.theme}`, () => drawHills(map.theme)))
        .setOrigin(0).setScrollFactor(0).setDepth(1),
    );
    keep(this.add.image(0, 0, key(`map_${map.id}`, () => drawMapLayer(map))).setOrigin(0).setDepth(2));

    for (const p of map.portals) {
      const img = keep(this.add.image(p.x, p.y + 4, 'portal').setOrigin(0.5, 1).setDepth(3).setAlpha(0.85));
      this.tweens.add({ targets: img, scaleX: 0.85, alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
    }
    for (const npc of map.npcs) {
      const img = keep(this.add.image(npc.x, npc.y, `npc_${npc.id}`).setOrigin(0.5, 1).setFlipX(true).setDepth(4));
      img.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.world.talkTo(npc.id));
      keep(this.add.text(npc.x, npc.y + 4, npc.name, { ...NAME_STYLE, color: '#ffe36a' }).setOrigin(0.5, 0).setDepth(4));
      const marker = keep(
        this.add.text(npc.x, npc.y - 70, '', {
          fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color: '#ffd23a', stroke: '#6a3a00', strokeThickness: 4,
        }).setOrigin(0.5, 1).setDepth(4),
      );
      this.tweens.add({ targets: marker, y: npc.y - 78, duration: 500, yoyo: true, repeat: -1 });
      this.npcMarkers.set(npc.id, marker);
    }

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.width, map.height);
    cam.centerOn(this.world.pr.body.x, this.world.pr.body.y - 120);
    this.mapDirty = false;
  }

  private destroyMobView(v: MobView): void {
    v.sprite.destroy();
    v.bar.destroy();
  }

  // ---------------------------------------------------------------- loop

  update(time: number, delta: number): void {
    const input = this.keyboard.consume();
    this.acc += Math.min(delta / 1000, 0.1);
    let first = true;
    while (this.acc >= STEP) {
      this.world.step(STEP, first ? input : { held: input.held, pressed: new Set() });
      first = false;
      this.acc -= STEP;
    }
    if (first) this.keyboard.restore(input);
    if (this.mapDirty) this.buildMap();
    this.render(time / 1000);
  }

  private render(t: number): void {
    const w = this.world;
    this.renderPlayer(t);
    this.renderMobs(t);
    this.renderDrops(t);
    this.renderProjectiles();
    for (const [id, marker] of this.npcMarkers) marker.setText(npcMarker(w.player, id) ?? '');

    const cam = this.cameras.main;
    const b = w.pr.body;
    const tx = b.x - VIEW_W / 2;
    const ty = b.y - VIEW_H / 2 - 60;
    cam.scrollX += (tx - cam.scrollX) * 0.12;
    cam.scrollY += (ty - cam.scrollY) * 0.12;
    if (this.hills) this.hills.tilePositionX = cam.scrollX * 0.3;
  }

  private renderPlayer(t: number): void {
    const pr = this.world.pr;
    const b = pr.body;
    let frame: CharFrame = 'stand';
    if (pr.climbing >= 0) frame = 'climb';
    else if (pr.attackTimer > 0) frame = 'attack';
    else if (!b.onGround) frame = 'jump';
    else if (Math.abs(b.vx) > 1) frame = Math.floor(t / 0.15) % 2 ? 'walk1' : 'walk2';
    const flip = pr.facing < 0;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const alpha = pr.dead ? 0.5 : pr.invuln > 0 && Math.floor(t * 12) % 2 ? 0.45 : 1;
    const bob = frame === 'climb' ? Math.floor(b.y / 10) % 2 : 0;

    this.player.setTexture(`player_${frame}`).setPosition(x, y).setFlipX(flip).setAlpha(alpha);
    this.player.setAngle(pr.dead ? (flip ? -90 : 90) : 0);
    if (frame === 'climb') this.player.setFlipX(bob === 1);

    const eq = this.world.player.equipment;
    this.hat.setVisible(!!eq.hat && !pr.dead && frame !== 'climb');
    if (eq.hat) this.hat.setTexture(`hat_${eq.hat}`).setPosition(x, y).setFlipX(flip).setAlpha(alpha);

    const showWeapon = !!eq.weapon && frame !== 'climb' && !pr.dead;
    this.weapon.setVisible(showWeapon);
    if (showWeapon) {
      const s = flip ? -1 : 1;
      const attacking = pr.attackTimer > 0;
      const progress = 1 - pr.attackTimer / ATTACK_ANIM;
      const angle = attacking ? -110 + 190 * progress : 25;
      const [hx, hy] = attacking ? [16, -22] : [9, -15];
      this.weapon.setTexture(`weapon_${eq.weapon}`).setPosition(x + hx * s, y + hy).setAngle(angle * s).setFlipX(flip).setAlpha(alpha);
    }
    this.nameTag.setPosition(x, y + 3);
  }

  private renderMobs(t: number): void {
    const seen = new Set<number>();
    for (const m of this.world.mobs) {
      seen.add(m.uid);
      let v = this.mobViews.get(m.uid);
      if (!v) {
        v = { sprite: this.add.image(m.x, m.y, `mob_${m.def.id}_0`).setOrigin(0.5, 1).setDepth(6), bar: this.add.graphics().setDepth(6.5) };
        this.mobViews.set(m.uid, v);
      }
      const visible = m.state !== 'dead';
      v.sprite.setVisible(visible);
      v.bar.clear();
      if (!visible) continue;
      const frame = m.dir !== 0 && m.state === 'alive' ? Math.floor(t / 0.25) % 2 : 0;
      v.sprite.setTexture(`mob_${m.def.id}_${frame}`).setPosition(Math.round(m.x), Math.round(m.y));
      if (m.dir !== 0) v.sprite.setFlipX(m.dir > 0);
      v.sprite.setAlpha(m.state === 'dying' ? Math.max(0, m.timer / 0.6) : 1);
      if (m.stun > 0) v.sprite.setTint(0xff9a9a);
      else v.sprite.clearTint();
      if (m.hpBarTimer > 0 && m.state === 'alive') {
        const w = 40;
        const x = m.x - w / 2;
        const y = m.y - m.def.height - 12;
        v.bar.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, w + 2, 6);
        v.bar.fillStyle(0xe8303a, 1).fillRect(x, y, (w * m.hp) / m.def.hp, 4);
      }
    }
    for (const [uid, v] of this.mobViews) {
      if (!seen.has(uid)) {
        this.destroyMobView(v);
        this.mobViews.delete(uid);
      }
    }
  }

  private renderDrops(t: number): void {
    const seen = new Set<number>();
    for (const d of this.world.drops) {
      seen.add(d.uid);
      let img = this.dropViews.get(d.uid);
      if (!img) {
        img = this.add.image(d.x, d.y, d.mesos ? 'meso' : `item_${d.itemId}`).setOrigin(0.5, 1).setDepth(5);
        this.dropViews.set(d.uid, img);
      }
      const bob = d.settled ? Math.sin(t * 3 + d.uid) * 3 - 3 : 0;
      img.setPosition(d.x, d.y + bob).setAngle(d.settled ? 0 : d.age * 720);
    }
    for (const [uid, img] of this.dropViews) {
      if (!seen.has(uid)) {
        img.destroy();
        this.dropViews.delete(uid);
      }
    }
  }

  private renderProjectiles(): void {
    const seen = new Set<number>();
    for (const p of this.world.projectiles) {
      seen.add(p.uid);
      let img = this.projectileViews.get(p.uid);
      if (!img) {
        img = this.add.image(p.x, p.y, 'item_snail_shell').setDepth(8).setScale(0.7);
        this.projectileViews.set(p.uid, img);
      }
      img.setPosition(p.x, p.y).setAngle(p.travelled * 3 * p.dir);
    }
    for (const [uid, img] of this.projectileViews) {
      if (!seen.has(uid)) {
        img.destroy();
        this.projectileViews.delete(uid);
      }
    }
  }

  // ---------------------------------------------------------------- effects

  private damageNumber(e: Extract<WorldEvent, { type: 'damage' }>): void {
    const toPlayer = e.target === 'player';
    const text = this.add
      .text(e.x, e.y - 6, e.amount === null ? 'MISS' : String(e.amount), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: e.amount === null ? '18px' : '24px',
        color: toPlayer ? '#d070ff' : '#ffb21e',
        stroke: toPlayer ? '#3a0a5a' : '#6a2a00',
        strokeThickness: 5,
      })
      .setOrigin(0.5, 1)
      .setDepth(9);
    this.tweens.add({ targets: text, y: e.y - 50, alpha: 0, duration: 1000, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
  }

  private levelUpEffect(): void {
    const b = this.world.pr.body;
    const text = this.add
      .text(b.x, b.y - PLAYER_HEIGHT - 10, 'LEVEL UP!', {
        fontFamily: 'Arial Black, sans-serif', fontSize: '30px', color: '#ffe66a', stroke: '#a05a00', strokeThickness: 6,
      })
      .setOrigin(0.5, 1)
      .setDepth(9);
    this.tweens.add({ targets: text, y: text.y - 60, alpha: 0, duration: 2200, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const star = this.add.star(b.x, b.y - 30, 5, 4, 9, 0xffe066).setDepth(9);
      this.tweens.add({
        targets: star, x: b.x + Math.cos(angle) * 70, y: b.y - 30 + Math.sin(angle) * 70, alpha: 0, angle: 180,
        duration: 1000, ease: 'Cubic.easeOut', onComplete: () => star.destroy(),
      });
    }
  }
}
