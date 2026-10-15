import triggers from './rads-resource-triggers.json';
import { RADS_CATALOG } from './rads-catalog';
import { catalogInventory } from './system-catalog';
import { changeRadsHP, consumeRadsItem, takeRadsDamage, finishRadsRest } from './rads-items';
import { radsWeaponReference, adjustRadsAmmo } from './rads-combat';
import { activateRadsAbility, radsAbilityChoices } from './rads-abilities';
import { rollRadsCheck } from './rads-engine';
import { rollWithModifier } from '../characters/dice';
import {
  CharacterCore,
  abilityModifier,
  STATS,
  BASE_SKILLS,
  StatKey,
} from '../characters/character-core';
import type { CharacterRuleset } from '../characters/character-ruleset';
import {
  RADS_CLASSES,
  RADS_FEATURES,
  featDescriptions,
  featSkill,
  featWeapon,
} from './rads-definitions';
import { RADS_MUTATION_RULES, validateMutations } from './rads-mutations';
import {
  advanceRadsTime,
  radsState,
  withRads,
  hasFeat,
  RADS_REVISION,
  resolveRadsRoll,
  activeEffects,
  activeConditions,
} from './rads-engine';
const cap = (level: number) => (level >= 11 ? null : 3 + 2 * Math.floor((level - 1) / 2));
const gain = (level: number) => (level >= 12 ? 3 : level >= 7 ? 2 : 1);
export function radsArmorClass(core: CharacterCore): number {
  const c = RADS_CLASSES[core.class ?? ''];
  if (!c) return 10 + abilityModifier(core.scores.dex);
  const armors = core.inventory.filter((i) => i.equipped && typeof i['radsArmor'] === 'number');
  const armor = armors.reduce((n, i) => Math.max(n, Number(i['radsArmor'])), 0);
  const flat = activeEffects(core)
    .flatMap((e) => e.modifiers)
    .filter((m) => m.scope === 'ac' && m.kind === 'flat')
    .reduce((n, m) => n + (m.value ?? 0), 0);
  return (
    Math.min(c.baseAC + abilityModifier(core.scores[c.physical]), c.acCap) +
    armor +
    (armor > 0 && hasFeat(core, 'Armor Familiarity') ? 1 : 0) +
    flat
  );
}
export function radsSpeed(core: CharacterCore): number {
  if (activeConditions(core).some((c) => ['Restrained', 'Stunned', 'Unconscious'].includes(c)))
    return 0;
  const modifiers = activeEffects(core)
    .flatMap((e) => e.modifiers)
    .filter((m) => m.scope === 'speed');
  let n =
    core.speed.distance +
    modifiers.filter((m) => m.kind === 'flat').reduce((n, m) => n + (m.value ?? 0), 0);
  for (const m of modifiers.filter((m) => m.kind === 'multiply')) n *= m.value ?? 1;
  return Math.max(0, n);
}
export function advanceRads(core: CharacterCore): CharacterCore {
  const c = RADS_CLASSES[core.class ?? ''];
  if (!c) return core;
  const features = RADS_FEATURES.filter((f) => f.class === core.class && f.level <= core.level);
  const old = core.abilities.filter(
    (a) => !a.id.startsWith('501-' + core.class!.toLowerCase() + '-'),
  );
  const abilities = [
    ...old,
    ...features.map((f) => ({
      id: f.id,
      name: f.name,
      kind: 'class feature',
      description: f.description,
      spellLevel: null,
      usesMax: f.usesMax ?? null,
      ...(f.usesMax ? { recharge: 'long-rest' as const } : {}),
    })),
  ];
  return {
    ...core,
    abilities,
    [c.storage]: Math.min(Number(core[c.storage] ?? 0), cap(core.level) ?? Infinity),
  };
}
export function initializeRads(core: CharacterCore): CharacterCore {
  const c = RADS_CLASSES[core.class ?? ''];
  if (!c) return core;
  let s = radsState(core);
  s = {
    ...s,
    weapons: Object.fromEntries(c.weapons.map((w) => [w, 'proficient' as const])),
    actions: { ...s.actions, movement: c.speed },
  };
  return advanceRads(
    withRads(
      {
        ...core,
        hpMax: Math.max(1, c.die + abilityModifier(core.scores.con)),
        speed: { distance: c.speed, unit: 'ft', per: 'turn' },
        saves: Object.fromEntries(
          STATS.map((stat) => [
            stat.key,
            { ...core.saves[stat.key], proficient: c.primary.includes(stat.key) },
          ]),
        ) as CharacterCore['saves'],
        [c.storage]: 0,
      },
      s,
    ),
  );
}
export function upgradeRads(core: CharacterCore): CharacterCore {
  // Remove only obsolete generated catalog guidance, preserving custom notes and saved fields.
  const inventory = core.inventory.map((entry) => {
    const description = entry.description
      .replace(/ Weight is not specified in the source; enter it if carrying weight is used\./g, '')
      .replace(/ Weight is not specified; enter it if carrying weight is used\./g, '')
      .replace(/ Weight is unspecified\./g, '');
    return description === entry.description ? entry : { ...entry, description };
  });
  if (inventory.some((entry, index) => entry !== core.inventory[index]))
    core = { ...core, inventory };

  if (core['rads'] !== undefined) {
    radsState(core);
    return core;
  }
  const c = RADS_CLASSES[core.class ?? ''];
  if (!c) return core;
  const old = {
    hpMax: core.hpMax,
    speed: core.speed,
    saves: core.saves,
    abilities: core.abilities,
  };
  const next = initializeRads({ ...core, level: core.level });
  const hp =
    Math.max(1, c.die + abilityModifier(core.scores.con)) +
    (core.level - 1) * Math.max(1, c.die / 2 + 1 + abilityModifier(core.scores.con)) +
    (hasFeat(core, 'Toughness') ? 2 * core.level : 0);
  return {
    ...next,
    hpMax: hp,
    ...(core.hpCurrent !== undefined ? { hpCurrent: Math.min(core.hpCurrent, hp) } : {}),
    hitDiceSpent: core.hitDiceSpent,
    heat: Math.min(Number(core['heat'] ?? 0), cap(core.level) ?? Infinity),
    radsLegacy: { revision: 'pre-core-1', ...old },
    radsUpgradeNote:
      'Updated to core-1. Historical HP rolls were unavailable; HP was rebuilt using the published fixed increases. Previous values are retained in radsLegacy.',
  };
}
export function grantRadsFeat(
  core: CharacterCore,
  name: string,
  choices: string[] = [],
): CharacterCore {
  if (!featDescriptions[name]) throw new Error('Choose a published 501 Rads feat.');
  if (core.abilities.filter((a) => a.kind === 'feat' && a.name === name).length > 1)
    throw new Error('A feat cannot be selected twice.');
  let next = { ...core, skills: { ...core.skills } };
  const s = radsState(core);
  const weapons = { ...s.weapons };
  const train = (id: string) => {
    const current = next.skills[id] ?? { proficiency: 'none' as const, bonus: 0 };
    next.skills[id] = {
      ...current,
      proficiency: current.proficiency === 'none' ? 'proficient' : 'expertise',
    };
  };
  if (featSkill[name]) train(featSkill[name]);
  if (featWeapon[name]) {
    const id = featWeapon[name];
    weapons[id] =
      weapons[id] === 'proficient' || weapons[id] === 'expertise' ? 'expertise' : 'proficient';
  }
  if (name === 'Scholarly Training') {
    if (
      choices.length !== 2 ||
      choices[0] === choices[1] ||
      !['history', 'religion'].includes(choices[0]) ||
      (!BASE_SKILLS.some((s) => s.stat === 'int' && s.id === choices[1]) &&
        choices[1] !== 'hacking')
    )
      throw new Error(
        'Scholarly Training needs History/Religion and a different Intelligence skill.',
      );
    choices.forEach(train);
  }
  if (name === 'Toughness' && next.hpMax !== null) next.hpMax += 2 * core.level;
  if (name === 'Athletic Training')
    next.speed = { ...next.speed, distance: next.speed.distance + 5 };
  if (name === 'Stealth Training') next.initiativeBonus += 2;
  return withRads(next, { ...s, weapons });
}
function radsCheckContext(core: CharacterCore, label: string, tags: string[]) {
  const skill = BASE_SKILLS.map((s) =>
    s.id === 'arcana' ? { ...s, id: 'hacking', name: 'Hacking' } : s,
  ).find((s) => s.name === label);
  const stat = STATS.find((s) => label.startsWith(s.name + ' '));
  const scope = label.endsWith('saving throw') ? ('save' as const) : ('check' as const);
  if (!skill && !stat && label !== 'Initiative') return null;
  const key = skill?.stat ?? stat?.key ?? 'dex';
  const training: 0 | 1 | 2 =
    scope === 'save'
      ? core.saves[key].proficient
        ? 1
        : 0
      : skill
        ? core.skills[skill.id]?.proficiency === 'expertise'
          ? 2
          : core.skills[skill.id]?.proficiency === 'proficient'
            ? 1
            : 0
        : 0;
  const bonus =
    scope === 'save'
      ? core.saves[key].bonus
      : skill
        ? (core.skills[skill.id]?.bonus ?? 0)
        : label === 'Initiative'
          ? core.initiativeBonus
          : 0;
  const inferred = [
    ...tags,
    ...(label === 'Initiative' ? ['initiative'] : []),
    ...(skill?.id === 'hacking'
      ? ['technical']
      : skill?.id === 'medicine'
        ? ['medical']
        : skill?.id === 'perception'
          ? ['observation']
          : []),
  ];
  return { context: { scope, stat: key, skill: skill?.id, tags: inferred }, training, bonus };
}

