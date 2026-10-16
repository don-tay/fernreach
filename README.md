# Fernreach

A cozy side-scrolling adventure that runs in the browser, in the spirit of classic 2D MMORPGs. This is the MVP: a novice exploring a small corner of Fernreach.

All names, numbers and art are original; the art is drawn in code at runtime.

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
| Shell Toss / Second Wind / Quickstep | A / D / F |
| Berry / Dew Tonic | 1 / 2 |
| Items / Stats / Skills / Equipment / Quests | I / S / K / E / Q |
| Chat (players on your map) | Enter |
| Players in your channel | P |
| Close windows / menu (online settings) | Esc |

Progress autosaves to localStorage on level-up, on map change and every 30 seconds.

## Multiplayer

You play online by default. You can see and chat with other players on the same map; monsters, drops and EXP stay in your own browser.

- Browsers connect directly to each other over WebRTC through [Trystero](https://github.com/dmotz/trystero). Public Nostr relays are used only to introduce players; there is no game server.
- Public channels Ch 1–3 (20 players each), or a private room code you share with friends. Change them in the menu (Esc).
- Other players in your room can see your IP address. Choose **Go offline** in the menu to play alone.
- If the connection fails you keep playing single-player, and the game retries every 30 seconds.
- `?net=local` connects tabs of the same browser instead (used by the tests); `?net=down` simulates a failed connection.

## Content

- **Maps:** Capwood (town), Shellgrass Meadow I & II, Briarwood Trail.
- **Monsters:** Shellbug, Dewshell, Puffling, Embershell, Bouncecap.
- **NPCs:** Pella and Hazel (quests), Tobin (shop), Captain Merrow (sail for the Mainland at Lv10 to finish the MVP).
- **Currency:** acorns.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Type-check and production build |
| `pnpm typecheck` | TypeScript only |
| `pnpm test` | Vitest unit tests (game logic) |
| `pnpm test:e2e` | Playwright browser smoke tests (starts the dev server) |

## Deploy

Pushing to `main` runs the tests and, if they pass, publishes the game to GitHub Pages (`.github/workflows/ci.yml`). In the repository settings, set **Pages → Source** to **GitHub Actions**. The build picks up the right base path (`/<repo>/` or a custom domain) automatically.

## Layout

```
src/data     static definitions: items, monsters, maps, skills, quests
src/logic    pure, unit-tested game rules; World runs the simulation at a fixed 60 Hz
src/art      procedural Canvas 2D sprites (swap these to re-skin the game)
src/game     Phaser scene that renders the World, plus keyboard input
src/net      multiplayer: message format, transports (Trystero, local tabs) and the session
src/ui       DOM overlay: HUD, windows, dialogs, shop, chat
src/debug    dev-only `window.__game` hook used by Playwright (excluded from production builds)
tests        Vitest unit tests
e2e          Playwright tests
```
