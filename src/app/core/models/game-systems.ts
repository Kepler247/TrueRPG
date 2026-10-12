import { GameSystem } from './domain';

// Bootstrap catalog until systems are persisted in Supabase.
export const GAME_SYSTEMS: readonly GameSystem[] = [
  {
    id: '72a455a0-0d54-4db1-89c2-49b0a7fe7d71',
    slug: 'wasteland',
    name: 'Wasteland',
    description:
      'Our first system: a Fallout-inspired postnuclear RPG. Its character rules and mechanics are still being defined.',
    rulesetKey: 'wasteland',
    themeKey: 'wasteland',
  },
];
