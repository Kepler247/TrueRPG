import type { CharacterRuleset, ClassResourceDefinition } from '../characters/character-ruleset';
import { CharacterCore, StatKey, STATS, BASE_SKILLS } from '../characters/character-core';
import progressions from './5e-class-progressions.json';

export const GUNSLINGER_FEATURES = [
  [1, 'Lucky Strike', 'Spend 1 Heat to reroll any check; you must use the new result.'],
  [1, 'Stroke of Genius', 'Spend 3 Heat to roll three dice on a check and choose any result.'],
  [
    1,
    'Pistol Training',
    '+1 to pistol checks and damage rolls. Apply this when resolving pistol attacks.',
  ],
  [
    2,
    'Fan the Hammer',
    'Spend 2 Heat before a pistol attack. Triple its damage if it hits; it may miss.',
  ],
  [3, 'Dual Wield', 'Attack with both pistols within one action.'],
  [
    4,
    'Distraction',
    'Spend 2 Heat to target someone who damaged a teammate since your last turn. For the rest of your turn, gain advantage on checks to harm them and guaranteed pistol hits. A target cannot be distracted twice.',
  ],
  [
    4,
    'Pickpocket',
    'Spend 2 Heat to steal a known item, or a random item if unknown. The defender rolls a d20 and notices only on a 20.',
  ],
  [
    5,
    'Deadeye',
    'Spend 5 Heat on a non-boss. If they remain alive and in line of sight next turn, kill them instantly. Take no other action or movement; forced movement interrupts this. Heat is not refunded.',
  ],
  [6, 'Shrouded Attack', 'Gain advantage on checks to harm a target while you are undetected.'],
  [
    6,
    'Fantastic Story',
    "Spend 4 Heat to tell a nonsensical story that becomes partly true at the GM's discretion. It always helps to distract, persuade, or intimidate.",
  ],
  [
    7,
    'No One Walks Away',
    'Spend 7 Heat to fire twice at any number of visible targets. Heat gains are now doubled.',
  ],
  [8, 'Master Gambler', 'Gain advantage on checks involving gambling with money or property.'],
  [
    8,
    'Old Friend',
    'Spend 5 Heat to find a helpful, knowledgeable friend who owes you a favor, anywhere.',
  ],
  [9, 'Bending Bullets', 'Ricochet shots can hit covered or unseen targets at -3 to hit.'],
  [
    9,
    'Wild Plan',
    'Spend 8 Heat to propose a plan. Following its steps grants advantage on checks advancing it. The Gunslinger has final say.',
  ],
  [
    10,
    'Super Deadeye',
    'Spend 11 Heat. Deadeye now works on bosses with its normal delay, or instantly on non-bosses.',
  ],
  [
    11,
    'Unbelievable Luck',
    'Spend 10 Heat to find a non-plot item nearby; obtaining it may still be difficult. Heat no longer has a maximum.',
  ],
  [
    12,
    'Divine Intervention',
    'Spend 15 Heat to wish for nearly anything. Each use increases the chance of unintended consequences; the GM resolves these. Heat gains are now three times their base value.',
  ],
] as const;

