/** The game shows a fixed number of world pixels vertically; width follows the screen's shape. */
export const DESKTOP_VIEW_HEIGHT = 600;
/** Phones are short in landscape, so they show less world height and everything is drawn larger. */
export const TOUCH_VIEW_HEIGHT = 440;
export const MIN_ASPECT = 4 / 3;
export const MAX_ASPECT = 2.4;

export interface ViewSize {
  width: number;
  height: number;
}

/** Logical game size for a screen, keeping between 4:3 and 2.4:1. */
export function viewSize(screenWidth: number, screenHeight: number, touch: boolean): ViewSize {
  const height = touch ? TOUCH_VIEW_HEIGHT : DESKTOP_VIEW_HEIGHT;
  const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, screenWidth / Math.max(1, screenHeight)));
  return { width: Math.round(height * aspect), height };
}
