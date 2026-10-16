import * as Phaser from 'phaser';
import type { CharFrame } from '../art/draw';
import type { Pose } from '../logic/pose';
import type { Look } from '../net/protocol';

const ATTACK_ANIM = 0.35;

export const NAME_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Verdana, sans-serif', fontSize: '11px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.55)',
  padding: { x: 4, y: 1 },
};

const BUBBLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Verdana, sans-serif', fontSize: '11px', color: '#222222', backgroundColor: '#ffffff',
  padding: { x: 6, y: 4 }, wordWrap: { width: 150 }, align: 'center',
};

export interface CharacterState {
  x: number;
  y: number;
  pose: Pose;
  facing: 1 | -1;
  look: Look;
  alpha: number;
  /** 0..1 through the current swing. */
  attackProgress: number;
  bubble: string | null;
  /** Seconds, for walk-cycle timing. */
  t: number;
}

/** Draws one character (body, weapon, hat, name tag, chat bubble). Used for the local and remote players. */
export class CharacterView {
  private body: Phaser.GameObjects.Image;
  private weapon: Phaser.GameObjects.Image;
  private hat: Phaser.GameObjects.Image;
  private tag: Phaser.GameObjects.Text;
  private bubble: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, name: string, depth: number, tagColor = '#ffffff') {
    this.body = scene.add.image(0, 0, 'player_stand').setOrigin(0.5, 1).setDepth(depth);
    this.weapon = scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 0.9).setDepth(depth + 0.01);
    this.hat = scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1).setDepth(depth + 0.02);
    this.tag = scene.add.text(0, 0, name, { ...NAME_STYLE, color: tagColor }).setOrigin(0.5, 0).setDepth(depth);
    this.bubble = scene.add.text(0, 0, '', BUBBLE_STYLE).setOrigin(0.5, 1).setDepth(9).setVisible(false);
  }

  setName(name: string): void {
    if (this.tag.text !== name) this.tag.setText(name);
  }

  update(s: CharacterState): void {
    const flip = s.facing < 0;
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    const dead = s.pose === 'dead';
    const frame: CharFrame =
      s.pose === 'walk' ? (Math.floor(s.t / 0.15) % 2 ? 'walk1' : 'walk2') : s.pose === 'dead' ? 'stand' : s.pose;

    this.body.setTexture(`player_${frame}`).setPosition(x, y).setFlipX(flip).setAlpha(s.alpha);
    this.body.setAngle(dead ? (flip ? -90 : 90) : 0);
    if (frame === 'climb') this.body.setFlipX(Math.floor(y / 10) % 2 === 1);

    this.hat.setVisible(!!s.look.hat && !dead && frame !== 'climb');
    if (s.look.hat) this.hat.setTexture(`hat_${s.look.hat}`).setPosition(x, y).setFlipX(flip).setAlpha(s.alpha);

    const showWeapon = !!s.look.weapon && frame !== 'climb' && !dead;
    this.weapon.setVisible(showWeapon);
    if (showWeapon) {
      const dir = flip ? -1 : 1;
      const attacking = s.pose === 'attack';
      const angle = attacking ? -110 + 190 * s.attackProgress : 25;
      const [hx, hy] = attacking ? [16, -22] : [9, -15];
      this.weapon.setTexture(`weapon_${s.look.weapon}`).setPosition(x + hx * dir, y + hy).setAngle(angle * dir).setFlipX(flip).setAlpha(s.alpha);
    }
    this.tag.setPosition(x, y + 3);

    this.bubble.setVisible(!!s.bubble);
    if (s.bubble) {
      if (this.bubble.text !== s.bubble) this.bubble.setText(s.bubble);
      this.bubble.setPosition(x, y - 70);
    }
  }

  destroy(): void {
    for (const o of [this.body, this.weapon, this.hat, this.tag, this.bubble]) o.destroy();
  }
}

export const swingProgress = (attackTimer: number) => 1 - attackTimer / ATTACK_ANIM;
