import * as Phaser from 'phaser';
import './style.css';
import { Keyboard } from './game/input';
import { WorldScene } from './game/WorldScene';
import { TouchControls } from './game/touch';
import { viewSize } from './game/view';
import { createPlayer } from './logic/player';
import { createRng } from './logic/rng';
import { clearSave, load, save } from './logic/save';
import type { PlayerState } from './logic/player';
import { poseOf } from './logic/pose';
import { World } from './logic/world';
import type { LocalPlayer } from './net/session';
import { NetSession } from './net/session';
import { loadSettings, saveSettings } from './net/settings';
import type { TransportFactory } from './net/transport';
import { DownTransport, LocalTransport } from './net/transport';
import { TrysteroTransport } from './net/trystero';
import { UI } from './ui/ui';

const AUTOSAVE_MS = 30_000;
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? Date.now()) || 1;
const NET_TICK_MS = 50;
/** Touch devices (phones, tablets) get on-screen controls and a closer view. `?touch=1` forces it for testing. */
const touch = matchMedia('(pointer: coarse)').matches || params.get('touch') === '1';
document.documentElement.classList.toggle('touch', touch);

/** `?net=local` connects tabs of this browser; `?net=down` simulates a failed connection. */
function transportFactory(): TransportFactory {
  const mode = params.get('net');
  if (mode === 'local') return () => new LocalTransport();
  if (mode === 'down') return () => new DownTransport();
  return () => new TrysteroTransport();
}

function showTitle(): void {
  const existing = load(localStorage);
  const title = document.getElementById('title')!;
  title.innerHTML = `
    <div class="title-card">
      <div class="logo">Fern<span>reach</span></div>
      <p class="tagline">A cozy side-scrolling adventure</p>
      ${existing ? `<button class="primary" data-action="continue" data-testid="continue">Continue — ${existing.name} (Lv${existing.level})</button>` : ''}
      <div class="new-game">
        <input id="name" maxlength="12" placeholder="Character name" value="${existing ? '' : 'Wanderer'}" autocomplete="off">
        <button class="${existing ? '' : 'primary'}" data-action="new" data-testid="new-game">New Game</button>
      </div>
      ${existing ? '<p class="warn">Starting a new game erases your current character.</p>' : ''}
      <p class="hint">Arrows move · Space jump · C attack · Z pick up · ↑ portals &amp; NPCs · Enter chat</p>
      <p class="hint">You'll play online by default: players in your channel can see your IP address. You can go offline from the menu (Esc).</p>
    </div>`;
  title.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'continue' && existing) start(existing);
    if (action === 'new') {
      const name = (document.getElementById('name') as HTMLInputElement).value.trim() || 'Wanderer';
      clearSave(localStorage);
      start(createPlayer(name));
    }
  });
}

function start(player: ReturnType<typeof createPlayer>): void {
  document.getElementById('title')!.remove();
  const world = new World(player, createRng(seed));
  /** Turned off just before replacing or erasing the save, so the page's unload save can't write the old character back. */
  let autosave = true;
  const doSave = () => autosave && save(localStorage, world.player);
  doSave();
  // Ask the browser not to clear our storage under pressure (helps on iPhones); best effort.
  void navigator.storage?.persist?.().catch(() => {});

  const keyboard = new Keyboard(window);
  const local = (): LocalPlayer => {
    const p = world.player;
    const b = world.pr.body;
    return {
      playerId: p.id, name: p.name, level: p.level, look: { weapon: p.equipment.weapon, hat: p.equipment.hat },
      map: world.map.id, x: b.x, y: b.y, facing: world.pr.facing, pose: poseOf(world.pr),
    };
  };
  const net = new NetSession(transportFactory(), loadSettings(localStorage), local, (s) => saveSettings(localStorage, s));
  net.start();
  setInterval(() => net.tick(), NET_TICK_MS);

  const uiRoot = document.getElementById('ui')!;
  const ui = new UI(uiRoot, world, {
    net,
    touch,
    onChatOpen: () => keyboard.held.clear(),
    onSave: doSave,
    onNewGame: () => {
      autosave = false;
      clearSave(localStorage);
      location.reload();
    },
    onImport: (p: PlayerState) => {
      autosave = false;
      save(localStorage, p);
      location.reload();
    },
  });
  keyboard.onUiKey = (k) => ui.onKey(k);
  if (touch) {
    new TouchControls(document.getElementById('touch')!, {
      keyboard, onUiKey: (k) => ui.onKey(k), countItem: (id) => world.countItem(id),
    });
  }

  world.on((e) => {
    if (e.type === 'levelUp' || e.type === 'mapChanged' || e.type === 'ending') doSave();
  });
  setInterval(doSave, AUTOSAVE_MS);
  // Mobile browsers rarely fire beforeunload; save whenever the page is hidden too.
  window.addEventListener('beforeunload', doSave);
  window.addEventListener('pagehide', doSave);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && doSave());

  const size = viewSize(innerWidth, innerHeight, touch);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: size.width,
    height: size.height,
    backgroundColor: '#8fd3ff',
    pixelArt: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new WorldScene(world, keyboard, net)],
    audio: { noAudio: true },
  });

  // Match the game's shape to the screen. Skip while typing, so the on-screen keyboard doesn't reshape the game.
  const resize = () => {
    const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
    const next = viewSize(innerWidth, innerHeight, touch);
    if (!typing && (next.width !== game.scale.width || next.height !== game.scale.height)) game.scale.setGameSize(next.width, next.height);
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // Keep the DOM overlay exactly on top of the scaled canvas.
  let lastFit = '';
  const fitUi = () => {
    const rect = game.canvas?.getBoundingClientRect();
    if (rect?.width) {
      const { width, height } = game.scale;
      const scale = rect.width / width;
      const fit = `${width}x${height} translate(${rect.left}px, ${rect.top}px) scale(${scale})`;
      if (fit !== lastFit) {
        lastFit = fit;
        Object.assign(uiRoot.style, { width: `${width}px`, height: `${height}px`, transform: fit.slice(fit.indexOf(' ') + 1) });
        document.documentElement.style.setProperty('--ui-scale', String(scale));
        document.documentElement.style.setProperty('--game-bottom', `${innerHeight - rect.bottom}px`);
      }
    }
    requestAnimationFrame(fitUi);
  };
  fitUi();

  if (import.meta.env.DEV) {
    import('./debug/testHook').then((m) => m.installTestHook(world, doSave, net));
  }
}

showTitle();
