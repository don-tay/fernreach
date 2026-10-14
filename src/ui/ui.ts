import { drawCharacter, itemIconUrl } from '../art/draw';
import type { EquipItem, EquipSlot, InvTab, Item } from '../data/items';
import { getItem, SHOP } from '../data/items';
import type { NpcDef } from '../data/maps';
import { QUESTS, QUEST_IDS } from '../data/quests';
import type { QuestId } from '../data/quests';
import { SKILLS, SKILL_IDS } from '../data/skills';
import type { SkillId } from '../data/skills';
import { expToNext, MAX_LEVEL } from '../logic/player';
import type { StatName } from '../logic/player';
import { questProgress, questStatus } from '../logic/quests';
import { TAB_CAPACITY } from '../logic/inventory';
import type { World, WorldEvent } from '../logic/world';
import type { UiKey } from '../game/input';

type WindowId = 'stats' | 'equip' | 'inventory' | 'skills' | 'quests';
type Modal =
  | { type: 'npc'; npc: NpcDef; text?: string }
  | { type: 'shop'; npc: NpcDef }
  | { type: 'death' }
  | { type: 'ending' }
  | { type: 'menu'; confirmNew?: boolean };

interface Message {
  text: string;
  kind: string;
  at: number;
}

const WINDOW_KEYS: Partial<Record<UiKey, WindowId>> = {
  KeyS: 'stats', KeyE: 'equip', KeyI: 'inventory', KeyK: 'skills', KeyQ: 'quests',
};
const WINDOW_TITLES: Record<WindowId, string> = {
  stats: 'Character Stats', equip: 'Equipment', inventory: 'Item Inventory', skills: 'Skills', quests: 'Quest Log',
};
const EQUIP_LABELS: Record<EquipSlot, string> = { hat: 'Hat', top: 'Top', shoes: 'Shoes', weapon: 'Weapon' };
const STATS: StatName[] = ['str', 'dex', 'int', 'luk'];
const TABS: InvTab[] = ['equip', 'use', 'etc'];
const MESSAGE_TTL = 8000;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const icon = (itemId: string) => `<img class="icon" src="${itemIconUrl(itemId)}" alt="" draggable="false">`;

const portraitCache = new Map<string, string>();
function portrait(npc: NpcDef): string {
  let url = portraitCache.get(npc.id);
  if (!url) {
    url = drawCharacter({ hair: npc.hair, shirt: npc.shirt, pants: '#5a4a3a', shoes: '#4a3a2a' }, 'stand').toDataURL();
    portraitCache.set(npc.id, url);
  }
  return url;
}

function describe(item: Item): string {
  const lines = [item.name];
  if (item.tab === 'use') {
    if (item.hp) lines.push(`Recovers ${item.hp} HP`);
    if (item.mp) lines.push(`Recovers ${item.mp} MP`);
  } else if (item.tab === 'equip') {
    lines.push(`Req. level ${item.reqLevel}`);
    if (item.watk) lines.push(`Weapon attack +${item.watk}`);
    if (item.wdef) lines.push(`Weapon defence +${item.wdef}`);
  }
  return esc(lines.join('\n'));
}

export interface UiOptions {
  onSave: () => void;
  onNewGame: () => void;
}

/** DOM overlay for the HUD, windows and dialogs. Re-renders when World.version changes. */
export class UI {
  private open = new Set<WindowId>();
  private invTab: InvTab = 'equip';
  private shopTab: InvTab = 'etc';
  private modal: Modal | null = null;
  private note = '';
  private messages: Message[] = [];
  private renderedVersion = -1;
  private dirty = true;
  private hud: HTMLElement;
  private windows: HTMLElement;
  private modalEl: HTMLElement;
  private log: HTMLElement;
  private buffs: HTMLElement;
  private mapName: HTMLElement;
  private hudCache = new Map<string, string>();