export function heatCapacity(level: number): number | null {
  return level >= 11 ? null : 3 + 2 * Math.floor((level - 1) / 2);
}
export function heatMultiplier(level: number): number {
  return level >= 12 ? 3 : level >= 7 ? 2 : 1;
}
export function currentHeat(core: CharacterCore): number {
  const heat = core['heat'];
  return typeof heat === 'number' && Number.isSafeInteger(heat) && heat >= 0 ? heat : 0;
}
const HEAT_RESOURCE: ClassResourceDefinition = {
  id: 'heat',
  name: 'Heat',
  current: currentHeat,
  setCurrent: (core, value) => ({ ...core, heat: value }),
  maximum: (core) => heatCapacity(core.level),
  gainMultiplier: (core) => heatMultiplier(core.level),
  help: 'Gain 1 base Heat per successful Charisma or Dexterity check/save, pistol hit, or grenade hit (each hit stacks); gain 2 per pistol/grenade kill. Gains double at level 7 and triple at level 12. The GM may award extra Heat.',
  resetsOnLongRest: true,
};
function addFeatures(
  core: CharacterCore,
  features: readonly (readonly [number, string, string])[],
  prefix: string,
): CharacterCore {
  const abilities = [...core.abilities];
  for (const [level, name, description] of features) {
    const id = `${prefix}-${level}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    if (level <= core.level && !abilities.some((a) => a.id === id))
      abilities.push({
        id,
        name,
        kind: 'class feature',
        description,
        spellLevel: null,
        usesMax: null,
      });
  }
  return { ...core, abilities };
}
export function make501Rules(base: CharacterRuleset): CharacterRuleset {
  const advance = (core: CharacterCore) => {
    if (core.class !== 'Gunslinger') return core;
    const cap = heatCapacity(core.level);
    return {
      ...addFeatures(core, GUNSLINGER_FEATURES, '501-gunslinger'),
      heat: cap === null ? currentHeat(core) : Math.min(cap, currentHeat(core)),
    };
  };
  return {
    ...base,
    abilityActions: (core) =>
      core.class !== 'Gunslinger'
        ? []
        : GUNSLINGER_FEATURES.filter((feature) => feature[0] <= core.level).flatMap((feature) => {
            const costs: Record<string, number> = {
              'Lucky Strike': 1,
              'Stroke of Genius': 3,
              'Fan the Hammer': 2,
              Distraction: 2,
              Pickpocket: 2,
              Deadeye: 5,
              'Fantastic Story': 4,
              'No One Walks Away': 7,
              'Old Friend': 5,
              'Wild Plan': 8,
              'Super Deadeye': 11,
              'Unbelievable Luck': 10,
              'Divine Intervention': 15,
            };
            const cost = costs[feature[1]];
            return cost === undefined
              ? []
              : [
                  {
                    abilityId: `501-gunslinger-${feature[0]}-${feature[1].toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                    cost,
                    ...(feature[1] === 'Lucky Strike'
                      ? { rollMode: 'reroll' as const }
                      : feature[1] === 'Stroke of Genius'
                        ? { rollMode: 'choose-three' as const }
                        : {}),
                  },
                ];
          }),
    maxLevel: 12,
    classResource: (core) => (core.class === 'Gunslinger' ? HEAT_RESOURCE : null),
    maxScore: undefined,
    improvementMax: null,
    skills: BASE_SKILLS.map((skill) =>
      skill.id === 'arcana' ? { id: 'hacking', name: 'Hacking', stat: 'int' } : skill,
    ),
    creator: {
      races: [],
      classes: ['Gunslinger'],
      classDescriptions: {
        Gunslinger:
          'A pistol and grenade specialist fueled by Heat. Dexterity and Charisma are recommended.',
      },
    },
    characterNotes: (core) => [
      'Maximum level 12. Hacking (Intelligence) replaces Arcana.',
      'Gain two ability-score points at every level-up; scores may exceed 20. Shared feats are chosen at levels 3, 6, 9, and 12.',
      ...(core.class === 'Gunslinger'
        ? [
            `Gunslinger HP uses d10: first-level HP is 10 + Constitution; later increases use 6 or a d10 roll + Constitution.`,
            'Pistol checks +1; pistol damage rolls +1.',
            `Heat maximum: ${heatCapacity(core.level) ?? 'unlimited'}. Heat gains: ${heatMultiplier(core.level)} times the base amount. Long rests reset Heat.`,
          ]
        : []),
    ],
    hitDie: (core) => (core.class === 'Gunslinger' ? 10 : null),
    statPoints: () => 2,
    featRequired: (level) => level % 3 === 0,
    heatCapacity,
    heatGainMultiplier: heatMultiplier,
    hasHeat: (core) => core.class === 'Gunslinger',
    testFeatName: 'Test Feat (placeholder)',
    heatHelp:
      'Gain 1 base Heat per successful Charisma or Dexterity check/save, pistol hit, or grenade hit (each hit stacks); gain 2 per pistol/grenade kill. Gains double at level 7 and triple at level 12. The GM may award extra Heat.',
    advance,
    initialize: (core) =>
      advance({
        ...core,
        hpMax:
          core.class === 'Gunslinger'
            ? Math.max(1, 10 + base.abilityModifier(core.scores.con))
            : core.hpMax,
      }),
    levelUpPrompts: (core, level) => [
      'Allocate two ability-score points; both may go to the same stat. Scores can exceed 20.',
      ...(level % 3 === 0
        ? [
            'Choose a shared feat. The author has not defined the feat catalog yet; record your agreed choice.',
          ]
        : []),
      ...(core.class === 'Gunslinger'
        ? [
            `Gunslinger: d10 HP (fixed 6 or roll), plus Constitution; Heat maximum ${heatCapacity(level) ?? 'unlimited'}.`,
            ...GUNSLINGER_FEATURES.filter((f) => f[0] === level).map((f) => `${f[1]}: ${f[2]}`),
          ]
        : []),
    ],
  };
}

