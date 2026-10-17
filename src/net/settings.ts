import type { Storage } from '../logic/save';

export const SETTINGS_KEY = 'fernreach-net-settings-v1';
export const CHANNELS = [1, 2, 3] as const;

/** Per-browser network preferences, kept apart from the character save. */
export interface NetSettings {
  online: boolean;
  channel: number;
  privateCode: string | null;
}

const DEFAULTS: NetSettings = { online: true, channel: 1, privateCode: null };

export function loadSettings(storage: Storage): NetSettings {
  try {
    const raw = JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}');
    return {
      online: typeof raw.online === 'boolean' ? raw.online : DEFAULTS.online,
      channel: CHANNELS.includes(raw.channel) ? raw.channel : DEFAULTS.channel,
      privateCode: typeof raw.privateCode === 'string' && raw.privateCode ? raw.privateCode : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(storage: Storage, s: NetSettings): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
