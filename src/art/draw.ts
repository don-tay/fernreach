/**
 * Procedural art: every sprite is drawn with Canvas 2D at runtime, so the game ships with no external assets.
 * The same canvases feed Phaser textures and DOM icons. Swap these functions to re-skin the game.
 */
import type { EquipItem } from '../data/items';
import { getItem } from '../data/items';
import type { MapDef, Theme } from '../data/maps';

export type CharFrame = 'stand' | 'walk1' | 'walk2' | 'jump' | 'climb' | 'attack';
export const CHAR_FRAMES: CharFrame[] = ['stand', 'walk1', 'walk2', 'jump', 'climb', 'attack'];
export const CHAR_W = 48;
export const CHAR_H = 64;

const SKIN = '#ffe0c4';
const OUTLINE = '#3a2a2a';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function fillStroke(g: CanvasRenderingContext2D, fill: string, stroke = OUTLINE, width = 1.5) {
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = stroke;
  g.lineWidth = width;
  g.stroke();
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export interface CharLook {
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
}

/** Chibi character facing right, feet at the bottom centre of a 48x64 canvas. */
export function drawCharacter(look: CharLook, frame: CharFrame): HTMLCanvasElement {
  const [c, g] = canvas(CHAR_W, CHAR_H);
  const cx = 24;
  const back = frame === 'climb';
  const legs: Record<CharFrame, [number, number]> = {
    stand: [-4, 4], walk1: [-7, 6], walk2: [-2, 2], jump: [-6, 5], climb: [-4, 4], attack: [-6, 6],
  };
  const [l1, l2] = legs[frame];
  const legTop = frame === 'jump' ? 48 : 50;
  for (const dx of [l1, l2]) {
    roundRect(g, cx + dx - 3, legTop, 6, 62 - legTop, 2);
    fillStroke(g, look.pants);
    roundRect(g, cx + dx - 4, 59, 8, 5, 2);
    fillStroke(g, look.shoes);
  }
  // Body
  roundRect(g, cx - 9, 35, 18, 17, 5);
  fillStroke(g, look.shirt);
  // Arms
  const arm = (x: number, y: number, w: number, h: number) => {
    roundRect(g, x, y, w, h, 3);
    fillStroke(g, SKIN);
  };
  if (back) {
    arm(cx - 13, 26, 5, 13);
    arm(cx + 8, 24, 5, 13);
  } else if (frame === 'attack') {
    arm(cx + 4, 38, 14, 5);
    arm(cx - 12, 38, 5, 11);
  } else {
    arm(cx + 7, 38, 5, 11);
    arm(cx - 12, 38, 5, 11);
  }
  // Head
  g.beginPath();
  g.arc(cx, 21, 15, 0, Math.PI * 2);
  fillStroke(g, SKIN);
  // Hair
  g.beginPath();
  if (back) {
    g.arc(cx, 21, 15.5, 0, Math.PI * 2);
  } else {
    g.arc(cx, 19, 15.5, Math.PI * 0.95, Math.PI * 2.05);
    g.quadraticCurveTo(cx + 12, 14, cx + 2, 14);
    g.quadraticCurveTo(cx - 8, 13, cx - 15, 22);
  }
  fillStroke(g, look.hair);
  if (!back) {
    g.fillStyle = '#2a2030';
    for (const ex of [cx + 1, cx + 9]) {
      roundRect(g, ex - 1.5, 21, 3, 6, 1.5);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    g.fillRect(cx + 0.5, 22, 1, 1.5);
    g.fillRect(cx + 8.5, 22, 1, 1.5);
    g.fillStyle = 'rgba(255,120,120,0.45)';
    g.beginPath();
    g.ellipse(cx + 12, 29, 2.5, 1.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** Weapon drawn pointing up, handle at the bottom centre (use origin 0.5, 0.9). */
export function drawWeapon(itemId: string): HTMLCanvasElement {
  const [c, g] = canvas(16, 44);
  const item = getItem(itemId);
  if (itemId === 'oak_cudgel') {
    roundRect(g, 5, 6, 7, 32, 4);
    fillStroke(g, item.color);
    roundRect(g, 6, 34, 4, 10, 2);
    fillStroke(g, '#6a4520');
  } else if (itemId === 'woodcutters_hatchet') {
    roundRect(g, 7, 4, 3, 40, 1);
    fillStroke(g, '#7a5530');
    g.beginPath();
    g.moveTo(9, 6);
    g.quadraticCurveTo(18, 4, 15, 18);
    g.lineTo(9, 16);
    g.closePath();
    fillStroke(g, item.color);
  } else {
    g.beginPath();
    g.moveTo(8, 1);
    g.lineTo(11, 6);
    g.lineTo(11, 32);
    g.lineTo(5, 32);
    g.lineTo(5, 6);
    g.closePath();
    fillStroke(g, item.color);
    roundRect(g, 1, 31, 14, 3, 1);
    fillStroke(g, '#c9a43a');
    roundRect(g, 6, 34, 4, 9, 1);
    fillStroke(g, '#6a4520');
  }
  return c;
}

/** Hat overlay matching the character head (centre x 24, head top ~y 6). */
export function drawHatOverlay(itemId: string): HTMLCanvasElement {
  const [c, g] = canvas(CHAR_W, CHAR_H);
  const color = getItem(itemId).color;
  g.beginPath();
  g.arc(24, 18, 16, Math.PI, Math.PI * 2);
  g.lineTo(40, 18);
  g.lineTo(8, 18);
  fillStroke(g, color);
  if (itemId === 'ranger_cap') {
    roundRect(g, 24, 15, 20, 4, 2);
    fillStroke(g, shade(color, -0.1));
  } else {
    g.beginPath();
    g.moveTo(8, 16);
    g.lineTo(2, 22);
    g.lineTo(9, 20);
    fillStroke(g, color);
  }
  return c;
}

// ---------------------------------------------------------------- monsters

export function drawMob(mobId: string, frame: 0 | 1): HTMLCanvasElement {
  if (mobId === 'puffling') return drawCapCritter(36, 36, '#a07ad0', false, frame);
  if (mobId === 'bouncecap') return drawCapCritter(56, 56, '#2fb5a8', true, frame);
  const shell = { shellbug: '#6aa84f', dewshell: '#4a8ad8', embershell: '#d8443a' }[mobId] ?? '#6aa84f';
  return drawShellCritter(shell, frame);
}

/** Shelled critter facing left; feet at the bottom centre. */
function drawShellCritter(shell: string, frame: 0 | 1): HTMLCanvasElement {
  const [c, g] = canvas(44, 34);
  const stretch = frame === 1 ? 2 : 0;
  // Body
  g.beginPath();
  g.moveTo(4 - stretch, 33);
  g.quadraticCurveTo(2 - stretch, 22, 10 - stretch, 20);
  g.lineTo(38, 26);
  g.quadraticCurveTo(42, 33, 36, 33);
  g.closePath();
  fillStroke(g, '#f0dca8');
  // Eye stalks
  g.strokeStyle = OUTLINE;
  g.lineWidth = 1.5;
  for (const [x, y] of [[7, 8], [12, 10]] as const) {
    g.beginPath();
    g.moveTo(9 - stretch, 21);
    g.lineTo(x - stretch, y);
    g.stroke();
    g.beginPath();
    g.arc(x - stretch, y, 2.5, 0, Math.PI * 2);
    fillStroke(g, '#2a2030');
  }
  // Shell with spiral
  g.beginPath();
  g.arc(27, 17, 12, 0, Math.PI * 2);
  fillStroke(g, shell);
  g.beginPath();
  for (let t = 0; t < Math.PI * 5; t += 0.2) {
    const r = 10 - t * 0.6;
    g.lineTo(27 + Math.cos(t) * r, 17 + Math.sin(t) * r);
  }
  g.strokeStyle = shade(shell, -0.25);
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(23, 10, 4, 2.5, -0.5, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Cap-headed critter facing left; feet at the bottom centre. */
function drawCapCritter(w: number, h: number, cap: string, spots: boolean, frame: 0 | 1): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  const squash = frame === 1 ? 2 : 0;
  const cx = w / 2;
  const stemTop = h * 0.45 + squash;
  // Feet
  g.fillStyle = '#7a5a3a';
  for (const dx of [-w * 0.15, w * 0.15]) {
    g.beginPath();
    g.ellipse(cx + dx, h - 3, w * 0.1, 3, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Stem / face
  roundRect(g, cx - w * 0.25, stemTop, w * 0.5, h - stemTop - 3, w * 0.12);
  fillStroke(g, '#f6e6c4');
  g.fillStyle = '#2a2030';
  const eyeY = stemTop + (h - stemTop) * 0.35;
  for (const dx of [-w * 0.12, w * 0.02]) {
    roundRect(g, cx + dx - 1.5, eyeY, 3, w * 0.09, 1.5);
    g.fill();
  }
  g.strokeStyle = '#2a2030';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(cx - w * 0.05, eyeY + w * 0.15, w * 0.05, 0.2, Math.PI - 0.2);
  g.stroke();
  // Cap
  g.beginPath();
  g.ellipse(cx, stemTop + 2, w * 0.48, h * 0.38 - squash, 0, Math.PI, Math.PI * 2);
  g.closePath();
  fillStroke(g, cap);
  if (spots) {
    g.fillStyle = '#fff6e6';
    for (const [dx, dy, r] of [[-0.25, -0.18, 0.08], [0.05, -0.28, 0.07], [0.28, -0.12, 0.07], [-0.02, -0.08, 0.05]]) {
      g.beginPath();
      g.arc(cx + dx * w, stemTop + dy * h, r * w, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.3)';
  g.beginPath();
  g.ellipse(cx - w * 0.2, stemTop - h * 0.22, w * 0.1, h * 0.05, -0.4, 0, Math.PI * 2);
  g.fill();
  return c;
}

// ---------------------------------------------------------------- items

export function drawItemIcon(itemId: string): HTMLCanvasElement {
  const [c, g] = canvas(32, 32);
  const item = getItem(itemId);
  if (item.tab === 'use') {
    roundRect(g, 13, 4, 6, 6, 1);
    fillStroke(g, '#c8a070');
    g.beginPath();
    g.moveTo(12, 10);
    g.lineTo(20, 10);
    g.quadraticCurveTo(28, 18, 25, 26);
    g.quadraticCurveTo(16, 31, 7, 26);
    g.quadraticCurveTo(4, 18, 12, 10);
    fillStroke(g, item.color);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.ellipse(12, 18, 2, 4, 0.3, 0, Math.PI * 2);
    g.fill();
  } else if (item.tab === 'equip') {
    drawEquipIcon(g, item);
  } else if (itemId.includes('shell')) {
    g.drawImage(drawShellCritter(item.color, 0), 14, 3, 20, 20, 3, 3, 26, 26);
  } else {
    g.drawImage(drawCapCritter(36, 36, item.color, itemId === 'bouncy_cap', 0), 0, 4, 36, 18, 1, 6, 30, 15);
  }
  return c;
}

function drawEquipIcon(g: CanvasRenderingContext2D, item: EquipItem) {
  if (item.slot === 'weapon') {
    g.translate(16, 16);
    g.rotate(Math.PI / 4);
    g.drawImage(drawWeapon(item.id), -7, -19, 14, 38);
    g.setTransform(1, 0, 0, 1, 0, 0);
  } else if (item.slot === 'hat') {
    g.drawImage(drawHatOverlay(item.id), 2, 0, 44, 24, 2, 6, 28, 15);
  } else if (item.slot === 'top') {
    g.beginPath();
    g.moveTo(10, 6);
    g.lineTo(22, 6);
    g.lineTo(29, 12);
    g.lineTo(25, 16);
    g.lineTo(23, 14);
    g.lineTo(23, 27);
    g.lineTo(9, 27);
    g.lineTo(9, 14);
    g.lineTo(7, 16);
    g.lineTo(3, 12);
    g.closePath();
    fillStroke(g, item.color);
  } else {
    for (const x of [5, 17]) {
      g.beginPath();
      g.moveTo(x, 8);
      g.lineTo(x + 6, 8);
      g.lineTo(x + 6, 20);
      g.lineTo(x + 11, 22);
      g.lineTo(x + 11, 27);
      g.lineTo(x, 27);
      g.closePath();
      fillStroke(g, item.color);
    }
  }
}

export function drawAcorn(): HTMLCanvasElement {
  const [c, g] = canvas(18, 18);
  // Nut
  g.beginPath();
  g.ellipse(9, 11, 5.5, 6, 0, 0, Math.PI * 2);
  fillStroke(g, '#c8823a', '#6a3a10');
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(7, 11, 1.5, 3, 0, 0, Math.PI * 2);
  g.fill();
  // Cap and stem
  g.beginPath();
  g.ellipse(9, 6.5, 7, 3.5, 0, 0, Math.PI * 2);
  fillStroke(g, '#7a5228', '#4a2a10');
  g.fillStyle = '#4a2a10';
  g.fillRect(8.2, 1, 1.6, 3);
  return c;
}

export function drawPortal(): HTMLCanvasElement {
  const [c, g] = canvas(60, 90);
  const grad = g.createRadialGradient(30, 50, 4, 30, 50, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.4, 'rgba(120,200,255,0.8)');
  grad.addColorStop(1, 'rgba(60,120,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(30, 50, 26, 40, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(30, 50, 10 + i * 6, 18 + i * 9, 0, i, i + Math.PI * 1.3);
    g.stroke();
  }
  return c;
}

// ---------------------------------------------------------------- scenery

const SKY: Record<Theme, [string, string]> = {
  town: ['#8fd3ff', '#e8f7ff'],
  field: ['#7cc8ff', '#dff3ff'],
  forest: ['#6fb7e8', '#d6efdc'],
};

export function drawSky(theme: Theme): HTMLCanvasElement {
  const [c, g] = canvas(800, 600);
  const grad = g.createLinearGradient(0, 0, 0, 600);
  grad.addColorStop(0, SKY[theme][0]);
  grad.addColorStop(1, SKY[theme][1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 800, 600);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y, s] of [[90, 90, 1], [330, 60, 1.4], [600, 120, 1.1], [720, 50, 0.8]]) {
    for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 28], [52, 0, 20], [26, 8, 22]]) {
      g.beginPath();
      g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

/** Distant hills, tiled horizontally with parallax. */
export function drawHills(theme: Theme): HTMLCanvasElement {
  const [c, g] = canvas(800, 600);
  const colors = theme === 'forest' ? ['#7fbf8a', '#5fa56e'] : ['#a6dc8c', '#86c870'];
  colors.forEach((color, layer) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, 600);
    for (let x = 0; x <= 800; x += 10) {
      g.lineTo(x, 380 + layer * 60 + Math.sin((x / 800) * Math.PI * (4 + layer * 2)) * (40 - layer * 10));
    }
    g.lineTo(800, 600);
    g.fill();
  });
  return c;
}

/** The whole foreground of a map: decor, platforms, ropes and ladders. */
export function drawMapLayer(map: MapDef): HTMLCanvasElement {
  const [c, g] = canvas(map.width, map.height);
  const [ground, ...floating] = map.platforms;
  if (map.theme === 'town') {
    for (const x of [140, 600, 1260, 1620]) drawCapHouse(g, x, ground.y);
  } else {
    for (let x = 160; x < map.width; x += 330) drawTree(g, x + ((x * 7) % 90), ground.y, map.theme === 'forest');
  }
  for (const p of floating) drawFloatingPlatform(g, p.x1, p.x2, p.y);
  for (const r of map.ropes) drawRope(g, r.x, r.top, r.bottom, !!r.ladder);
  // Ground
  const grass = map.theme === 'forest' ? '#5aa04a' : '#6cc04a';
  g.fillStyle = '#b07a48';
  g.fillRect(0, ground.y, map.width, map.height - ground.y);
  g.fillStyle = '#9a6a3c';
  for (let x = 0; x < map.width; x += 46) g.fillRect(x + ((x * 13) % 20), ground.y + 26 + ((x * 7) % 30), 14, 6);
  g.fillStyle = grass;
  g.fillRect(0, ground.y - 2, map.width, 12);
  g.fillStyle = shade(grass, -0.12);
  for (let x = 0; x < map.width; x += 16) {
    g.beginPath();
    g.arc(x + 8, ground.y + 10, 8, 0, Math.PI);
    g.fill();
  }
  return c;
}

function drawFloatingPlatform(g: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  roundRect(g, x1, y, x2 - x1, 18, 6);
  fillStroke(g, '#b98352', '#6a4528', 2);
  roundRect(g, x1 - 2, y - 3, x2 - x1 + 4, 9, 4);
  fillStroke(g, '#78c850', '#3f7a2a', 1.5);
}

function drawRope(g: CanvasRenderingContext2D, x: number, top: number, bottom: number, ladder: boolean) {
  if (ladder) {
    g.fillStyle = '#8a5a30';
    g.fillRect(x - 11, top, 4, bottom - top);
    g.fillRect(x + 7, top, 4, bottom - top);
    for (let y = top + 8; y < bottom; y += 12) g.fillRect(x - 9, y, 18, 3);
    return;
  }
  g.strokeStyle = '#b58a50';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(x, top);
  g.lineTo(x, bottom);
  g.stroke();
  g.fillStyle = '#8a6030';
  for (let y = top + 10; y < bottom; y += 14) g.fillRect(x - 3, y, 6, 3);
}

function drawCapHouse(g: CanvasRenderingContext2D, x: number, groundY: number) {
  roundRect(g, x - 40, groundY - 80, 80, 80, 10);
  fillStroke(g, '#f6e8c8', '#7a5a3a', 2);
  roundRect(g, x - 12, groundY - 42, 24, 42, 10);
  fillStroke(g, '#9a6a3a', '#5a3a1a', 2);
  g.beginPath();
  g.arc(x + 24, groundY - 52, 8, 0, Math.PI * 2);
  fillStroke(g, '#bfe6ff', '#7a5a3a', 2);
  g.beginPath();
  g.ellipse(x, groundY - 80, 70, 56, 0, Math.PI, Math.PI * 2);
  g.closePath();
  fillStroke(g, '#e8503a', '#8a2a1a', 2);
  g.fillStyle = '#fff6e6';
  for (const [dx, dy, r] of [[-38, -96, 10], [0, -122, 12], [36, -98, 9], [-12, -96, 6]]) {
    g.beginPath();
    g.arc(x + dx, groundY + dy, r, 0, Math.PI * 2);
    g.fill();
  }
}

function drawTree(g: CanvasRenderingContext2D, x: number, groundY: number, dark: boolean) {
  roundRect(g, x - 9, groundY - 90, 18, 90, 4);
  fillStroke(g, '#8a5a30', '#5a3a1a', 2);
  const leaf = dark ? '#3f8a4a' : '#58b85a';
  for (const [dx, dy, r] of [[-26, -100, 30], [24, -104, 32], [0, -132, 36]]) {
    g.beginPath();
    g.arc(x + dx, groundY + dy, r, 0, Math.PI * 2);
    fillStroke(g, leaf, shade(leaf, -0.25), 2);
  }
}

// ---------------------------------------------------------------- DOM helpers

const iconCache = new Map<string, string>();

/** Data URL of an item icon, cached for the UI. */
export function itemIconUrl(itemId: string): string {
  let url = iconCache.get(itemId);
  if (!url) {
    url = drawItemIcon(itemId).toDataURL();
    iconCache.set(itemId, url);
  }
  return url;
}
