import { CharacterCore, InventoryEntry } from './character-core';

export interface WeaponReference {
  attack: string;
  damage: string;
  notes: string[];
  ammunition?: { current: number; maximum?: number; label: string };
}

export function signedFormula(dice: string, bonus: number): string {
  return bonus === 0 ? dice : `${dice} ${bonus < 0 ? '-' : '+'} ${Math.abs(bonus)}`;
}

export function undefinedWeaponReference(
  core: CharacterCore,
  entry: InventoryEntry,
): WeaponReference | null {
  return entry.category === 'weapon'
    ? { attack: 'Not defined for this item', damage: 'Not defined for this item', notes: [] }
    : null;
}
