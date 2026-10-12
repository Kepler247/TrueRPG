export interface DiceRoll {
  label: string;
  sides: number;
  die: number;
  modifier: number;
  total: number;
}

export function rollDie(sides: number): number {
  if (!Number.isInteger(sides) || sides < 2 || sides > 0x100000000)
    throw new Error('Invalid die size.');
  const sample = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;
  do {
    crypto.getRandomValues(sample);
  } while (sample[0] >= limit);
  return (sample[0] % sides) + 1;
}
export function rollWithModifier(label: string, modifier: number, sides = 20): DiceRoll {
  if (!Number.isSafeInteger(modifier)) throw new Error('Invalid roll modifier.');
  const die = rollDie(sides);
  return { label, sides, die, modifier, total: die + modifier };
}
