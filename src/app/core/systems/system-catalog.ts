import { CharacterAbility, createEntryId, InventoryEntry } from '../characters/character-core';
export interface CatalogEntry {
  id: string;
  name: string;
  category: 'weapon' | 'gear' | 'consumable' | 'feat';
  description: string;
  weight: number;
  isMock: boolean;
}
// Author-approved fixtures. Values exercise the UI; they are not published rules.
const MOCK_ITEMS: readonly CatalogEntry[] = [
  {
    id: 'test-pistol',
    name: 'Test pistol',
    category: 'weapon',
    description:
      'Testing placeholder. No official damage, range, ammo, or attack rules are assigned.',
    weight: 2,
    isMock: true,
  },
  {
    id: 'test-sword',
    name: 'Test sword',
    category: 'weapon',
    description:
      'Testing placeholder. Replace its example weight and description when the rules are defined.',
    weight: 3,
    isMock: true,
  },
  {
    id: 'test-water',
    name: 'Test water',
    category: 'consumable',
    description: 'Testing placeholder for consumables. No automatic healing or consumption effect.',
    weight: 1,
    isMock: true,
  },
  {
    id: 'test-pack',
    name: 'Test pack',
    category: 'gear',
    description: 'Testing placeholder for equipment. No automatic carry-capacity effect.',
    weight: 2,
    isMock: true,
  },
];
const MOCK_FEATS: readonly CatalogEntry[] = ['Survivor', 'Marksman', 'Scholar'].map((name) => ({
  id: `test-${name.toLowerCase()}-feat`,
  name: `Test ${name} feat`,
  category: 'feat',
  description: 'Shared testing placeholder, available to any class. No mechanical effect.',
  weight: 0,
  isMock: true,
}));
export function systemCatalog(key: string | undefined): readonly CatalogEntry[] {
  return ['501-rads', 'wasteland', '5e-2014', 'base5e'].includes(key ?? 'base5e')
    ? [
        ...MOCK_ITEMS,
        ...MOCK_FEATS,
        ...(key === '5e-2014'
          ? [
              {
                id: 'srd-grappler',
                name: 'Grappler',
                category: 'feat' as const,
                description:
                  'Strength 13 required. Gain advantage on attacks against a creature you grapple. Use an action and another grapple check to pin it; both creatures are restrained until the grapple ends. See SRD Grappler.',
                weight: 0,
                isMock: false,
              },
            ]
          : []),
      ]
    : [];
}
export function catalogInventory(entry: CatalogEntry, rulesetKey: string): InventoryEntry {
  if (entry.category === 'feat') throw new Error('Feats belong in abilities, not inventory.');
  return {
    id: createEntryId(),
    name: entry.name,
    quantity: 1,
    weight: entry.weight,
    description: entry.description,
    category: entry.category,
    catalogId: entry.id,
    catalogRuleset: rulesetKey,
    isMock: entry.isMock,
  };
}
export function catalogFeat(entry: CatalogEntry): CharacterAbility {
  return {
    id: createEntryId(),
    name: entry.name,
    kind: 'feat',
    description: entry.description,
    spellLevel: null,
    usesMax: null,
    catalogId: entry.id,
    isMock: entry.isMock,
  };
}
