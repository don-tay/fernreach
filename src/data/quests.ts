export type QuestId = 'snail_shells' | 'orange_mushrooms';

export interface QuestDef {
  id: QuestId;
  name: string;
  npcId: string;
  minLevel: number;
  /** Either collect items (consumed on completion) or kill monsters. */
  goal: { type: 'collect'; itemId: string; count: number } | { type: 'kill'; mobId: string; count: number };
  reward: { exp: number; mesos?: number; items?: { itemId: string; qty: number }[] };
  text: { offer: string; progress: string; complete: string };
}

export const QUESTS: Record<QuestId, QuestDef> = {
  snail_shells: {
    id: 'snail_shells',
    name: "Mai's Snail Shells",
    npcId: 'mai',
    minLevel: 1,
    goal: { type: 'collect', itemId: 'snail_shell', count: 10 },
    reward: { exp: 50, items: [{ itemId: 'red_potion', qty: 10 }] },
    text: {
      offer: "Hi there, adventurer! I'm making a little shell garden, but snails keep wandering off. Could you bring me 10 Snail Shells from the hunting ground to the east?",
      progress: "Still collecting? Snails live just east of town. I need 10 Snail Shells.",
      complete: 'Wow, 10 shiny shells! Thank you so much. Here, take these potions for your trouble.',
    },
  },
  orange_mushrooms: {
    id: 'orange_mushrooms',
    name: 'Mushroom Menace',
    npcId: 'yoona',
    minLevel: 5,
    goal: { type: 'kill', mobId: 'orange_mushroom', count: 15 },
    reward: { exp: 300, mesos: 500, items: [{ itemId: 'wooden_club', qty: 1 }] },
    text: {
      offer: 'Orange Mushrooms have been stomping around near Amherst. Could you hunt 15 of them for me? I will make it worth your while.',
      progress: 'The Orange Mushrooms are past the Snail Hunting Grounds, near Amherst. Hunt 15 of them!',
      complete: "You did it! The road to Amherst is safe again. Please take this club — you've earned it.",
    },
  },
};

export const QUEST_IDS = Object.keys(QUESTS) as QuestId[];
