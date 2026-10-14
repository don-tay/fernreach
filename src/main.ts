import * as Phaser from 'phaser';
import './style.css';
import { Keyboard } from './game/input';
import { VIEW_H, VIEW_W, WorldScene } from './game/WorldScene';
import { createPlayer } from './logic/player';
import { createRng } from './logic/rng';
import { clearSave, load, save } from './logic/save';
import { World } from './logic/world';
import { UI } from './ui/ui';

const AUTOSAVE_MS = 30_000;
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? Date.now()) || 1;

function showTitle(): void {
  const existing = load(localStorage);
  const title = document.getElementById('title')!;
  title.innerHTML = `
    <div class="title-card">
      <div class="logo">Maple<span>Island</span></div>
      <p class="tagline">A MapleStory-inspired adventure</p>
      ${existing ? `<button class="primary" data-action="continue" data-testid="continue">Continue — ${existing.name} (Lv${existing.level})</button>` : ''}
      <div class="new-game">
        <input id="name" maxlength="12" placeholder="Character name" value="${existing ? '' : 'Mapler'}" autocomplete="off">
        <button class="${existing ? '' : 'primary'}" data-action="new" data-testid="new-game">New Game</button>
      </div>
      ${existing ? '<p class="warn">Starting a new game erases your current character.</p>' : ''}
      <p class="hint">Arrows move · Space jump · C attack · Z pick up · ↑ portals &amp; NPCs</p>
    </div>`;
  title.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'continue' && existing) start(existing);
    if (action === 'new') {
      const name = (document.getElementById('name') as HTMLInputElement).value.trim() || 'Mapler';
      clearSave(localStorage);
      start(createPlayer(name));
    }
  });
}

function start(player: ReturnType<typeof createPlayer>): void {
  document.getElementById('title')!.remove();
  const world = new World(player, createRng(seed));
  const doSave = () => save(localStorage, world.player);
  doSave();

  const keyboard = new Keyboard(window);
  const uiRoot = document.getElementById('ui')!;
  const ui = new UI(uiRoot, world, {
    onSave: doSave,
    onNewGame: () => {
      clearSave(localStorage);
      location.reload();
    },
  });
  keyboard.onUiKey = (k) => ui.onKey(k);

  world.on((e) => {
    if (e.type === 'levelUp' || e.type === 'mapChanged' || e.type === 'ending') doSave();
  });
  setInterval(doSave, AUTOSAVE_MS);
  window.addEventListener('beforeunload', doSave);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#8fd3ff',
    pixelArt: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new WorldScene(world, keyboard)],
    audio: { noAudio: true },
  });

  // Keep the DOM overlay exactly on top of the scaled canvas.
  let lastFit = '';
  const fitUi = () => {
    const rect = game.canvas?.getBoundingClientRect();
    if (rect?.width) {
      const fit = `translate(${rect.left}px, ${rect.top}px) scale(${rect.width / VIEW_W})`;
      if (fit !== lastFit) uiRoot.style.transform = lastFit = fit;
    }
    requestAnimationFrame(fitUi);
  };
  fitUi();

  if (import.meta.env.DEV) {
    import('./debug/testHook').then((m) => m.installTestHook(world, doSave));
  }
}

showTitle();
