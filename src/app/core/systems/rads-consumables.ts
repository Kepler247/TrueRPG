import type { CatalogEntry } from './system-catalog';
export const RADS_CONSUMABLES: readonly CatalogEntry[] = (
  [
    ['Dirty Bandages', 'Pipe', 'Restore 1d4 HP.'],
    ['First Aid Kit', 'Low', 'Restore 1d6+2 HP.'],
    ['Nutrocorp Stimpak', 'Mid', 'Restore 2d6+2 HP.'],
    ['Military Trauma Injector', 'Military', 'Restore 4d6+4 HP.'],
    [
      'RadAway',
      'Mid',
      'Remove temporary radiation conditions and contamination, not permanent mutations.',
    ],
    ['Antidote', 'Low', 'End Poisoned and neutralize one ordinary poison.'],
    ['Burn Gel', 'Low', 'End Burning and restore 1d4 HP.'],
    ['Adrenaline Shot', 'Mid', 'End Stunned.'],
    ['Surgical Foam', 'Military', 'Restore 2d8 HP and end one ordinary bleeding/wound effect.'],
    [
      'Nutrocorp Miracle Cure',
      'Exotic',
      'Restore all HP and end Poisoned, Burning and temporary radiation. Roll a radioactive side effect.',
    ],
    [
      'Rajin',
      'Low',
      '+2 melee damage for 3 turns; afterward disadvantage on Intelligence checks for 10 minutes.',
    ],
    [
      'BulletTime',
      'Mid',
      '+10 ft speed and +2 Initiative for 3 turns; afterward -10 ft speed for 2 turns.',
    ],
    [
      'Buffout',
      'Mid',
      '+2 Strength checks/saves for 10 minutes; afterward disadvantage on Dexterity checks for 10 minutes.',
    ],
    [
      'Med-X',
      'Mid',
      'Reduce incoming damage by 2 for 3 turns, minimum 0; afterward disadvantage on Perception checks for 10 minutes.',
    ],
    [
      'Overdrive',
      'Military',
      '+2 weapon accuracy and +2 weapon damage for 3 turns; afterward suffer 2d6 damage.',
    ],
    [
      'Berserker Serum',
      'Military',
      'Double melee damage for 2 turns; cannot willingly retreat from a visible enemy. Afterward Stunned until end of next turn.',
    ],
    [
      'Nutrocorp Experimental Stimulant',
      'Exotic',
      'One additional Action on your next turn. Roll twice on the radiation table and apply both.',
    ],
    [
      'Canned Mystery Meat',
      'Low',
      'During a short rest restore an additional 1d4 HP; during a long rest gain 4 temporary HP.',
    ],
    [
      'Purified Water',
      'Low',
      'Remove ordinary dehydration. Advantage on next CON save against heat/exhaustion within 1 hour.',
    ],
    [
      'Military Ration Pack',
      'Mid',
      'Sustains one person for a day; +1 to next Survival check that day.',
    ],
    [
      'Caffeine Tablets',
      'Low',
      'Ignore ordinary fatigue penalties for 1 hour; afterward disadvantage on next CON check resisting fatigue.',
    ],
    ['Anti-Rad Tablets', 'Mid', 'Radiation resistance for 3 turns.'],
    [
      'Glow Juice',
      'Pipe',
      'Glow for 10 minutes: advantage on Intimidation against ordinary wastelanders; disadvantage on Stealth.',
    ],
    [
      'Mutagen Cocktail',
      'Military',
      'One random positive mutation for 10 minutes; afterward roll a radioactive side effect. Temporary mutations may recur after expiry and do not preclude later permanent acquisition.',
    ],
    [
      'Nutrocorp Rejuvenation Serum',
      'Exotic',
      'Restore 3d8 HP; +10 ft speed for 3 turns; afterward suffer 1d8 radiation damage.',
    ],
    [
      'Nutrocorp Genesis Serum',
      'Exotic',
      'One permanent random positive mutation, excluding duplicates. Typically 10,000+ chips and quest-limited availability.',
    ],
  ] as const
).map(([name, tier, effect]) => ({
  id: 'rads-item-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  category: 'consumable',
  weight: 0,
  isMock: false,
  radsConsumable: name,
  description: `${tier}. ${effect} Self administration: Bonus Action. Other willing/incapacitated creature within 5 ft: Action. Same benefit refreshes without stacking; Psycho redosing delays the crash. Ordinary healing cannot revive a dead character.`,
}));
