export interface Platform {
  x1: number;
  x2: number;
  y: number;
  /** Solid ground cannot be dropped through. */
  solid?: boolean;
}

export interface Rope {
  x: number;
  top: number;
  bottom: number;
  ladder?: boolean;
}

export interface Portal {
  id: string;
  x: number;
  y: number;
  target: string;
  targetPortal: string;
}

export interface NpcDef {
  id: string;
  name: string;
  kind: 'shop' | 'quest' | 'travel';
  x: number;
  y: number;
  hair: string;
  shirt: string;
  greeting: string;
}

export interface MobSpawn {
  mobId: string;
  x: number;
  platform: number;
}

export type Theme = 'town' | 'field' | 'forest';

export interface MapDef {
  id: string;
  name: string;
  theme: Theme;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  platforms: Platform[];
  ropes: Rope[];
  portals: Portal[];
  npcs: NpcDef[];
  mobSpawns: MobSpawn[];
}

export const GROUND_Y = 640;
export const MAP_HEIGHT = 720;
export const TOWN_MAP = 'capwood';

const ground = (width: number): Platform => ({ x1: 0, x2: width, y: GROUND_Y, solid: true });

const maps: MapDef[] = [
  {
    id: 'capwood',
    name: 'Capwood',
    theme: 'town',
    width: 1800,
    height: MAP_HEIGHT,
    spawn: { x: 120, y: GROUND_Y },
    platforms: [ground(1800), { x1: 300, x2: 520, y: 560 }, { x1: 560, x2: 760, y: 480 }, { x1: 1100, x2: 1350, y: 560 }],
    ropes: [
      { x: 420, top: 560, bottom: 620 },
      { x: 700, top: 480, bottom: 620, ladder: true },
      { x: 1220, top: 560, bottom: 620 },
    ],
    portals: [{ id: 'east', x: 1740, y: GROUND_Y, target: 'shellgrass_meadow_1', targetPortal: 'west' }],
    npcs: [
      { id: 'pella', name: 'Pella', kind: 'quest', x: 220, y: GROUND_Y, hair: '#e8a13a', shirt: '#e86a9a', greeting: 'Welcome to Capwood!' },
      { id: 'tobin', name: 'Tobin', kind: 'shop', x: 880, y: GROUND_Y, hair: '#3a3a5a', shirt: '#5aa05a', greeting: 'Tonics, weapons, armour — have a look around!' },
      { id: 'hazel', name: 'Hazel', kind: 'quest', x: 1020, y: GROUND_Y, hair: '#7a3a2a', shirt: '#7a8ae0', greeting: 'Be careful out there.' },
      { id: 'merrow', name: 'Captain Merrow', kind: 'travel', x: 1500, y: GROUND_Y, hair: '#2a2a2a', shirt: '#2a5aa0', greeting: 'Ahoy! My ship sails for the Mainland.' },
    ],
    mobSpawns: [],
  },
  {
    id: 'shellgrass_meadow_1',
    name: 'Shellgrass Meadow I',
    theme: 'field',
    width: 2000,
    height: MAP_HEIGHT,
    spawn: { x: 100, y: GROUND_Y },
    platforms: [
      ground(2000),
      { x1: 250, x2: 550, y: 560 },
      { x1: 650, x2: 900, y: 490 },
      { x1: 1000, x2: 1350, y: 560 },
      { x1: 1450, x2: 1750, y: 490 },
    ],
    ropes: [
      { x: 400, top: 560, bottom: 620 },
      { x: 780, top: 490, bottom: 620 },
      { x: 1200, top: 560, bottom: 620, ladder: true },
      { x: 1600, top: 490, bottom: 620 },
    ],
    portals: [
      { id: 'west', x: 60, y: GROUND_Y, target: 'capwood', targetPortal: 'east' },
      { id: 'east', x: 1940, y: GROUND_Y, target: 'shellgrass_meadow_2', targetPortal: 'west' },
    ],
    npcs: [],
    mobSpawns: [
      { mobId: 'shellbug', x: 250, platform: 0 },
      { mobId: 'shellbug', x: 550, platform: 0 },
      { mobId: 'shellbug', x: 850, platform: 0 },
      { mobId: 'shellbug', x: 1150, platform: 0 },
      { mobId: 'shellbug', x: 1450, platform: 0 },
      { mobId: 'shellbug', x: 1750, platform: 0 },
      { mobId: 'shellbug', x: 330, platform: 1 },
      { mobId: 'dewshell', x: 480, platform: 1 },
      { mobId: 'dewshell', x: 760, platform: 2 },
      { mobId: 'dewshell', x: 1150, platform: 3 },
      { mobId: 'shellbug', x: 1300, platform: 3 },
      { mobId: 'dewshell', x: 1550, platform: 4 },
    ],
  },
  {
    id: 'shellgrass_meadow_2',
    name: 'Shellgrass Meadow II',
    theme: 'field',
    width: 2000,
    height: MAP_HEIGHT,
    spawn: { x: 100, y: GROUND_Y },
    platforms: [
      ground(2000),
      { x1: 200, x2: 500, y: 560 },
      { x1: 550, x2: 850, y: 480 },
      { x1: 950, x2: 1250, y: 560 },
      { x1: 1300, x2: 1500, y: 480 },
      { x1: 1550, x2: 1850, y: 560 },
      { x1: 820, x2: 1050, y: 400 },
    ],
    ropes: [
      { x: 350, top: 560, bottom: 620 },
      { x: 700, top: 480, bottom: 620 },
      { x: 1100, top: 560, bottom: 620 },
      { x: 1400, top: 480, bottom: 620, ladder: true },
      { x: 1700, top: 560, bottom: 620 },
      { x: 990, top: 400, bottom: 540, ladder: true },
    ],
    portals: [
      { id: 'west', x: 60, y: GROUND_Y, target: 'shellgrass_meadow_1', targetPortal: 'east' },
      { id: 'east', x: 1940, y: GROUND_Y, target: 'briarwood_trail', targetPortal: 'west' },
    ],
    npcs: [],
    mobSpawns: [
      { mobId: 'dewshell', x: 200, platform: 0 },
      { mobId: 'dewshell', x: 600, platform: 0 },
      { mobId: 'dewshell', x: 1000, platform: 0 },
      { mobId: 'embershell', x: 1300, platform: 0 },
      { mobId: 'dewshell', x: 1600, platform: 0 },
      { mobId: 'puffling', x: 620, platform: 2 },
      { mobId: 'puffling', x: 800, platform: 2 },
      { mobId: 'puffling', x: 1420, platform: 4 },
      { mobId: 'puffling', x: 900, platform: 6 },
      { mobId: 'embershell', x: 300, platform: 1 },
      { mobId: 'embershell', x: 1050, platform: 3 },
      { mobId: 'embershell', x: 1650, platform: 5 },
    ],
  },
  {
    id: 'briarwood_trail',
    name: 'Briarwood Trail',
    theme: 'forest',
    width: 2200,
    height: MAP_HEIGHT,
    spawn: { x: 100, y: GROUND_Y },
    platforms: [
      ground(2200),
      { x1: 250, x2: 600, y: 560 },
      { x1: 700, x2: 1000, y: 480 },
      { x1: 1100, x2: 1450, y: 560 },
      { x1: 1550, x2: 1900, y: 480 },
      { x1: 850, x2: 1250, y: 400 },
    ],
    ropes: [
      { x: 450, top: 560, bottom: 620 },
      { x: 780, top: 480, bottom: 620 },
      { x: 1300, top: 560, bottom: 620, ladder: true },
      { x: 1700, top: 480, bottom: 620 },
      { x: 1180, top: 400, bottom: 540 },
    ],
    portals: [{ id: 'west', x: 60, y: GROUND_Y, target: 'shellgrass_meadow_2', targetPortal: 'east' }],
    npcs: [],
    mobSpawns: [
      { mobId: 'embershell', x: 300, platform: 0 },
      { mobId: 'bouncecap', x: 650, platform: 0 },
      { mobId: 'embershell', x: 950, platform: 0 },
      { mobId: 'bouncecap', x: 1250, platform: 0 },
      { mobId: 'bouncecap', x: 1650, platform: 0 },
      { mobId: 'bouncecap', x: 2000, platform: 0 },
      { mobId: 'bouncecap', x: 380, platform: 1 },
      { mobId: 'embershell', x: 900, platform: 2 },
      { mobId: 'bouncecap', x: 1220, platform: 3 },
      { mobId: 'bouncecap', x: 1800, platform: 4 },
      { mobId: 'bouncecap', x: 1000, platform: 5 },
    ],
  },
];

export const MAPS: Record<string, MapDef> = Object.fromEntries(maps.map((m) => [m.id, m]));

export function getMap(id: string): MapDef {
  const map = MAPS[id];
  if (!map) throw new Error(`Unknown map: ${id}`);
  return map;
}
