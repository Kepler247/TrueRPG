import { attackDnds, reloadDnds, weaponSchema } from './dnds-combat';
import type { CharacterRuleset } from '../characters/character-ruleset';
import { CharacterCore, CharacterAbility } from '../characters/character-core';
import { makePlain5eRules } from './system-rules';
const RACES: Record<string, string> = {
  Human: 'Human',
  'Eldar (High Elf)': 'High Elf',
  'Half-Eldar (Half-Elf)': 'Half-Elf',
  'Drukhari (Drow)': 'High Elf',
  'Votaan (Hill Dwarf)': 'Hill Dwarf',
  'Nocturni (Tiefling)': 'Tiefling',
  'Orak-Hai (Half-Orc)': 'Half-Orc',
  'Dargonian (Dragonborn)': 'Dragonborn',
  'Saturnian (Rock Gnome)': 'Rock Gnome',
  'Uranian (Lightfoot Halfling)': 'Lightfoot Halfling',
  'Omnic (Human foundation)': 'Human',
};
const CLASSES: Record<string, string> = {
  'Battle Medic (Cleric)': 'Cleric',
  'Heavy Gunner (Paladin)': 'Paladin',
};
const FEATURES: Record<string, readonly [string, string][]> = {
  Artificer: [
    [
      'Technological Services',
      'Unjam misfires without a check. Severely damaged weapons require an Intelligence or Dexterity tinkering check with advantage.',
    ],
  ],
  Bard: [
    [
      'Psionic Amplification',
      'While in melee range of another Psion, both gain +1d6 to all rolls. Apply only while the condition holds.',
    ],
  ],
  Cleric: [
    [
      'Power Armor Training',
      'Proficient with Power Armor; Battle Medic abilities use advanced medical and offensive technology.',
    ],
  ],
  Druid: [
    [
      'Humanoid Mimicry',
      'Druids can mimic any living creature. Other humanoid identities: no practice gives disadvantage on Charisma checks; some practice -5; well practiced -2; mastery normal. GM determines practice. Non-humanoid Wild Shape follows 5E.',
    ],
  ],
  Fighter: [
    [
      'Space Fighter',
      'Firearms are part of your training. Gunslinger is a suggested subclass template, not the 501 Rads class.',
    ],
  ],
  Monk: [
    [
      'Hacking Proficiency',
      'Technology proficiency; advantage on Technology checks to hack computer systems.',
    ],
    [
      'Jam Systems',
      'Within melee range of advanced technology, make an attack and a Technology check with a situational GM DC to disrupt it.',
    ],
    [
      'Mechanical Learning',
      'Cybernetic interfaces can access information at appropriate terminals; GM resolves available data.',
    ],
    [
      'Monk-Warlock Synergy',
      'Within melee range of a Warlock, grant each other +1d6 to a check or save, once per long rest each.',
    ],
  ],
  Paladin: [
    [
      'Heavy Gunner Training',
      'Proficient with Heavy Firearms and Power Armor. Paladin progression is retained as the 5E fallback.',
    ],
  ],
  Ranger: [
    ['Firearm Mastery', 'Double proficiency on attacks with snipers, SMGs and pistols.'],
    ['Sniper Chain', 'A sniper kill refunds its attack action; reloading still costs actions.'],
  ],
  Rogue: [['Suppressor Proficiency', 'Ignore suppressor damage and range penalties.']],
  Sorcerer: [
    [
      'Psionic Amplification',
      'While in melee range of another Psion, both gain +1d6 to all rolls. Apply only while the condition holds.',
    ],
  ],
  Warlock: [
    [
      'Monk-Warlock Synergy',
      'Within melee range of a Monk, grant each other +1d6 to a check or save, once per long rest each.',
    ],
  ],
  Wizard: [
    [
      'Alien Expert',
      'Advantage on History or Investigation checks to understand, find or interact with alien artifacts.',
    ],
  ],
};
function canonical(core: CharacterCore): CharacterCore {
  return {
    ...core,
    race: RACES[core.race ?? ''] ?? core.race,
    class: CLASSES[core.class ?? ''] ?? core.class,
  };
}
function features(core: CharacterCore): CharacterCore {
  const abilities = [...core.abilities];
  for (const [name, description] of FEATURES[canonical(core).class ?? ''] ?? []) {
    const id = `dnds-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    if (!abilities.some((a) => a.id === id)) {
      const ability: CharacterAbility = {
        id,
        name,
        description,
        kind: 'D&DS feature',
        spellLevel: null,
        usesMax: name === 'Monk-Warlock Synergy' ? 1 : null,
      };
      if (ability.usesMax !== null) ability.recharge = 'long-rest';
      abilities.push(ability);
    }
  }
  return { ...core, abilities };
}
export function makeDndsRules(base: CharacterRuleset): CharacterRuleset {
  const plain = makePlain5eRules(base);
  return {
    ...plain,
    extraProficiencies: {
      names: ['Piloting', 'Driving', 'Heavy Firearms', 'Power Armors'],
      current: (core) =>
        Array.isArray(core['dndsProficiencies']) ? (core['dndsProficiencies'] as string[]) : [],
      set: (core, names) => ({ ...core, dndsProficiencies: [...names] }),
    },
    validate: (core) => {
      for (const item of core.inventory) {
        if (item['weapon']) {
          const w = weaponSchema.parse(item['weapon']);
          if (w.longRange < w.range)
            throw new Error('Maximum weapon range must be at least normal range.');
          const charges = item['chargesRemaining'];
          if (
            charges !== undefined &&
            (typeof charges !== 'number' ||
              !Number.isSafeInteger(charges) ||
              charges < 0 ||
              charges > w.reload)
          )
            throw new Error('Firing actions remaining must be within reload capacity.');
          if (w.heavy && item['suppressed'] === true)
            throw new Error('Heavy weapons cannot be suppressed.');
        }
        if (item['armor']) {
          const a = item['armor'] as { ac: number; dexCap: number | null };
          if (
            !Number.isSafeInteger(a.ac) ||
            a.ac < 0 ||
            (a.dexCap !== null && (!Number.isSafeInteger(a.dexCap) || a.dexCap < 0))
          )
            throw new Error('Armor AC and Dexterity cap must be nonnegative whole numbers.');
        }
      }
    },
    armorSummary: (core, rules) => {
      const armor = core.inventory.filter((e) => e.equipped && e['armor']);
      if (armor.length > 1) return 'Multiple armors equipped; select one armor to calculate AC.';
      if (!armor.length)
        return `Unarmored AC ${10 + rules.abilityModifier(core.scores.dex)} (class exceptions remain manual).`;
      const item = armor[0],
        a = item['armor'] as { ac: number; dexCap: number | null; resistances: string[] };
      return `${item.name}: AC ${a.ac + (a.dexCap === 0 ? 0 : Math.min(rules.abilityModifier(core.scores.dex), a.dexCap ?? Infinity))}; resistance: ${a.resistances.join(', ')}.`;
    },
    weaponAttack: (core, id, input, rules) => attackDnds(core, rules, id, input),
    reloadWeapon: reloadDnds,
    creator: {
      races: Object.keys(RACES),
      classes: plain.creator.classes
        .map((c) =>
          c === 'Cleric' ? 'Battle Medic (Cleric)' : c === 'Paladin' ? 'Heavy Gunner (Paladin)' : c,
        )
        .concat('Artificer'),
      classDescriptions: {
        Artificer:
          'd8 HP, Intelligence/Constitution saves; technology features are defined here, advanced progression is recorded manually.',
      },
    },
    skills: base.skills.map((s) =>
      s.id === 'arcana' ? { ...s, id: 'technology', name: 'Technology' } : s,
    ),
    initialize: (core) => {
      const c = canonical(core);
      let next =
        c.class === 'Artificer'
          ? {
              ...c,
              hpMax: Math.max(1, 8 + base.abilityModifier(c.scores.con)),
              saves: {
                ...c.saves,
                int: { ...c.saves.int, proficient: true },
                con: { ...c.saves.con, proficient: true },
              },
            }
          : plain.initialize!(c);
      if (c.class === 'Artificer') {
        const racial = plain.initialize!({ ...c, class: null });
        next = {
          ...racial,
          hpMax:
            Math.max(1, 8 + base.abilityModifier(racial.scores.con)) +
            (c.race === 'Hill Dwarf' ? 1 : 0),
          saves: next.saves,
        };
      }
      if (core.race === 'Drukhari (Drow)')
        next = {
          ...next,
          scores: { ...next.scores, int: next.scores.int - 1, cha: next.scores.cha + 1 },
        };
      if (c.class === 'Monk')
        next = {
          ...next,
          skills: { ...next.skills, technology: { proficiency: 'proficient', bonus: 0 } },
        };
      next = {
        ...next,
        race: core.race,
        class: core.class,
        dndsProficiencies:
          c.class === 'Paladin'
            ? ['Heavy Firearms', 'Power Armors']
            : c.class === 'Cleric'
              ? ['Power Armors']
              : [],
      };
      return features(next);
    },
    advance: (core) => {
      const next = plain.advance!(canonical(core));
      return features({ ...next, race: core.race, class: core.class });
    },
    hitDie: (core) => (canonical(core).class === 'Artificer' ? 8 : plain.hitDie!(canonical(core))),
    hpPerLevelBonus: (core) => plain.hpPerLevelBonus!(canonical(core)),
    statPoints: (core, level) => plain.statPoints!(canonical(core), level),
    skillBonus: (core, skill, rules) => plain.skillBonus(canonical(core), skill, rules),
    initiative: (core, rules) => plain.initiative(canonical(core), rules),
    levelUpPrompts: (core, level) => [
      ...plain.levelUpPrompts(canonical(core), level),
      'Keep conditional D&DS features and subclass choices consistent with the reference.',
    ],
    characterNotes: (core) => [
      'D&DS: level cap 20; 2014 5E progression and rests. Technology replaces Arcana.',
      'Piloting, Driving, Heavy Firearms and Power Armors are additional proficiencies; ship combat is PDF-only.',
      'Race mechanics use listed 5E counterparts. Omnics use a Human foundation; Orak-Hai use Half-Orc. Drukhari use Drow ability bonuses; their conditional racial traits remain reference-based.',
      ...(core.class === 'Artificer'
        ? [
            'Artificer: d8 HP and Intelligence/Constitution saves. Detailed subclass/infusion progression is manual.',
          ]
        : []),
      ...(Array.isArray(core['dndsProficiencies'])
        ? [`Extra proficiencies: ${core['dndsProficiencies'].join(', ') || 'none selected'}.`]
        : []),
      'Spells represent psionics, medical technology, cybernetics or alien artifacts. Contextual bonuses are adjudicated using feature text.',
    ],
  };
}
