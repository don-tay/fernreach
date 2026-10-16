export type QuestId = 'shell_garden' | 'bouncecap_trouble';

export interface QuestDef {
  id: QuestId;
  name: string;
  npcId: string;
  minLevel: number;
  /** Either collect items (consumed on completion) or kill monsters. */
  goal: { type: 'collect'; itemId: string; count: number } | { type: 'kill'; mobId: string; count: number };
  reward: { exp: number; acorns?: number; items?: { itemId: string; qty: number }[] };
  text: { offer: string; progress: string; complete: string };
}

export const QUESTS: Record<QuestId, QuestDef> = {
  shell_garden: {
    id: 'shell_garden',
    name: "Pella's Shell Garden",
    npcId: 'pella',
    minLevel: 1,
    goal: { type: 'collect', itemId: 'mossy_shell', count: 10 },
    reward: { exp: 40, items: [{ itemId: 'berry_tonic', qty: 10 }] },
    text: {
      offer: "Oh, hello! I'm lining my garden path with shells, but I've run out. Could you bring me 10 Mossy Shells? Shellbugs carry them out in Shellgrass Meadow, just east of here.",
      progress: 'Any luck? Shellbugs roam Shellgrass Meadow to the east. I need 10 Mossy Shells.',
      complete: 'Ten lovely mossy shells! My path is going to sparkle. Please take these tonics for your trouble.',
    },
  },
  bouncecap_trouble: {
    id: 'bouncecap_trouble',
    name: 'Bouncecap Trouble',
    npcId: 'hazel',
    minLevel: 5,
    goal: { type: 'kill', mobId: 'bouncecap', count: 15 },
    reward: { exp: 320, acorns: 450, items: [{ itemId: 'oak_cudgel', qty: 1 }] },
    text: {
      offer: "Bouncecaps have been bounding all over Briarwood Trail and trampling the travellers' path. Could you clear out 15 of them? I'll make it worth your while.",
      progress: 'Briarwood Trail is past the second meadow. Clear out 15 Bouncecaps!',
      complete: 'The trail is quiet again — thank you! Take this cudgel; it served me well once.',
    },
  },
};

export const QUEST_IDS = Object.keys(QUESTS) as QuestId[];
