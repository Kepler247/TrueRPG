import { GameSystem } from './domain';

// Bootstrap catalog until systems are persisted in Supabase.
export const GAME_SYSTEMS: readonly GameSystem[] = [
  {
    id: '72a455a0-0d54-4db1-89c2-49b0a7fe7d71',
    slug: '501-rads',
    name: '501 Rads',
    description:
      'A postnuclear world of strange factions, mutated wildlife, and Gunslingers. Explore the complete first draft and its evolving rules.',
    rulesetKey: '501-rads',
    themeKey: '501-rads',
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
