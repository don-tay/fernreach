import type { Action, Input } from '../logic/world';

/** Classic MapleStory-style default key bindings (fixed for the MVP). */
export const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Space: 'jump',
  KeyC: 'attack',
  KeyZ: 'pickup',
  KeyA: 'three_snails',
  KeyD: 'recovery',
  KeyF: 'nimble_feet',
  Digit1: 'red_potion',
  Digit2: 'blue_potion',
};

/** Keys that toggle UI windows rather than drive the character. */
export const UI_KEYS = ['KeyI', 'KeyS', 'KeyK', 'KeyE', 'KeyQ', 'Escape'] as const;
export type UiKey = (typeof UI_KEYS)[number];

export class Keyboard {
  readonly held = new Set<Action>();
  private pressed = new Set<Action>();
  onUiKey: (key: UiKey) => void = () => {};

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const action = KEYMAP[e.code];
      if (action) {
        e.preventDefault();
        if (!this.held.has(action)) this.pressed.add(action);
        this.held.add(action);
      } else if ((UI_KEYS as readonly string[]).includes(e.code) && !e.repeat) {
        e.preventDefault();
        this.onUiKey(e.code as UiKey);
      }
    });
    target.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (action) this.held.delete(action);
    });
    target.addEventListener('blur', () => this.held.clear());
  }

  /** Returns current input and clears the newly-pressed set. */
  consume(): Input {
    const pressed = this.pressed;
    this.pressed = new Set();
    return { held: this.held, pressed };
  }

  /** Puts unconsumed presses back (when a frame ran no simulation steps). */
  restore(input: Input): void {
    for (const a of input.pressed) this.pressed.add(a);
  }
}
