import type { CatalogEntry } from './system-catalog';
import { featDescriptions } from './rads-definitions';
export interface RadsWeapon {
  family:
    | 'pistol'
    | 'revolver'
    | 'smg'
    | 'rifle'
    | 'shotgun'
    | 'sniper'
    | 'melee'
    | 'heavy'
    | 'throwable';
  category: string;
  tier: string;
  damage: string;
  damageType: string;
  range: number;
  accuracy: number;
  property?: string;
  radius?: number;
  tracked?: boolean;
  finesse?: boolean;
}
type Row = [string, string, string, string, number, number, string?, number?];
const ballistic: Row[] = [
  ['Pipe Popper Pistol', 'Pipe', '1d6-2', 'Ballistic', 40, 1],
  ['Kitchen Sink Revolver', 'Pipe', '1d8-2', 'Ballistic', 30, 0],
  ['Rustbucket SMG', 'Pipe', '1d4-2', 'Ballistic', 50, 2],
  ['Scrapheap Rifle', 'Pipe', '1d8-2', 'Ballistic', 100, 1],
  ['Boomstick Shotgun', 'Pipe', '2d6-2', 'Ballistic', 25, 2],
  ['Rusty Hunting Rifle', 'Low', '1d10-1', 'Ballistic', 150, -2],
  ['P-12 Civilian Pistol', 'Low', '1d8-1', 'Ballistic', 50, 1],
  ['Six-Shooter Revolver', 'Low', '1d10-1', 'Ballistic', 40, 0],
  ["Coachman's Double Barrel", 'Low', '2d6-1', 'Ballistic', 30, 2],
  ['9mm Service Pistol', 'Mid', '1d8', 'Ballistic', 50, 1],
  ['Rattler-9 SMG', 'Mid', '1d6', 'Ballistic', 60, 2],
  ['ARK-92 Assault Rifle', 'Mid', '1d10', 'Ballistic', 120, 1],
  ['Longhorn Hunting Rifle', 'Mid', '2d8', 'Ballistic', 250, -2],
  ['M88 Combat Shotgun', 'Mid', '2d6', 'Ballistic', 30, 2],
  ['M-14 Tactical Revolver', 'Military', '1d10+2', 'Ballistic', 40, 0],
  ['ARK-110 Battle Rifle', 'Military', '1d10+2', 'Ballistic', 150, 1],
  ['Viper-6 Compact SMG', 'Military', '1d6+2', 'Ballistic', 70, 2],
  ['M101 Breacher Shotgun', 'Military', '2d6+2', 'Ballistic', 35, 2],
  ['XR-50 Anti-Material Rifle', 'Military', '2d8+2', 'Ballistic', 300, -2],
];
const energy: Row[] = [
  ['Jury-Rigged Laser Pistol', 'Pipe', '1d6-2', 'Energy', 40, 1],
  ['DynamoCo Civilian Laser Pistol', 'Low', '1d8-1', 'Energy', 60, 1],
  ['Rothberg Security Stunner', 'Low', '1d6-1', 'Electrical', 30, 1],
  ['DynamoCo L-40 Laser Rifle', 'Mid', '1d10', 'Energy', 130, 1],
  ['Rad-Rat Irradiator Pistol', 'Mid', '1d8', 'Radiation', 40, 1],
  ['Nutrocorp Chemical Sprayer', 'Mid', '2d6', 'Chemical', 20, 2],
  ['DynamoCo P-80 Plasma Pistol', 'Mid', '1d10', 'Fire', 45, 0],
  ['Rothberg Arc Rifle', 'Military', '1d10+2', 'Electrical', 100, 1],
  ['DynamoCo L-99 Precision Laser', 'Military', '2d8+2', 'Energy', 250, -2],
  ['P-91 Plasma Carbine', 'Military', '2d6+2', 'Fire', 80, 1],
  ['RAD-44 Gamma Projector', 'Military', '2d8+2', 'Radiation', 80, -1],
  ['Rothberg Ion Disruptor', 'Exotic', '2d8', 'Electrical', 90, 0],
];
const melee: Row[] = [
  ['Broken Bottle', 'Pipe', '1d4-2', 'Piercing', 5, 1, 'Concealable'],
  ['Rusty Stop Sign', 'Pipe', '2d6-2', 'Bludgeoning', 5, -1, 'Can serve as improvised cover'],
  ['Rebar Shiv', 'Pipe', '1d6-2', 'Piercing', 5, 1, 'Concealable'],
  ['Brick on a Stick', 'Pipe', '2d6-2', 'Bludgeoning', 5, -1, 'Can smash fragile obstacles'],
  ["Gravedigger's Shovel", 'Low', '2d6-1', 'Bludgeoning', 5, -1, '+2 damage against prone targets'],
  ['Rusted Fire Axe', 'Low', '2d6-1', 'Slashing', 5, -1, 'Effective against wooden barriers'],
  ['Tire Iron', 'Low', '1d6-1', 'Bludgeoning', 5, 1, 'Useful for prying'],
  ["Butcher's Cleaver", 'Low', '1d6-1', 'Slashing', 5, 1, 'Concealable'],
  ['Combat Knife', 'Mid', '1d6', 'Piercing', 5, 1, 'Finesse; concealable'],
  [
    "Fireman's Halligan",
    'Mid',
    '2d6',
    'Bludgeoning',
    5,
    -1,
    'Advantage on appropriate forced-entry checks',
  ],
  ['Security Baton', 'Mid', '1d6', 'Bludgeoning', 5, 1, 'Can deal nonlethal damage'],
  ['Industrial Chainsaw', 'Mid', '2d6', 'Slashing', 5, -1, '+2 damage against unarmored targets'],
  ['M-12 Combat Machete', 'Military', '1d6+2', 'Slashing', 5, 1, 'Finesse'],
  [
    'M-44 Breaching Hammer',
    'Military',
    '2d6+2',
    'Bludgeoning',
    5,
    -1,
    'Double damage against ordinary doors',
  ],
  [
    'Military-Grade Chainsaw',
    'Military',
    '2d6+2',
    'Slashing',
    5,
    -1,
    '+2 damage against unarmored targets',
  ],
  [
    'Rothberg Shock Baton',
    'Military',
    '1d6+2',
    'Electrical',
    5,
    1,
    'Can disrupt exposed electronics',
  ],
  ['Irradiated Cattle Prod', 'Exotic', '1d8', 'Radiation', 5, 1, 'Can contaminate struck objects'],
  [
    'Pneumatic Jackhammer',
    'Exotic',
    '2d8',
    'Bludgeoning',
    5,
    -2,
    'Ignores 2 points of object damage reduction',
  ],
];
const heavy: Row[] = [
  ['Scrap Cannon', 'Pipe', '2d8-2', 'Ballistic', 50, -2, 'Loud and cumbersome'],
  ['Junkyard Grenade Tube', 'Pipe', '2d6-2', 'Blast', 60, -2, 'Tracked shells', 10],
  ['M60 Heavy Machine Gun', 'Mid', '2d10', 'Ballistic', 100, -2, 'Braced'],
  ['M79 Grenade Launcher', 'Mid', '3d6', 'Blast', 100, -1, 'Tracked shells', 10],
  ['M72 Rocket Launcher', 'Mid', '4d8', 'Blast', 180, -2, 'Tracked rockets', 15],
  ['M134 Rotary Cannon', 'Military', '2d10+2', 'Ballistic', 120, -2, 'Braced'],
  ['Rothberg Plasma Cannon', 'Military', '3d8+2', 'Energy', 100, -2, '', 10],
  ['M202 Incendiary Launcher', 'Military', '3d8+2', 'Fire', 100, -1, 'Tracked rockets', 15],
  ['M99 Anti-Armor Missile System', 'Military', '5d8+2', 'Blast', 250, -2, 'Tracked missiles', 10],
  [
    'DynamoCo Portable Particle Accelerator',
    'Exotic',
    '4d10',
    'Energy',
    150,
    -2,
    'Penetrates ordinary cover',
  ],
];
const thrown: Row[] = [
  ['Bottle Bomb', 'Pipe', '1d6', 'Blast', 40, 0, 'Exceptionally loud', 5],
  [
    'Molotov Cocktail',
    'Pipe',
    '1d6',
    'Fire',
    40,
    0,
    'Fire persists 2 rounds; ignites flammable surfaces',
    10,
  ],
  ['Brick of Justice', 'Pipe', '1d6', 'Bludgeoning', 50, 0, 'Breaks windows and fragile objects'],
  [
    'Rustbucket Smoke Bomb',
    'Low',
    '0',
    'None',
    50,
    0,
    'Dense smoke obscures vision for 3 rounds',
    15,
  ],
  [
    'Flashbang Grenade',
    'Low',
    '1d4',
    'Blast',
    60,
    0,
    'CON save or Blinded until end of next turn',
    15,
  ],
  [
    'Nutrocorp Gas Grenade',
    'Mid',
    '2d6',
    'Chemical',
    60,
    0,
    'CON save or Poisoned for 2 rounds',
    10,
  ],
  ['M67 Fragmentation Grenade', 'Mid', '3d6', 'Blast', 60, 0, 'Fragmentation', 15],
  [
    'Rothberg Shock Grenade',
    'Mid',
    '2d6',
    'Electrical',
    60,
    0,
    'Electronic devices may be disabled 1 round',
    10,
  ],
  [
    'M88 Incendiary Grenade',
    'Military',
    '3d6',
    'Fire',
    60,
    0,
    'Burning terrain persists 3 rounds',
    15,
  ],
  [
    'M92 High-Explosive Grenade',
    'Military',
    '4d6',
    'Blast',
    60,
    0,
    'Particularly destructive to objects and cover',
    15,
  ],
  ['RAD-9 Dirty Bomb', 'Military', '2d8', 'Radiation', 60, 0, 'Contaminates area for 1 minute', 20],
  [
    'DynamoCo Singularity Grenade',
    'Exotic',
    '3d8',
    'Energy',
    60,
    0,
    'STR save or pulled 10 ft toward center',
    15,
  ],
];
const legendary: Row[] = [
  [
    'The Tax Collector',
    'Rifle',
    '1d10',
    'Ballistic',
    100,
    1,
    'Fires coins: spend $10 for +1 damage, up to +5 per attack',
  ],
  [
    'The Geneva Suggestion',
    'Heavy',
    '2d6',
    'Chemical',
    60,
    -1,
    'CON save or random Blinded/Poisoned/Incapacitated until end of next turn',
  ],
  [
    'The Divorce Attorney',
    'Shotgun',
    '2d6',
    'Ballistic',
    30,
    2,
    'On hit, deal 1d6 to a second creature adjacent to target',
  ],
  [
    'The Final Notice',
    'Revolver',
    '1d10',
    'Ballistic',
    40,
    0,
    'On each attack roll d6: on 6 double weapon damage dice',
  ],
  ["The People's Elbow", 'Melee', '2d8', 'Bludgeoning', 5, -1, 'STR save or pushed 15 ft'],
  [
    'The Microwave',
    'Long Gun',
    '1d8',
    'Fire',
    50,
    0,
    'Armored targets take 1d6 fire at start of next turn',
  ],
  [
    'The Second Amendment',
    'Heavy',
    '4d6',
    'Ballistic',
    40,
    -2,
    'Cannot attack on consecutive turns',
  ],
  [
    'The Roach Motel',
    'Long Gun',
    '1d6',
    'Chemical',
    60,
    1,
    'Marks target 3 turns; attracts mutant insects',
  ],
  [
    'The Eviction Notice',
    'Shotgun',
    '2d8',
    'Ballistic',
    30,
    1,
    'STR save or pushed 10 ft; can destroy flimsy cover',
  ],
  [
    'The HR Department',
    'Sidearm',
    '1d6',
    'Electrical',
    30,
    1,
    'WIS save or obey one harmless one-sentence instruction',
  ],
  [
    'The Stimulus Package',
    'Heavy',
    '3d6',
    'Blast',
    80,
    -1,
    'Tracked grenades; scatters $5-25 recoverable currency',
    10,
  ],
  [
    'The Organ Donor',
    'Long Gun',
    '2d6',
    'Piercing',
    60,
    0,
    'STR save or Large/smaller target pulled 15 ft',
  ],
  [
    'The Family Reunion',
    'Heavy',
    '3d8',
    'Blast',
    100,
    -2,
    'Tracked shells; three 5-ft radius areas within 20 ft of impact',
    5,
  ],
  [
    'The Holy Handgun',
    'Sidearm',
    '1d8',
    'Ballistic',
    50,
    1,
    'Once per turn: dramatic sermon during attack grants +1 accuracy',
  ],
  [
    'The Warranty Voider',
    'Long Gun',
    '2d6',
    'Electrical',
    100,
    1,
    '+1d8 against robots/electronics; CON save or electronic targets lose reactions until next turn',
  ],
];
const properties: Record<string, string> = {
  pistol: 'Quickdraw: draw/holster once per turn without an action.',
  revolver: 'Big Iron: critical hits add one additional weapon damage die.',
  smg: 'Spray: attack two targets within 10 ft of each other; distribute damage with some assigned to both.',
  rifle: 'Sustained Fire: +2 accuracy against the target you attacked last turn.',
  shotgun: 'Point Blank: +2 damage within 10 ft.',
  sniper: 'Aimed Shot: if you have not moved this turn, ignore the accuracy penalty.',
  melee: 'Light: generally concealable. Heavy: critical hits knock prone unless stated otherwise.',
  heavy: 'See individual weapon properties.',
  throwable:
    'Consumed on use. Area attacks use placement DC13, scatter 5 ft per 3 points of failure, then DEX save for half.',
};
function make(row: Row, forced?: RadsWeapon['family'], isLegendary = false): CatalogEntry {
  const [name, tierOrFamily, damage, damageType, range, accuracy, property = '', radius] = row;
  const family =
    forced ??
    (/revolver|six-shooter/i.test(name)
      ? 'revolver'
      : /smg/i.test(name)
        ? 'smg'
        : /shotgun|barrel/i.test(name)
          ? 'shotgun'
          : /hunting|anti-material|precision/i.test(name)
            ? 'sniper'
            : /pistol|stunner/i.test(name)
              ? 'pistol'
              : 'rifle');
  const category =
    family === 'melee'
      ? 'Melee Weapons'
      : family === 'heavy'
        ? 'Heavy Weapons'
        : ['pistol', 'revolver', 'throwable'].includes(family)
          ? 'Sidearms'
          : 'Long Guns';
  const weapon: RadsWeapon = {
    family,
    category,
    tier: isLegendary ? 'Legendary' : tierOrFamily,
    damage,
    damageType,
    range,
    accuracy,
    property,
    radius,
    tracked: family === 'throwable' || /tracked/i.test(property),
    finesse: /Finesse/i.test(property),
  };
  return {
    id: 'rads-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    category: 'weapon',
    weight: 0,
    isMock: false,
    radsWeapon: weapon,
    description: `${weapon.tier}; ${damage} ${damageType}; range ${range} ft (maximum ${range * 2}, disadvantage beyond normal); accuracy ${accuracy >= 0 ? '+' : ''}${accuracy}. ${properties[family]} ${property}. ${weapon.tracked ? 'Ammunition/quantity must be tracked.' : 'Ordinary ammo is unlimited and reloading costs no action.'}`,
  };
}
export const RADS_CATALOG: readonly CatalogEntry[] = [
  ...ballistic.map((r) => make(r)),
  ...energy.map((r) => make(r)),
  ...melee.map((r) => make(r, 'melee')),
  ...heavy.map((r) => make(r, 'heavy')),
  ...thrown.map((r) => make(r, 'throwable')),
  ...legendary.map((r) =>
    make(
      r,
      (
        {
          Rifle: 'rifle',
          Shotgun: 'shotgun',
          Revolver: 'revolver',
          Melee: 'melee',
          Heavy: 'heavy',
          Sidearm: 'pistol',
          'Long Gun': 'rifle',
        } as Record<string, RadsWeapon['family']>
      )[r[1]],
      true,
    ),
  ),
  ...Object.entries(featDescriptions).map(([name, description]): CatalogEntry => ({
    id: 'rads-feat-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    description,
    category: 'feat',
    weight: 0,
    isMock: false,
  })),
  ...['Light armor', 'Medium armor', 'Heavy armor', 'Powered armor'].map(
    (name, index): CatalogEntry => ({
      id: 'rads-armor-' + index,
      name,
      category: 'gear',
      weight: 0,
      isMock: false,
      radsArmor: index + 1,
      description: `Adds +${index + 1} AC after the class unarmored cap. Armor bonuses do not stack. Typical price ${[15, 60, 250, 1500][index]} chips${index === 3 ? ' or more' : ''}.`,
    }),
  ),
];
