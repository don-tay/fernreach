import { itemIconUrl } from '../art/draw';
import type { Action } from '../logic/world';
import type { Keyboard, UiKey } from './input';

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
/** Fraction of the pad radius the finger must move before a direction counts. */
const PAD_THRESHOLD = 0.35;

interface Options {
  keyboard: Keyboard;
  /** Same entry point the keyboard uses for windows, chat and the menu. */
  onUiKey: (key: UiKey) => void;
  countItem: (itemId: string) => number;
}

const actionButton = (action: Action, label: string, cls = '') =>
  `<button class="t-btn ${cls}" data-act="${action}" data-testid="touch-${action}" aria-label="${label}">${label}</button>`;
const itemButton = (action: Action, key: string) =>
  `<button class="t-btn small item" data-act="${action}" data-testid="touch-${action}" aria-label="${key}">
    <img src="${itemIconUrl(action)}" alt=""><span class="count" data-count="${action}"></span></button>`;
const uiButton = (key: UiKey, label: string, testid: string) =>
  `<button class="t-ui" data-ui="${key}" data-testid="touch-${testid}">${label}</button>`;

/** On-screen controls for touch devices. They drive the same actions as the keyboard. */
export class TouchControls {
  constructor(private root: HTMLElement, private opts: Options) {
    root.innerHTML = `
      <div class="t-top">
        ${uiButton('KeyI', 'Item', 'item')}${uiButton('KeyE', 'Equip', 'equip')}${uiButton('KeyS', 'Stat', 'stat')}
        ${uiButton('KeyK', 'Skill', 'skill')}${uiButton('KeyQ', 'Quest', 'quest')}${uiButton('KeyP', 'Players', 'players')}
        ${uiButton('Enter', 'Chat', 'chat')}${uiButton('Escape', 'Menu', 'menu')}
        ${document.fullscreenEnabled ? '<button class="t-ui" data-fullscreen data-testid="touch-fullscreen" aria-label="Full screen">⛶</button>' : ''}
      </div>
      <div class="t-pad" data-testid="touch-pad">
        <span class="arrow up">▲</span><span class="arrow down">▼</span><span class="arrow left">◀</span><span class="arrow right">▶</span>
      </div>
      <div class="t-actions">
        <div class="t-row">${itemButton('berry_tonic', '1')}${itemButton('dew_tonic', '2')}
          ${actionButton('shell_toss', 'ST', 'small')}${actionButton('second_wind', 'SW', 'small')}${actionButton('quickstep', 'QS', 'small')}</div>
        <div class="t-row">${actionButton('pickup', 'Loot', 'mid')}${actionButton('jump', 'Jump', 'big')}${actionButton('attack', 'Attack', 'big attack')}</div>
      </div>`;
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    for (const el of root.querySelectorAll<HTMLElement>('[data-act]')) this.bindHold(el, el.dataset.act as Action);
    for (const el of root.querySelectorAll<HTMLElement>('[data-ui]')) {
      el.addEventListener('click', () => opts.onUiKey(el.dataset.ui as UiKey));
    }
    root.querySelector('[data-fullscreen]')?.addEventListener('click', () => this.toggleFullscreen());
    this.bindPad(root.querySelector<HTMLElement>('.t-pad')!);
    setInterval(() => this.updateCounts(), 250);
  }

  /** Holds an action while any finger is on the button. */
  private bindHold(el: HTMLElement, action: Action): void {
    const pointers = new Set<number>();
    const down = (e: PointerEvent) => {
      e.preventDefault();
      capture(el, e.pointerId);
      pointers.add(e.pointerId);
      el.classList.add('active');
      this.opts.keyboard.press(action);
    };
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId) || pointers.size) return;
      el.classList.remove('active');
      this.opts.keyboard.release(action);
    };
    el.addEventListener('pointerdown', down);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) el.addEventListener(type, up);
  }

  /** Direction pad: the finger's offset from the centre picks up to two directions (diagonals for drop-down). */
  private bindPad(pad: HTMLElement): void {
    let pointer: number | null = null;
    const set = (dirs: Set<string>) => {
      for (const d of DIRECTIONS) {
        if (dirs.has(d)) this.opts.keyboard.press(d);
        else this.opts.keyboard.release(d);
        pad.querySelector(`.${d}`)!.classList.toggle('active', dirs.has(d));
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const r = pad.getBoundingClientRect();
      const radius = r.width / 2;
      const dx = (e.clientX - (r.left + radius)) / radius;
      const dy = (e.clientY - (r.top + r.height / 2)) / radius;
      const dirs = new Set<string>();
      if (dx < -PAD_THRESHOLD) dirs.add('left');
      if (dx > PAD_THRESHOLD) dirs.add('right');
      if (dy < -PAD_THRESHOLD) dirs.add('up');
      if (dy > PAD_THRESHOLD) dirs.add('down');
      set(dirs);
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pointer = e.pointerId;
      capture(pad, e.pointerId);
      move(e);
    });
    pad.addEventListener('pointermove', move);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      pad.addEventListener(type, (e) => {
        if (e.pointerId !== pointer) return;
        pointer = null;
        set(new Set());
      });
    }
  }

  private updateCounts(): void {
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-count]')) {
      const n = String(this.opts.countItem(el.dataset.count!));
      if (el.textContent !== n) el.textContent = n;
    }
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) return void (await document.exitFullscreen());
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
    } catch {
      // Not supported on this browser (e.g. iPhone Safari); the game still works in the page.
    }
  }
}

function capture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Synthetic or already-released pointers can't be captured; holding still works.
  }
}
