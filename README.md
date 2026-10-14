# Maple Island

A single-player, MapleStory-inspired 2D platformer that runs in the browser. This is the MVP: a beginner on a small slice of Maple Island.

All art is drawn in code at runtime; no Nexon assets are used.

## Play

```sh
pnpm install
pnpm dev        # http://localhost:5199
```

| Action | Key |
|---|---|
| Move / climb ropes and ladders | Arrows |
| Enter portal / talk to NPC | ↑ (or click the NPC) |
| Jump / drop through a platform | Space / ↓ + Space |
| Attack | C |
| Pick up | Z |
| Three Snails / Recovery / Nimble Feet | A / D / F |
| Red / Blue Potion | 1 / 2 |
| Items / Stats / Skills / Equipment / Quests | I / S / K / E / Q |
| Close windows / menu | Esc |

Progress autosaves to localStorage on level-up, on map change and every 30 seconds.

## Content

- **Maps:** Mushroom Town, Snail Hunting Ground I & II, Amherst Outskirts.
- **Monsters:** Snail, Blue Snail, Spore, Red Snail, Orange Mushroom.
- **NPCs:** Mai and Yoona (quests), Rain (shop), Shanks (sail to Victoria Island at Lv10 to finish the MVP).

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Type-check and production build |
| `pnpm typecheck` | TypeScript only |
| `pnpm test` | Vitest unit tests (game logic) |
| `pnpm test:e2e` | Playwright browser smoke tests (starts the dev server) |

## Layout

```
src/data     static definitions: items, monsters, maps, skills, quests
src/logic    pure, unit-tested game rules; World runs the simulation at a fixed 60 Hz
src/art      procedural Canvas 2D sprites (swap these to re-skin the game)
src/game     Phaser scene that renders the World, plus keyboard input
src/ui       DOM overlay: HUD, windows, dialogs, shop
src/debug    dev-only `window.__maple` hook used by Playwright (excluded from production builds)
tests        Vitest unit tests
e2e          Playwright tests
```