const CLASSES: Record<string, { die: number; saves: StatKey[] }> = {
  Barbarian: { die: 12, saves: ['str', 'con'] },
  Bard: { die: 8, saves: ['dex', 'cha'] },
  Cleric: { die: 8, saves: ['wis', 'cha'] },
  Druid: { die: 8, saves: ['int', 'wis'] },
  Fighter: { die: 10, saves: ['str', 'con'] },
  Monk: { die: 8, saves: ['str', 'dex'] },
  Paladin: { die: 10, saves: ['wis', 'cha'] },
  Ranger: { die: 10, saves: ['str', 'dex'] },
  Rogue: { die: 8, saves: ['dex', 'int'] },
  Sorcerer: { die: 6, saves: ['con', 'cha'] },
  Warlock: { die: 8, saves: ['wis', 'cha'] },
  Wizard: { die: 6, saves: ['int', 'wis'] },
};
export const RACES: Record<
  string,
  { boosts: Partial<Record<StatKey, number>>; speed: number; small?: boolean }
> = {
  Human: { boosts: Object.fromEntries(STATS.map((s) => [s.key, 1])), speed: 30 },
  'Hill Dwarf': { boosts: { con: 2, wis: 1 }, speed: 25 },
  'High Elf': { boosts: { dex: 2, int: 1 }, speed: 30 },
  'Lightfoot Halfling': { boosts: { dex: 2, cha: 1 }, speed: 25, small: true },
  Dragonborn: { boosts: { str: 2, cha: 1 }, speed: 30 },
  'Rock Gnome': { boosts: { int: 2, con: 1 }, speed: 25, small: true },
  'Half-Elf': { boosts: { cha: 2 }, speed: 30 },
  'Half-Orc': { boosts: { str: 2, con: 1 }, speed: 30 },
  Tiefling: { boosts: { int: 1, cha: 2 }, speed: 30 },
};
export function classProgression(core: CharacterCore, level: number): string {
  const table = (progressions as Record<string, { levels: Record<string, string> }>)[
    core.class ?? ''
  ];
  return table?.levels[String(level)] ?? '';
}
export function makePlain5eRules(base: CharacterRuleset): CharacterRuleset {
  const advance = (core: CharacterCore) => {
    let next = addFeatures(
      core,
      Array.from({ length: core.level }, (_, i): [number, string, string] => [
        i + 1,
        `${core.class ?? 'Class'} level ${i + 1}`,
        `${classProgression(core, i + 1)}. See the complete SRD reference for choices and feature details.`,
      ]).filter((f) => classProgression(core, f[0]) && classProgression(core, f[0]) !== '\u2014'),
      '5e',
    );
    if (core.class === 'Barbarian' && core.level === 20 && core['primalChampionApplied'] !== true) {
      const scores = {
        ...next.scores,
        str: Math.max(next.scores.str, Math.min(24, next.scores.str + 4)),
        con: Math.max(next.scores.con, Math.min(24, next.scores.con + 4)),
      };
      const hpAdjustment =
        (base.abilityModifier(scores.con) - base.abilityModifier(next.scores.con)) * next.level;
      next = {
        ...next,
        scores,
        hpMax: next.hpMax === null ? null : next.hpMax + hpAdjustment,
        primalChampionApplied: true,
      };
    }
    return next;
  };
  return {
    ...base,
    creator: { races: Object.keys(RACES), classes: Object.keys(CLASSES) },
    characterNotes: (core) => [
      'Maximum level 20. Ability-score improvements normally cap at 20.',
      ...(CLASSES[core.class ?? '']
        ? [
            `${core.class} uses d${CLASSES[core.class!].die} HP; class saving throw proficiencies apply at creation.`,
          ]
        : []),
      ...(core.race
        ? ['Racial ability bonuses, speed, size, and defined HP bonuses apply at creation.']
        : []),
    ],
    hitDie: (core) => CLASSES[core.class ?? '']?.die ?? null,
    hpPerLevelBonus: (core) => (core.race === 'Hill Dwarf' ? 1 : 0),
    featHelp: 'You may instead choose Grappler (Strength 13+) with zero stat points allocated.',
    featReplacesPoints: (core, name) => {
      if (name !== 'Grappler') return false;
      if (core.scores.str < 13) throw new Error('Grappler requires Strength 13.');
      return true;
    },
    statPoints: (core, level) =>
      [4, 8, 12, 16, 19].includes(level) ||
      (core.class === 'Fighter' && [6, 14].includes(level)) ||
      (core.class === 'Rogue' && level === 10)
        ? 2
        : 0,
    advance,
    initialize: (core) => {
      const race = RACES[core.race ?? ''];
      const definition = CLASSES[core.class ?? ''];
      const scores = { ...core.scores };
      for (const stat of STATS) scores[stat.key] += race?.boosts[stat.key] ?? 0;
      if (core.race === 'Half-Elf') {
        const choices = core['raceBoosts'];
        if (
          !Array.isArray(choices) ||
          choices.length !== 2 ||
          choices[0] === choices[1] ||
          choices.some((s) => !STATS.some((stat) => stat.key === s && stat.key !== 'cha'))
        )
          throw new Error('Half-Elves need two different non-Charisma ability choices.');
        for (const choice of choices) scores[choice as StatKey] += 1;
      }
      return advance({
        ...core,
        scores,
        speed: { ...core.speed, distance: race?.speed ?? core.speed.distance },
        size: race?.small ? 'small' : 'medium',
        hpMax: definition
          ? Math.max(
              1,
              definition.die +
                base.abilityModifier(scores.con) +
                (core.race === 'Hill Dwarf' ? 1 : 0),
            )
          : core.hpMax,
        saves: Object.fromEntries(
          STATS.map((stat) => [
            stat.key,
            {
              ...core.saves[stat.key],
              proficient: definition?.saves.includes(stat.key) ?? core.saves[stat.key].proficient,
            },
          ]),
        ) as CharacterCore['saves'],
      });
    },
    skillBonus: (core, skill, rules) =>
      base.skillBonus(core, skill, rules) +
      (core.class === 'Bard' &&
      core.level >= 2 &&
      (core.skills[skill.id]?.proficiency ?? 'none') === 'none'
        ? Math.floor(rules.proficiencyBonus(core.level) / 2)
        : 0),
    initiative: (core, rules) =>
      base.initiative(core, rules) +
      (core.class === 'Bard' && core.level >= 2
        ? Math.floor(rules.proficiencyBonus(core.level) / 2)
        : 0),
    levelUpPrompts: (core, level) =>
      [
        classProgression(core, level),
        'Consult your class table and feature text for spell selections, spell slots, subclass choices, skill training, and resources.',
        'For an Ability Score Improvement, add two points (maximum 20), or choose the optional SRD Grappler feat if Strength is at least 13.',
      ].filter(Boolean),
  };
}
export function validateSystemCore(core: CharacterCore, rules: CharacterRuleset): void {
  if (rules.creator.races.length && (!core.race || !rules.creator.races.includes(core.race)))
    throw new Error('Choose a race from this system before saving the character.');
  rules.validate?.(core);
  if ((core.hitDiceSpent ?? 0) > core.level)
    throw new Error('Spent Hit Dice cannot exceed character level.');
  const resource = rules.classResource?.(core);
  if (resource) {
    const current = resource.current(core);
    const maximum = resource.maximum(core);
    if (!Number.isSafeInteger(current) || current < 0 || (maximum !== null && current > maximum))
      throw new Error(`${resource.name} must be a nonnegative whole number within its maximum.`);
  }
  if (core.hpCurrent !== undefined && (core.hpMax === null || core.hpCurrent > core.hpMax))
    throw new Error('Current HP must be between 0 and maximum HP.');
  if (core.level > (rules.maxLevel ?? 20))
    throw new Error(`This system has a maximum level of ${rules.maxLevel ?? 20}.`);
  if (rules.maxScore !== undefined && STATS.some((stat) => core.scores[stat.key] > rules.maxScore!))
    throw new Error(`Ability scores must be at most ${rules.maxScore}.`);
  if (rules.heatCapacity && core['heat'] !== undefined) {
    if (
      typeof core['heat'] !== 'number' ||
      !Number.isSafeInteger(core['heat']) ||
      core['heat'] < 0 ||
      (rules.heatCapacity(core.level) !== null && core['heat'] > rules.heatCapacity(core.level)!)
    )
      throw new Error('Heat must be a nonnegative whole number within your level limit.');
  }
}
