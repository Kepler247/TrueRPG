import { GameSystem } from './domain';

// Bootstrap catalog until systems are persisted in Supabase.
export const GAME_SYSTEMS: readonly GameSystem[] = [
  {
    id: 'b31ddf11-4e20-4587-941a-ffd5d0dd5200',
    slug: 'dnds',
    name: 'D&DS',
    description:
      'Dogfights and Deep Space: explore the Milky Way in 6024, its civilizations, psionic mysteries and futuristic equipment.',
    rulesetKey: 'dnds',
    themeKey: 'dnds',
  },
  {
    id: '72a455a0-0d54-4db1-89c2-49b0a7fe7d71',
    slug: '501-rads',
    name: '501 Rads',
    description:
      'A postnuclear world of strange factions, mutated wildlife, and Gunslingers. Explore its evolving lore, regional map and rules.',
    rulesetKey: '501-rads',
    themeKey: '501-rads',
    map: {
      src: '/systems/501-rads/north-america-map.jpg',
      title: 'Map of North America',
      description:
        'The 501 Rads setting map shows the regions and settlements of postnuclear North America, including the Olympic Commonwealth, Central Wasteland, Thunder Valley, New South and Capital Wastes.',
    },
  },
  {
    id: 'ec4fcb8a-b5de-4da4-9c35-c7bdb49c5e01',
    slug: '5e',
    name: '5E (2014)',
    description:
      'The plain fantasy ruleset and shared foundation, with the complete SRD 5.1 reference.',
    rulesetKey: '5e-2014',
    themeKey: 'base5e',
  },
];