export function makeRadsRules(base: CharacterRuleset): CharacterRuleset {
  return {
    ...base,
    tracksCarryWeight: false,
    statusPanel: true,
    managedAbility: (a) =>
      a.id.startsWith('501-') || (a.kind === 'feat' && !!featDescriptions[a.name]),
    featChoices: (name) =>
      name === 'Scholarly Training'
        ? [
            {
              label: 'History or Religion',
              options: BASE_SKILLS.filter((s) => ['history', 'religion'].includes(s.id)),
            },
            {
              label: 'Different Intelligence skill',
              options: [
                ...BASE_SKILLS.filter((s) => s.stat === 'int' && s.id !== 'arcana'),
                { id: 'hacking', name: 'Hacking' },
              ],
            },
          ]
        : [],
    healthChange: changeRadsHP,
    takeDamage: takeRadsDamage,
    consumeItem: consumeRadsItem,
    weaponReference: radsWeaponReference,
    adjustWeaponAmmo: adjustRadsAmmo,
    useClassAbility: activateRadsAbility,
    abilityChoices: radsAbilityChoices,
    movementSpeed: radsSpeed,
    checkSummary: (core, label, tags) => {
      const check = radsCheckContext(core, label, tags);
      return check ? resolveRadsRoll(core, check.context, check.training, check.bonus) : null;
    },
    checkRoll: (core, label, modifier, tags, forcedSingle = false) => {
      const check = radsCheckContext(core, label, tags);
      if (!check) return rollWithModifier(label, modifier);
      const result = rollRadsCheck(
        core,
        check.context,
        check.training,
        check.bonus,
        undefined,
        forcedSingle,
      );
      return {
        label,
        sides: 20,
        die: result.die,
        modifier: result.modifier,
        total: result.total ?? 0,
        automaticFailure: result.automaticFailure,
        mode: result.mode,
        details: [
          `Dice: ${result.rolls.join(', ')} (${result.mode})`,
          ...result.lines.map(
            (l) =>
              `${l.source}: ${l.kind === 'flat' ? (l.value >= 0 ? '+' : '') + l.value : l.kind}`,
          ),
          result.automaticFailure
            ? 'Automatic failure: this task requires an unavailable sense.'
            : '',
        ]
          .filter(Boolean)
          .join(' / '),
      };
    },
    maxLevel: 12,
    maxScore: undefined,
    improvementMax: null,
    mutations: RADS_MUTATION_RULES,
    migrate: upgradeRads,
    rest: {
      shortHours: 1,
      longHours: 8,
      recoverHitDice: (level) => level,
      minimumHealing: 1,
      before: (core) => {
        if ((core.hpCurrent ?? core.hpMax) === 0)
          throw new Error('A dead character must reconstitute before resting.');
        if (
          radsState(core).pending?.length ||
          radsState(core).effects.some((e) => e.afterEvents?.length) ||
          activeConditions(core).includes('Burning')
        )
          throw new Error(
            'Advance game time and resolve damaging effects before completing a rest.',
          );
      },
      finish: finishRadsRest,
    },
    creator: {
      races: [],
      classes: Object.keys(RADS_CLASSES),
      startingWeapons: (name) =>
        RADS_CATALOG.filter(
          (e) =>
            e.radsWeapon?.tier === 'Pipe' &&
            RADS_CLASSES[name]?.weapons.includes(e.radsWeapon.category),
        ),
      armorAlternative: (name) => ['Psycho', 'Soldier'].includes(name),
      startingSkills: 4,
      primarySkills: 2,
      primaryStats: (name) => RADS_CLASSES[name]?.primary ?? [],
    },
    completeCreation: (core, weaponId, chips, armor) => {
      const c = RADS_CLASSES[core.class ?? ''],
        weapon = RADS_CATALOG.find((e) => e.id === weaponId);
      if (
        !c ||
        !weapon?.radsWeapon ||
        weapon.radsWeapon.tier !== 'Pipe' ||
        !c.weapons.includes(weapon.radsWeapon.category)
      )
        throw new Error('Choose a proficient Pipe-tier starting weapon.');
      if (!Number.isSafeInteger(chips) || chips < 20 || chips > 80 || chips % 10 !== 0)
        throw new Error('Starting chips must be 2d4 times 10.');
      if (armor && !['Psycho', 'Soldier'].includes(core.class ?? ''))
        throw new Error('Only Psycho/Soldier may exchange starting chips for armor.');
      const item = catalogInventory(weapon, '501-rads');
      item.equipped = true;
      const inventory = [...core.inventory, item];
      if (armor) {
        const a = catalogInventory(
          RADS_CATALOG.find((e) => e.radsArmor === 1)!,
          '501-rads',
        );
        a.equipped = true;
        inventory.push(a);
      }
      const s = radsState(core);
      return withRads(
        { ...core, inventory },
        { ...s, wallet: { ...s.wallet, chips: armor ? 0 : chips }, started: true },
      );
    },
    initialize: initializeRads,
    advance: advanceRads,
    applyFeat: grantRadsFeat,
    hitDie: (core) => RADS_CLASSES[core.class ?? '']?.die ?? null,
    hpPerLevelBonus: (core) => (hasFeat(core, 'Toughness') ? 2 : 0),
    statPoints: () => 2,
    featOnlyAtRequiredLevels: true,
    featRequired: (level) => level % 3 === 0,
    armorSummary: (core) => `Armor Class ${radsArmorClass(core)}; movement ${radsSpeed(core)} ft.`,
    classResource: (core) => {
      const c = RADS_CLASSES[core.class ?? ''];
      return c
        ? {
            id: c.storage,
            name: c.resource,
            current: (x) => Number(x[c.storage] ?? 0),
            setCurrent: (x, value) => ({ ...x, [c.storage]: value }),
            maximum: (x) => cap(x.level),
            gainMultiplier: (x) => gain(x.level),
            resetsOnLongRest: true,
            help:
              (triggers[core.class as keyof typeof triggers] ?? '') +
              ' Award distinct triggers after resolution, applying the level multiplier. No resource farming; GM decides meaningful actions.',
          }
        : null;
    },
    abilityActions: (core) =>
      RADS_FEATURES.filter(
        (f) => f.class === core.class && f.level <= core.level && f.cost !== null,
      ).map((f) => ({
        abilityId: f.id,
        cost: f.cost!,
        ...(f.level === 1 && f.cost === 1
          ? { rollMode: 'reroll' as const }
          : f.level === 1 && f.cost === 3
            ? { rollMode: 'choose-three' as const }
            : {}),
      })),
    skills: BASE_SKILLS.map((s) =>
      s.id === 'arcana' ? { ...s, id: 'hacking', name: 'Hacking' } : s,
    ),
    initiative: (core) =>
      resolveRadsRoll(
        core,
        { scope: 'check', stat: 'dex', tags: ['initiative'] },
        0,
        core.initiativeBonus,
      ).modifier,
    skillBonus: (core, skill, rules, tags = []) =>
      resolveRadsRoll(
        core,
        {
          scope: 'check',
          stat: skill.stat,
          skill: skill.id,
          tags: [
            ...tags,
            ...(skill.id === 'hacking'
              ? ['technical']
              : skill.id === 'medicine'
                ? ['medical']
                : skill.id === 'perception'
                  ? ['observation']
                  : []),
          ],
        },
        core.skills[skill.id]?.proficiency === 'expertise'
          ? 2
          : core.skills[skill.id]?.proficiency === 'proficient'
            ? 1
            : 0,
        core.skills[skill.id]?.bonus ?? 0,
      ).modifier,
    savingThrow: (core, stat, rules, tags = []) =>
      resolveRadsRoll(
        core,
        { scope: 'save', stat, tags },
        core.saves[stat].proficient ? 1 : 0,
        core.saves[stat].bonus,
      ).modifier,
    characterNotes: (core) => [
      '501 Rads core-1: six classes, maximum level 12. Four starting skills; two use class primary abilities.',
      'Long rests restore all spent Hit Dice. Short-rest Hit Dice restore at least 1 HP.',
      ...(RADS_CLASSES[core.class ?? '']
        ? [
            `Class ability save DC: ${8 + base.proficiencyBonus(core.level) + abilityModifier(core.scores[RADS_CLASSES[core.class!].casting])} (8 + proficiency + ${RADS_CLASSES[core.class!].casting.toUpperCase()}).`,
          ]
        : []),
      'Only listed active modifiers are automated. Resolve descriptive mutations, target effects and other situational rules using their full reference text.',
      ...(core['radsUpgradeNote'] ? [String(core['radsUpgradeNote'])] : []),
    ],
    levelUpPrompts: (core, level) => [
      'Allocate two stat points. Scores may exceed 20.',
      ...(level % 3 === 0 ? ['Choose one published shared feat. No duplicate feats.'] : []),
      ...RADS_FEATURES.filter((f) => f.class === core.class && f.level === level).map(
        (f) => `${f.name}: ${f.description}`,
      ),
    ],
    validate: (core) => {
      validateMutations(core);
      radsState(core);
      const c = RADS_CLASSES[core.class ?? ''];
      if (!c) throw new Error('Choose a 501 Rads class.');
      const n = core[c.storage] ?? 0;
      if (
        typeof n !== 'number' ||
        !Number.isSafeInteger(n) ||
        n < 0 ||
        (cap(core.level) !== null && n > cap(core.level)!)
      )
        throw new Error('Class resource is outside its permitted range.');
      const feats = core.abilities.filter((a) => a.kind === 'feat').map((a) => a.name);
      if (new Set(feats).size !== feats.length) throw new Error('Duplicate feats are not allowed.');
    },
  };
}