  constructor(private root: HTMLElement, private world: World, private opts: UiOptions) {
    root.innerHTML = `
      <div class="map-name"></div>
      <div class="buffs"></div>
      <div class="windows"></div>
      <div class="log"></div>
      <div class="hud"></div>
      <div class="modal-layer"></div>`;
    this.mapName = root.querySelector('.map-name')!;
    this.buffs = root.querySelector('.buffs')!;
    this.windows = root.querySelector('.windows')!;
    this.log = root.querySelector('.log')!;
    this.hud = root.querySelector('.hud')!;
    this.modalEl = root.querySelector('.modal-layer')!;
    this.hud.innerHTML = this.hudTemplate();
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    world.on((e) => this.onWorldEvent(e));
    if (world.player.finished) this.setModal({ type: 'ending' });
    const tick = () => {
      this.frame();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  onKey(key: UiKey): void {
    if (key === 'Escape') {
      if (this.modal && this.modal.type !== 'death' && this.modal.type !== 'ending') this.setModal(null);
      else if (!this.modal && this.open.size) this.open.clear();
      else if (!this.modal) this.setModal({ type: 'menu' });
      this.dirty = true;
      return;
    }
    if (this.modal) return;
    const win = WINDOW_KEYS[key];
    if (win) this.toggle(win);
  }

  private toggle(win: WindowId): void {
    if (this.open.has(win)) this.open.delete(win);
    else this.open.add(win);
    this.dirty = true;
  }

  private setModal(modal: Modal | null): void {
    this.modal = modal;
    this.note = '';
    this.world.blocked = modal !== null && modal.type !== 'death';
    this.dirty = true;
  }

  private onWorldEvent(e: WorldEvent): void {
    if (e.type === 'message') this.pushMessage(e.text, e.kind);
    else if (e.type === 'npc') this.setModal({ type: 'npc', npc: e.npc });
    else if (e.type === 'death') this.setModal({ type: 'death' });
    else if (e.type === 'ending') this.setModal({ type: 'ending' });
    else if (e.type === 'mapChanged') this.pushMessage(`Entered ${this.world.map.name}`, 'info');
  }

  private pushMessage(text: string, kind: string): void {
    this.messages.push({ text, kind, at: performance.now() });
    if (this.messages.length > 8) this.messages.shift();
    this.renderLog();
  }

  // ---------------------------------------------------------------- frame

  private frame(): void {
    this.updateHud();
    const now = performance.now();
    if (this.messages.length && now - this.messages[0].at > MESSAGE_TTL) {
      this.messages = this.messages.filter((m) => now - m.at <= MESSAGE_TTL);
      this.renderLog();
    }
    if (this.dirty || this.renderedVersion !== this.world.version) {
      this.dirty = false;
      this.renderedVersion = this.world.version;
      this.windows.innerHTML = [...this.open].map((id) => this.windowTemplate(id)).join('');
      this.modalEl.innerHTML = this.modal ? this.modalTemplate(this.modal) : '';
      this.mapName.textContent = this.world.map.name;
    }
  }

  private renderLog(): void {
    this.log.innerHTML = this.messages.map((m) => `<div class="msg ${m.kind}">${esc(m.text)}</div>`).join('');
  }

  private set(selector: string, value: string, prop: 'text' | 'width' = 'text'): void {
    const key = selector + prop;
    if (this.hudCache.get(key) === value) return;
    this.hudCache.set(key, value);
    const el = this.root.querySelector<HTMLElement>(selector);
    if (!el) return;
    if (prop === 'text') el.textContent = value;
    else el.style.width = value;
  }

  private updateHud(): void {
    const p = this.world.player;
    const need = expToNext(p.level);
    const expPct = p.level >= MAX_LEVEL ? 100 : (p.exp / need) * 100;
    this.set('.hud .lv b', String(p.level));
    this.set('.bar.hp .fill', `${(p.hp / p.maxHp) * 100}%`, 'width');
    this.set('.bar.hp .val', `${p.hp} / ${p.maxHp}`);
    this.set('.bar.mp .fill', `${(p.mp / p.maxMp) * 100}%`, 'width');
    this.set('.bar.mp .val', `${p.mp} / ${p.maxMp}`);
    this.set('.bar.exp .fill', `${expPct}%`, 'width');
    this.set('.bar.exp .val', p.level >= MAX_LEVEL ? 'MAX' : `${p.exp} / ${need} [${expPct.toFixed(2)}%]`);
    this.set('.slot-red .qty', String(this.world.countItem('red_potion')));
    this.set('.slot-blue .qty', String(this.world.countItem('blue_potion')));
    for (const id of SKILL_IDS) this.set(`.slot-${id} .qty`, `Lv${p.skills[id]}`);

    const pr = this.world.pr;
    const buffs = [
      pr.recovery && `Recovery ${Math.ceil(pr.recovery.remaining)}s`,
      pr.nimble && `Nimble Feet ${Math.ceil(pr.nimble.remaining)}s`,
    ].filter(Boolean) as string[];
    const html = buffs.map((b) => `<div class="buff">${b}</div>`).join('');
    if (this.hudCache.get('buffs') !== html) {
      this.hudCache.set('buffs', html);
      this.buffs.innerHTML = html;
    }
  }

  private hudTemplate(): string {
    const p = this.world.player;
    const bar = (cls: string, label: string) =>
      `<div class="bar ${cls}"><div class="fill"></div><span class="label">${label}</span><span class="val"></span></div>`;
    const slot = (cls: string, key: string, content: string) =>
      `<div class="qslot ${cls}"><span class="key">${key}</span>${content}<span class="qty"></span></div>`;
    const btn = (win: WindowId, label: string, key: string) =>
      `<button data-action="toggle" data-win="${win}" title="${WINDOW_TITLES[win]} (${key})">${label}</button>`;
    return `
      <div class="hud-id"><span class="lv">Lv.<b></b></span><span class="job">Beginner</span><span class="pname">${esc(p.name)}</span></div>
      <div class="bars">${bar('hp', 'HP')}${bar('mp', 'MP')}${bar('exp', 'EXP')}</div>
      <div class="quickslots">
        ${slot('slot-red', '1', icon('red_potion'))}
        ${slot('slot-blue', '2', icon('blue_potion'))}
        ${slot('slot-three_snails', 'A', `<span class="skill-badge">3S</span>`)}
        ${slot('slot-recovery', 'D', `<span class="skill-badge">Rc</span>`)}
        ${slot('slot-nimble_feet', 'F', `<span class="skill-badge">NF</span>`)}
      </div>
      <div class="hud-buttons">
        ${btn('stats', 'Stat', 'S')}${btn('equip', 'Equip', 'E')}${btn('inventory', 'Item', 'I')}
        ${btn('skills', 'Skill', 'K')}${btn('quests', 'Quest', 'Q')}
        <button data-action="menu" title="Menu (Esc)">Menu</button>
      </div>`;
  }

  // ---------------------------------------------------------------- windows

  private windowTemplate(id: WindowId): string {
    const body = {
      stats: () => this.statsBody(),
      equip: () => this.equipBody(),
      inventory: () => this.inventoryBody(),
      skills: () => this.skillsBody(),
      quests: () => this.questsBody(),
    }[id]();
    return `
      <div class="win win-${id}" data-testid="win-${id}">
        <div class="win-title">${WINDOW_TITLES[id]}<button class="x" data-action="close" data-win="${id}">×</button></div>
        <div class="win-body">${body}</div>
      </div>`;
  }

  private statsBody(): string {
    const p = this.world.player;
    const d = this.world.derived;
    const row = (label: string, value: string | number) => `<div class="row"><span>${label}</span><b>${value}</b></div>`;
    const statRow = (s: StatName) =>
      `<div class="row"><span>${s.toUpperCase()}</span><b data-testid="stat-${s}">${p[s]}</b>
        <button class="plus" data-action="ap" data-stat="${s}" ${p.ap ? '' : 'disabled'} data-testid="ap-${s}">+</button></div>`;
    return `
      ${row('Name', esc(p.name))}${row('Job', 'Beginner')}${row('Level', p.level)}
      ${row('HP', `${p.hp} / ${p.maxHp}`)}${row('MP', `${p.mp} / ${p.maxMp}`)}
      <div class="sep"></div>
      <div class="row ap"><span>Ability Points</span><b data-testid="ap">${p.ap}</b></div>
      ${STATS.map(statRow).join('')}
      <div class="sep"></div>
      ${row('Attack', `${d.minDamage} ~ ${d.maxDamage}`)}${row('W. Def', d.wdef)}
      ${row('Accuracy', Math.floor(d.acc))}${row('Avoid', Math.floor(d.avoid))}${row('Speed', `${Math.round((this.world.speed / 125) * 100)}%`)}`;
  }

  private equipBody(): string {
    const eq = this.world.player.equipment;
    return (Object.keys(EQUIP_LABELS) as EquipSlot[])
      .map((slot) => {
        const id = eq[slot];
        const content = id
          ? `${icon(id)}<span class="name" title="${describe(getItem(id))}">${getItem(id).name}</span>
             <button data-action="unequip" data-slot="${slot}">Unequip</button>`
          : `<span class="empty">—</span>`;
        return `<div class="eq-row"><span class="eq-label">${EQUIP_LABELS[slot]}</span>${content}</div>`;
      })
      .join('');
  }

  private inventoryBody(): string {
    const inv = this.world.player.inventory;
    const tabs = TABS.map(
      (t) => `<button class="tab ${t === this.invTab ? 'active' : ''}" data-action="inv-tab" data-tab="${t}">${t.toUpperCase()}</button>`,
    ).join('');
    const slots = Array.from({ length: TAB_CAPACITY }, (_, i) => {
      const s = inv[this.invTab][i];
      if (!s) return `<div class="slot"></div>`;
      const item = getItem(s.itemId);
      const hint = item.tab === 'equip' ? '\n(double-click to equip)' : item.tab === 'use' ? '\n(double-click to use)' : '';
      return `<div class="slot filled" data-action="inv-slot" data-index="${i}" data-item="${s.itemId}" title="${describe(item)}${hint}">
        ${icon(s.itemId)}${item.tab === 'equip' ? '' : `<span class="qty">${s.qty}</span>`}</div>`;
    }).join('');
    return `<div class="tabs">${tabs}</div><div class="grid">${slots}</div>
      <div class="mesos"><span class="meso-icon"></span><b data-testid="mesos">${this.world.player.mesos.toLocaleString()}</b> mesos</div>`;
  }

  private skillsBody(): string {
    const p = this.world.player;
    return `<div class="row ap"><span>Skill Points</span><b data-testid="sp">${p.sp}</b></div>` + SKILL_IDS.map((id) => {
      const s = SKILLS[id];
      const lv = p.skills[id];
      const cost = s.mpCost[Math.max(0, lv - 1)];
      return `<div class="skill">
        <div class="skill-head"><b>${s.name}</b> <span class="key">[${s.key}]</span>
          <span class="lvl">Lv ${lv}/${s.maxLevel}</span>
          <button class="plus" data-action="sp" data-skill="${id}" ${p.sp && lv < s.maxLevel ? '' : 'disabled'}>+</button></div>
        <div class="desc">${s.description} MP ${cost}.</div></div>`;
    }).join('');
  }

  private questsBody(): string {
    const p = this.world.player;
    return QUEST_IDS.map((id) => {
      const q = QUESTS[id];
      const status = questStatus(p, id);
      const label = {
        unavailable: `Requires level ${q.minLevel}`,
        available: 'Available — talk to the quest giver',
        active: `In progress (${questProgress(p, id)}/${q.goal.count})`,
        ready: `Ready to complete (${q.goal.count}/${q.goal.count})`,
        done: 'Completed',
      }[status];
      return `<div class="quest ${status}"><b>${q.name}</b><span>${label}</span></div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- modals

  private modalTemplate(m: Modal): string {
    if (m.type === 'npc') return this.npcTemplate(m.npc, m.text);
    if (m.type === 'shop') return this.shopTemplate(m.npc);
    if (m.type === 'death') {
      return this.dialog('Notice', '<p>You have died. You will return to Mushroom Town.</p>', [['OK', 'respawn']], 'death');
    }
    if (m.type === 'ending') {
      const p = this.world.player;
      return `<div class="ending" data-testid="ending">
        <h1>Bon Voyage!</h1>
        <p>${esc(p.name)} boards Shanks' ship and sets sail for Victoria Island.</p>
        <p class="big">Thanks for playing the Maple Island MVP!</p>
        <p>Level ${p.level} · ${p.mesos.toLocaleString()} mesos · ${QUEST_IDS.filter((q) => questStatus(p, q) === 'done').length}/${QUEST_IDS.length} quests</p>
        <button data-action="keep-playing">Keep playing on Maple Island</button></div>`;
    }
    if (m.confirmNew) {
      return this.dialog('New Game', '<p>Start over? Your current character will be erased.</p>', [
        ['Erase and start over', 'new-game'], ['Cancel', 'menu'],
      ], 'menu');
    }
    return this.dialog('Menu', `
      <table class="controls">
        <tr><td>Arrows</td><td>Move · climb ropes · ↑ portals/NPCs</td></tr>
        <tr><td>Space</td><td>Jump (↓ + Space to drop down)</td></tr>
        <tr><td>C</td><td>Attack</td></tr><tr><td>Z</td><td>Pick up</td></tr>
        <tr><td>A / D / F</td><td>Three Snails / Recovery / Nimble Feet</td></tr>
        <tr><td>1 / 2</td><td>Red / Blue Potion</td></tr>
        <tr><td>I S K E Q</td><td>Items · Stats · Skills · Equipment · Quests</td></tr>
      </table>`, [['Save game', 'save'], ['New game', 'confirm-new'], ['Close', 'close-modal']], 'menu');
  }

  private dialog(title: string, body: string, buttons: [string, string, string?][], testid: string, side = ''): string {
    const btns = buttons
      .map(([label, action, arg]) => `<button data-action="${action}" ${arg ? `data-arg="${arg}"` : ''}>${label}</button>`)
      .join('');
    return `<div class="dialog" data-testid="dialog-${testid}">
      <div class="win-title">${title}</div>
      <div class="dialog-body">${side}<div class="dialog-text">${body}${this.note ? `<p class="note">${esc(this.note)}</p>` : ''}</div></div>
      <div class="buttons">${btns}</div></div>`;
  }

  private npcTemplate(npc: NpcDef, override?: string): string {
    const side = `<div class="portrait"><img src="${portrait(npc)}" alt=""><span>${npc.name}</span></div>`;
    const say = (text: string, buttons: [string, string, string?][]) => this.dialog(npc.name, `<p>${text}</p>`, buttons, 'npc', side);
    if (override) return say(override, [['Close', 'close-modal']]);
    const p = this.world.player;
    if (npc.kind === 'shop') return say(npc.greeting, [['Open shop', 'open-shop'], ['Close', 'close-modal']]);
    if (npc.kind === 'travel') {
      return p.level >= MAX_LEVEL
        ? say("Ahoy, you look ready for the big world! Shall we set sail for Victoria Island?", [['Set sail!', 'travel'], ['Not yet', 'close-modal']])
        : say(`${npc.greeting} Come back when you're level ${MAX_LEVEL} and I'll take you to Victoria Island.`, [['Close', 'close-modal']]);
    }
    const id = QUEST_IDS.find((q) => QUESTS[q].npcId === npc.id)!;
    const q = QUESTS[id];
    const progress = `(${questProgress(p, id)}/${q.goal.count})`;
    switch (questStatus(p, id)) {
      case 'unavailable':
        return say(`${npc.greeting} Come back when you're level ${q.minLevel} — I may need your help.`, [['Close', 'close-modal']]);
      case 'available':
        return say(q.text.offer, [['Accept', 'quest-accept', id], ['Decline', 'close-modal']]);
      case 'active':
        return say(`${q.text.progress} ${progress}`, [['OK', 'close-modal']]);
      case 'ready':
        return say(`Did you finish? ${progress}`, [['Complete quest', 'quest-complete', id], ['Not yet', 'close-modal']]);
      default:
        return say(`${npc.greeting} Thanks again for your help!`, [['Close', 'close-modal']]);
    }
  }

  private shopTemplate(npc: NpcDef): string {
    const p = this.world.player;
    const buy = SHOP.map(({ itemId, price }) => {
      const item = getItem(itemId);
      const req = item.tab === 'equip' ? ` <small>Lv${(item as EquipItem).reqLevel}</small>` : '';
      const ten = item.tab === 'use' ? `<button data-action="buy" data-arg="${itemId}" data-qty="10">×10</button>` : '';
      return `<div class="shop-row" title="${describe(item)}">${icon(itemId)}<span class="name">${item.name}${req}</span>
        <span class="price">${price}</span><button data-action="buy" data-arg="${itemId}" data-qty="1" data-testid="buy-${itemId}">Buy</button>${ten}</div>`;
    }).join('');
    const tabs = TABS.map(
      (t) => `<button class="tab ${t === this.shopTab ? 'active' : ''}" data-action="shop-tab" data-tab="${t}">${t.toUpperCase()}</button>`,
    ).join('');
    const sell = p.inventory[this.shopTab].map((s, i) => {
      const item = getItem(s.itemId);
      return `<div class="shop-row" title="${describe(item)}">${icon(s.itemId)}<span class="name">${item.name} ×${s.qty}</span>
        <span class="price">${item.sell}</span>
        <button data-action="sell" data-index="${i}" data-qty="1" data-testid="sell-${s.itemId}">Sell</button>
        ${s.qty > 1 ? `<button data-action="sell" data-index="${i}" data-qty="${s.qty}">All</button>` : ''}</div>`;
    }).join('') || '<p class="empty">Nothing to sell.</p>';
    return `<div class="shop" data-testid="shop">
      <div class="win-title">${npc.name}'s Shop<button class="x" data-action="close-modal">×</button></div>
      <div class="shop-cols">
        <div class="col"><h3>Buy</h3><div class="list">${buy}</div></div>
        <div class="col"><h3>Sell</h3><div class="tabs">${tabs}</div><div class="list">${sell}</div></div>
      </div>
      <div class="shop-foot"><span class="meso-icon"></span><b data-testid="shop-mesos">${p.mesos.toLocaleString()}</b> mesos
        ${this.note ? `<span class="note">${esc(this.note)}</span>` : ''}
        <button data-action="close-modal">Leave</button></div></div>`;
  }

  // ---------------------------------------------------------------- input

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const { action, win, arg, stat, skill, slot, tab, index, qty } = el.dataset;
    const w = this.world;
    this.dirty = true;
    switch (action) {
      case 'toggle': return this.toggle(win as WindowId);
      case 'close': return void this.open.delete(win as WindowId);
      case 'ap': return w.addAp(stat as StatName);
      case 'sp': return w.addSp(skill as SkillId);
      case 'unequip': return w.unequip(slot as EquipSlot);
      case 'inv-tab': this.invTab = tab as InvTab; return;
      case 'shop-tab': this.shopTab = tab as InvTab; return;
      case 'menu': return this.setModal({ type: 'menu' });
      case 'confirm-new': return this.setModal({ type: 'menu', confirmNew: true });
      case 'new-game': return this.opts.onNewGame();
      case 'save':
        this.opts.onSave();
        this.pushMessage('Game saved.', 'info');
        return this.setModal(null);
      case 'close-modal': return this.setModal(null);
      case 'respawn':
        this.setModal(null);
        return w.respawn();
      case 'keep-playing':
        w.keepPlaying();
        return this.setModal(null);
      case 'open-shop':
        if (this.modal?.type === 'npc') this.setModal({ type: 'shop', npc: this.modal.npc });
        return;
      case 'buy':
        this.note = w.buy(arg!, Number(qty)) ?? '';
        return;
      case 'sell':
        this.note = w.sell(this.shopTab, Number(index), Number(qty)) ?? '';
        return;
      case 'quest-accept':
        w.acceptQuest(arg as QuestId);
        return this.setModal(null);
      case 'quest-complete': {
        const err = w.completeQuest(arg as QuestId);
        if (err) this.note = err;
        else if (this.modal?.type === 'npc') this.modal = { ...this.modal, text: this.rewardText(arg as QuestId) };
        return;
      }
      case 'travel': {
        const err = w.travelToVictoria();
        if (err) this.note = err;
        return;
      }
    }
  }

  private rewardText(id: QuestId): string {
    const q = QUESTS[id];
    const rewards = [
      `${q.reward.exp} EXP`,
      q.reward.mesos ? `${q.reward.mesos} mesos` : '',
      ...(q.reward.items ?? []).map((r) => `${getItem(r.itemId).name} ×${r.qty}`),
    ].filter(Boolean);
    return `${q.text.complete}<br><br><b>Rewards:</b> ${rewards.join(', ')}`;
  }

  private onDoubleClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action="inv-slot"]');
    if (!el) return;
    const index = Number(el.dataset.index);
    if (this.invTab === 'equip') this.world.equip(index);
    else if (this.invTab === 'use') this.world.useItem(index);
    this.dirty = true;
  }
}
