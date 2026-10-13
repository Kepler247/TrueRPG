import type { CatalogEntry } from './system-catalog';
export interface DndsWeapon {
  damage: readonly { count: number; sides: number; type: string }[];
  reload: number;
  misfire: number;
  recoil?: number;
  rateOfFire?: number;
  penetration?: number;
  melting?: number;
  irradiating?: boolean;
  area?: string;
  saveDC?: number;
  effectiveRange?: number;
  range: number;
  longRange: number;
  hands: number;
  heavy?: boolean;
  scoped?: boolean;
  family: string;
  estimated: string[];
  price: number;
}
// Damage and keywords follow pages 61-69. Missing range/weight/price are author-authorized estimates.
type Row = [string, string, number, number, string, number, number?, number?, string?];
const rows: Row[] = [
  ['Revolver', 'ballistic', 6, 1, '2d8 Piercing', 1, undefined, undefined, 'penetration:1'],
  ['Pistol', 'ballistic', 10, 2, '2d6 Piercing', 1],
  ['Auto-Pistol', 'ballistic', 2, 4, '1d4 Piercing', 1, 4, 3],
  ['Sawed Off Shotgun', 'ballistic', 2, 2, '2d6 Piercing', 1, undefined, undefined, 'er:20'],
  ['Submachine Gun', 'ballistic', 3, 2, '1d4 Piercing', 2, 2, 2],
  ['Assault Rifle', 'ballistic', 4, 2, '1d6 Piercing', 2, 2, 1],
  ['DMR', 'ballistic', 6, 2, '3d8 Piercing', 2, undefined, undefined, 'penetration:2'],
  [
    'Sniper Rifle',
    'ballistic',
    2,
    2,
    '4d8 Piercing',
    2,
    undefined,
    undefined,
    'penetration:3 scoped',
  ],
  ['Shotgun', 'ballistic', 4, 4, '2d8 Piercing', 2, undefined, undefined, 'er:30'],
  ['Minigun', 'ballistic', 4, 5, '1d6 Piercing', 2, 4, 4, 'heavy'],
  ['Laspistol', 'laser', 12, 1, '2d8 Laser', 1],
  ['Las Auto-Pistol', 'laser', 5, 2, '1d6 Laser', 1, 2, 1],
  ['Submachine Lasgun', 'laser', 5, 2, '1d6 Laser', 2, 2, 2],
  ['Assault Lasgun', 'laser', 6, 2, '1d8 Laser', 2, 2, 1],
  ['Pulse Lasgun', 'laser', 4, 1, '3d8 Laser', 2, undefined, undefined, 'penetration:2 melting:1'],
  [
    'Longlas',
    'laser',
    1,
    6,
    '4d12 Laser',
    2,
    undefined,
    undefined,
    'penetration:3 melting:1 scoped',
  ],
  ['Scatterlas', 'laser', 6, 2, '2d10 Laser', 2, undefined, undefined, 'er:30'],
  ['Heavy Las Repeater', 'laser', 6, 3, '1d6 Laser', 2, 3, 3, 'heavy'],
  ['Handflamer', 'inferno', 1, 2, '3d6 Fire', 1, undefined, undefined, 'melting:2 area:30 dc:13'],
  [
    'Heavy Flamer',
    'inferno',
    2,
    2,
    '4d6 Fire',
    2,
    undefined,
    undefined,
    'heavy melting:3 area:45 dc:14',
  ],
  [
    'Meltagun',
    'inferno',
    2,
    2,
    '2d6 Fire + 2d6 Piercing',
    2,
    undefined,
    undefined,
    'melting:4 er:20',
  ],
  [
    'Mini-Melta',
    'inferno',
    4,
    2,
    '2d8 Fire + 2d8 Piercing',
    2,
    undefined,
    undefined,
    'heavy melting:4 er:30',
  ],
  [
    'Plasma Pistol',
    'plasma',
    1,
    4,
    '4d8 Laser',
    1,
    undefined,
    undefined,
    'penetration:4 melting:2',
  ],
  ['Plasma Gun', 'plasma', 1, 4, '4d10 Laser', 2, undefined, undefined, 'penetration:4 melting:2'],
  [
    'Heavy Plasma Beam Cannon',
    'plasma',
    1,
    5,
    '6d10 Laser',
    2,
    undefined,
    undefined,
    'heavy penetration:10 melting:2',
  ],
  ['Bolt Pistol', 'bolt', 6, 2, '3d8 Piercing', 1, undefined, undefined, 'heavy penetration:1'],
  ['Bolt Auto-Pistol', 'bolt', 2, 2, '2d8 Piercing', 1, 3, 2, 'heavy penetration:1'],
  ['Stormbolter', 'bolt', 2, 3, '1d8 Piercing', 2, 5, 4, 'heavy penetration:1'],
  ['Bolter', 'bolt', 3, 2, '1d12 Piercing', 2, 3, 2, 'heavy penetration:1'],
  ['Bolt Carbine', 'bolt', 4, 2, '3d12 Piercing', 2, undefined, undefined, 'heavy penetration:3'],
  ['Bolt Sniper', 'bolt', 1, 2, '5d12 Piercing', 2, undefined, undefined, 'heavy penetration:3'],
  ['Bolt Shredder Gun', 'bolt', 3, 2, '4d10 Piercing', 2, undefined, undefined, 'heavy er:15'],
  ['Heavy Bolter', 'bolt', 3, 2, '1d8 Piercing', 2, 4, 3, 'heavy'],
  ['Mag Pistol', 'array', 4, 2, '2d8 Piercing', 1, undefined, undefined, 'area:60'],
  ['Mag Auto-Pistol', 'array', 2, 2, '1d6 Piercing', 1, 2, 1],
  ['Mag Submachine Gun', 'array', 3, 2, '1d6 Piercing', 2, 3, 2],
  ['Mag Rifle', 'array', 4, 2, '1d10 Piercing', 2, 3, 1],
  ['Mag Chaingun', 'array', 4, 2, '1d8 Piercing', 2, 2, 2, 'heavy'],
  [
    'Gamma Pistol',
    'gamma',
    10,
    2,
    '2d6 Piercing + 1d6 Poison',
    1,
    undefined,
    undefined,
    'irradiating',
  ],
  ['Gamma Rifle', 'gamma', 4, 2, '1d6 Piercing + 1d4 Poison', 2, 2, 1, 'irradiating'],
  ['Gamma Submachine Gun', 'gamma', 3, 2, '1d4 Piercing + 1d4 Poison', 2, 2, 2, 'irradiating'],
];
export const DNDS_CATALOG: readonly CatalogEntry[] = [
  ...rows.map(
    ([
      name,
      family,
      reload,
      misfire,
      damage,
      hands,
      recoil,
      rateOfFire,
      keywords = '',
    ]): CatalogEntry => {
      const value = (key: string) =>
        Number(new RegExp(`${key}:(\\d+)`).exec(keywords)?.[1]) || undefined;
      const heavy = keywords.includes('heavy'),
        scoped = keywords.includes('scoped') || /Sniper/.test(name);
      const range = value('er') ?? value('area') ?? (scoped ? 180 : hands === 1 ? 60 : 100);
      const weapon: DndsWeapon = {
        damage: [...damage.matchAll(/(\d+)d(\d+) (\w+)/g)].map((m) => ({
          count: +m[1],
          sides: +m[2],
          type: m[3],
        })),
        reload,
        misfire,
        hands,
        family,
        range,
        longRange: range * 2,
        recoil,
        rateOfFire,
        heavy,
        scoped,
        penetration: value('penetration'),
        melting: value('melting'),
        effectiveRange: value('er'),
        irradiating: keywords.includes('irradiating'),
        area: value('area') ? `${value('area')} ft cone` : undefined,
        saveDC: value('dc'),
        estimated: ['weight', 'price', ...(value('er') || value('area') ? [] : ['range'])],
        price: heavy ? 1500 : hands === 1 ? 250 : 650,
      };
      return {
        id: `dnds-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        category: 'weapon',
        weight: heavy ? 30 : hands === 1 ? 3 : 9,
        isMock: false,
        weapon,
        description: `${damage}. Reload ${reload} actions of firing; Misfire ${misfire}. ${recoil ? `Recoil ${recoil}; Rate of Fire ${rateOfFire}.` : ''} ${keywords.replace(/:/g, ' ')}. Range ${range}/${range * 2} ft. Weight and price${weapon.estimated.includes('range') ? ', and range,' : ''} are companion estimates. Penetration, armor melting, irradiation and area targets are resolved by the GM.`,
      };
    },
  ),
  ...['Ceramite', 'Kevlar', 'Nanoshield', 'Power Armor'].map((name, index): CatalogEntry => ({
    id: `dnds-${name.toLowerCase().replace(/ /g, '-')}`,
    name,
    category: 'gear',
    weight: [40, 12, 25, 100][index],
    isMock: false,
    armor: {
      ac: [16, 12, 14, 18][index],
      dexCap: [2, null, 2, 0][index],
      resistances: [
        ['Laser', 'Fire'],
        ['Piercing'],
        ['Ranged Piercing', 'Ranged Laser'],
        ['Piercing', 'Laser', 'Fire'],
      ][index],
      powerArmor: index === 3,
      estimated: ['AC', 'weight', 'price', 'base armor'],
      price: [1200, 200, 3000, 10000][index],
    },
    description:
      [
        'Ceramite armor resists Laser and Fire; estimated half-plate foundation.',
        'Kevlar resists Piercing; estimated studded-leather foundation.',
        'Nanoshield resists ranged Piercing and Laser; estimated breastplate foundation. Battery effects are GM adjudicated.',
        'Power Armor resists Piercing, Laser and Fire; permits heavy weapons without proficiency/Strength prerequisite. Without Power Armors proficiency: DC20 Wisdom check, failure 3d10 Psychic and one exhaustion; success repeat every five minutes. Estimated plate foundation.',
      ][index] + ' AC, weight and price are companion estimates; editable on the character.',
  })),
  ...[
    'Incendiary',
    'Shock',
    'Cryo',
    'Radioactive',
    'Corrosive',
    'Psychoactive',
    'Hollow Point',
    'Armor Piercing',
    'Explosive',
  ].map((name, index): CatalogEntry => ({
    id: `dnds-ammo-${index}`,
    name: `${name} ammunition`,
    category: 'consumable',
    weight: 1,
    isMock: false,
    ammoType: name,
    description:
      (index < 6
        ? `Adds one weapon damage die of ${['Fire', 'Lightning', 'Cold', 'Poison', 'Acid', 'Psychic'][index]} damage.`
        : [
            'Double damage against light/unarmored targets; half against medium/heavy.',
            'Double damage against heavy armor; half against medium/light/unarmored.',
            'Damage affects all enemies within one tile of the target.',
          ][index - 6]) +
      ' One quantity is one special-ammunition reload. Estimated weight 1 lb; estimated price 50 credits. Check compatibility with the weapon family; standard ammo is free and unlimited.',
  })),
];
