import { BASE_5E_RULES } from '../characters/character-ruleset';
import { describe, it, expect } from 'vitest';
import { createCore, CharacterCore, STATS } from '../characters/character-core';
import {
  addEffect,
  activeConditions,
  advanceRadsTime,
  endRadsEffect,
  resolveRadsRoll,
  rollRadsCheck,
  radsState,
  withRads,
  consumeAction,
  convertCurrency,
  resolveIncomingDamage,
  RadsModifier,
} from './rads-engine';
import {
  initializeRads,
  upgradeRads,
  radsSpeed,
  radsArmorClass,
  grantRadsFeat,
  makeRadsRules,
} from './rads-rules';
import { activateRadsAbility } from './rads-abilities';
import { RADS_FEATURES } from './rads-definitions';
import {
  consumeRadsItem,
  changeRadsHP,
  resolveRadsConsequence,
  takeRadsDamage,
  finishRadsRest,
} from './rads-items';
import { RADS_CONSUMABLES } from './rads-consumables';
import { catalogInventory } from './system-catalog';
import { RADS_CATALOG } from './rads-catalog';
function psycho(level = 12): CharacterCore {
  return {
    ...initializeRads({
      ...createCore(),
      class: 'Psycho',
      level,
      scores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 14 },
    }),
    tolerance: 100,
  };
}
function activate(core: CharacterCore, name: string) {
  return activateRadsAbility(core, RADS_FEATURES.find((f) => f.name === name)!.id);
}
function combat(core: CharacterCore) {
  const s = radsState(core);
  return withRads(core, { ...s, inCombat: true });
}
describe('501 Rads effect composition', () => {
  it('combines Meth, SuperSoldier, a drawback and Blinded without duplicating proficiency', () => {
    let c = activate(psycho(), 'Meth');
    c = activate(c, 'SuperSoldier');
    c = addEffect(c, {
      id: 'bad-trip',
      name: 'Bad trip',
      modifiers: [
        { scope: 'check', kind: 'disadvantage', stat: 'str' },
        { scope: 'attack', kind: 'flat', value: -1 },
      ],
    });
    const s = radsState(c);
    c = withRads(c, { ...s, conditions: ['Blinded'] });
    const result = resolveRadsRoll(c, { scope: 'attack', stat: 'str', family: 'melee' }, 1);
    expect(result.modifier).toBe(9); // STR3 + PB4 + Psycho1 + Meth2 - drawback1.
    expect(result.mode).toBe('normal'); // SuperSoldier advantage cancels Blinded.
    expect(radsSpeed(c)).toBe(160); // 40 x Meth2 x SuperSoldier2.
    expect(resolveRadsRoll(c, { scope: 'check', stat: 'str' }).mode).toBe('disadvantage');
    expect(resolveRadsRoll(c, { scope: 'check', stat: 'int' }).mode).toBe('disadvantage');
  });
  it('ending a benefit removes its modifiers and starts its required unconscious phase', () => {
    let c = activate(psycho(), 'SuperSoldier');
    c = endRadsEffect(c, 'supersoldier');
    expect(radsSpeed(c)).toBe(0);
    expect(activeConditions(c)).toContain('Unconscious');
    expect(radsState(c).effects[0].expiresTurn).toBe(2);
    expect(() => consumeAction(combat(c), 'action')).toThrow('condition');
    c = advanceRadsTime(c, 12, true);
    c = advanceRadsTime(c, 0, true);
    expect(activeConditions(c)).not.toContain('Unconscious');
    expect(radsSpeed(c)).toBe(40);
  });
  it('same effects refresh duration without strengthening or stacking', () => {
    let c = addEffect(psycho(), {
      id: 'same',
      name: 'First application',
      modifiers: [{ scope: 'attack', kind: 'flat', value: 2 }],
      expiresTurn: 2,
    });
    c = addEffect(c, {
      id: 'same',
      name: 'Reapplication',
      modifiers: [{ scope: 'attack', kind: 'flat', value: 99 }],
      expiresTurn: 5,
    });
    expect(radsState(c).effects).toHaveLength(1);
    expect(radsState(c).effects[0].expiresTurn).toBe(5);
    expect(resolveRadsRoll(c, { scope: 'attack', stat: 'dex' }, 0).modifier).toBe(3);
  });
  for (let advantage = 0; advantage < 4; advantage++)
    for (let disadvantage = 0; disadvantage < 4; disadvantage++) {
      it(`resolves ${advantage} advantage sources and ${disadvantage} disadvantage sources`, () => {
        let c = psycho();
        for (let i = 0; i < advantage; i++)
          c = addEffect(c, {
            id: 'a' + i,
            name: 'a',
            modifiers: [{ scope: 'check', kind: 'advantage' }],
          });
        for (let i = 0; i < disadvantage; i++)
          c = addEffect(c, {
            id: 'd' + i,
            name: 'd',
            modifiers: [{ scope: 'check', kind: 'disadvantage' }],
          });
        expect(resolveRadsRoll(c, { scope: 'check', stat: 'cha' }).mode).toBe(
          !!advantage === !!disadvantage ? 'normal' : advantage ? 'advantage' : 'disadvantage',
        );
      });
    }
  it('does not turn natural ones/twenties into automatic ability-check failure/success', () => {
    expect(rollRadsCheck(psycho(), { scope: 'check', stat: 'cha' }, 0, 0, () => 1).total).toBe(3);
    expect(rollRadsCheck(psycho(), { scope: 'check', stat: 'cha' }, 0, 0, () => 20).total).toBe(22);
  });
  it('Blinded fails sight tasks, not unrelated reasoning; Deafened only fails hearing tasks', () => {
    const c = withRads(psycho(), { ...radsState(psycho()), conditions: ['Blinded', 'Deafened'] });
    expect(rollRadsCheck(c, { scope: 'check', stat: 'int' }, 0, 0, () => 10).total).not.toBeNull();
    expect(
      rollRadsCheck(c, { scope: 'check', stat: 'wis', tags: ['sight'] }, 0, 0, () => 20).total,
    ).toBeNull();
    expect(
      rollRadsCheck(c, { scope: 'check', stat: 'wis', tags: ['hearing'] }, 0, 0, () => 20).total,
    ).toBeNull();
  });
  it('Psycho passives modify ability checks, not saving throws or attack rolls', () => {
    const c = { ...psycho(), tolerance: 3 };
    expect(resolveRadsRoll(c, { scope: 'check', stat: 'str' }).modifier).toBe(9);
    expect(resolveRadsRoll(c, { scope: 'save', stat: 'str' }, 1).modifier).toBe(7);
    expect(
      resolveRadsRoll(c, { scope: 'check', stat: 'cha', skill: 'intimidation' }, 2).modifier,
    ).toBe(16);
  });
  it('SuperSoldier and UltraSoldier extra actions cannot buy skill actions or reactions', () => {
    let c = combat(activate(psycho(), 'UltraSoldier'));
    c = consumeAction(c, 'action');
    c = consumeAction(c, 'action');
    c = consumeAction(c, 'bonus');
    c = consumeAction(c, 'bonus');
    expect(radsState(c).actions.extra).toBe(0);
    c = consumeAction(c, 'skill');
    expect(() => consumeAction(c, 'skill')).toThrow('No skill');
    c = consumeAction(c, 'reaction');
    expect(() => consumeAction(c, 'reaction')).toThrow('No reaction');
  });
  it('first two class abilities are action-free even with no skill action or reaction remaining', () => {
    let c = combat(psycho());
    const s = radsState(c);
    c = withRads(c, { ...s, actions: { ...s.actions, skill: 0, reaction: 0 } });
    expect(() => activate(c, 'Ibuprofen')).not.toThrow();
    expect(() => activate(c, 'Cocaine')).not.toThrow();
    expect(() => activate(c, 'Meth')).toThrow('No skill');
  });
  it('distinct damage reductions compose; resistance and immunity never stack with themselves', () => {
    let c = psycho();
    c = addEffect(c, {
      id: 'medx',
      name: 'MedX',
      modifiers: [{ scope: 'incoming', kind: 'reduce', value: 2 }],
    });
    c = addEffect(c, {
      id: 'half',
      name: 'Half',
      modifiers: [{ scope: 'incoming', kind: 'multiply', value: 0.5 }],
    });
    c = addEffect(c, {
      id: 'rad1',
      name: 'Resist',
      modifiers: [{ scope: 'incoming', kind: 'resistance', damageType: 'Radiation' }],
    });
    c = addEffect(c, {
      id: 'rad2',
      name: 'Resist again',
      modifiers: [{ scope: 'incoming', kind: 'resistance', damageType: 'Radiation' }],
    });
    expect(resolveIncomingDamage(c, 23, 'Radiation')).toBe(5);
    expect(resolveIncomingDamage(c, 1, 'Radiation')).toBe(0);
    c = addEffect(c, {
      id: 'invulnerable',
      name: 'Immune',
      modifiers: [{ scope: 'incoming', kind: 'immunity' }],
    });
    expect(resolveIncomingDamage(c, 999, 'Radiation')).toBe(0);
  });
  it('a Psycho redose delays the crash, while an ordinary character receives the original crash', () => {
    const dose = (c: CharacterCore) =>
      addEffect(c, {
        id: 'dose',
        name: 'Dose',
        modifiers: [{ scope: 'check', kind: 'advantage', stat: 'int' }],
        expiresSecond: radsState(c).seconds + 10,
        after: [{ scope: 'check', kind: 'disadvantage', stat: 'str' }],
        afterSeconds: 20,
      });
    let p = dose(psycho()),
      g = dose({ ...psycho(), class: 'Gunslinger' });
    p = dose(advanceRadsTime(p, 5));
    g = dose(advanceRadsTime(g, 5));
    p = advanceRadsTime(p, 5);
    g = advanceRadsTime(g, 5);
    expect(radsState(p).effects.some((e) => e.id === 'dose:after')).toBe(false);
    expect(radsState(g).effects.some((e) => e.id === 'dose:after')).toBe(true);
    expect(radsState(g).effects.some((e) => e.id === 'dose')).toBe(true);
  });
  it('skipping past an entire timed benefit and drawback does not resurrect the drawback', () => {
    const c = addEffect(psycho(), {
      id: 'dose',
      name: 'Dose',
      modifiers: [],
      expiresSecond: 10,
      after: [{ scope: 'check', kind: 'disadvantage' }],
      afterSeconds: 10,
    });
    expect(radsState(advanceRadsTime(c, 100)).effects).toEqual([]);
  });
});
describe('Published class statistics and migration', () => {
  // Independent expected values from the class statistics table, not the engine definitions.
  for (const [name, die, speed, baseAC, primary] of [
    ['Gunslinger', 8, 35, 7, ['dex', 'cha']],
    ['Psycho', 12, 40, 9, ['str', 'cha']],
    ['Hacker', 6, 30, 6, ['dex', 'int']],
    ['Medic', 10, 30, 7, ['con', 'int']],
    ['Soldier', 12, 35, 8, ['str', 'wis']],
    ['Prophet', 8, 25, 7, ['dex', 'wis']],
  ] as const)
    it(name + ' uses its exact published base statistics', () => {
      const core = initializeRads({
        ...createCore(),
        class: name,
        scores: { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 },
      });
      expect(core.hpMax).toBe(die + 2);
      expect(core.speed.distance).toBe(speed);
      expect(radsArmorClass(core)).toBe(baseAC + 2);
      expect(
        STATS.filter((stat) => core.saves[stat.key].proficient)
          .map((stat) => stat.key)
          .sort(),
      ).toEqual([...primary].sort());
    });
  it('replaces legacy Gunslinger statistics exactly once and retains the old snapshot', () => {
    const legacy = {
      ...createCore(),
      class: 'Gunslinger',
      level: 4,
      hpMax: 99,
      speed: { distance: 30, unit: 'ft' as const, per: 'turn' as const },
      heat: 5,
      future: { keep: true },
    };
    const next = upgradeRads(legacy);
    expect(next.hpMax).toBe(23);
    expect(next.speed.distance).toBe(35);
    expect(next['heat']).toBe(5);
    expect(next['radsLegacy']).toMatchObject({ hpMax: 99 });
    expect(next['future']).toEqual({ keep: true });
    expect(upgradeRads(next)).toBe(next);
  });
  it('currency conversion is exact and never creates fractional denominations or a second fuel pool', () => {
    let c = psycho();
    c = withRads(c, { ...radsState(c), wallet: { dollars: 10000, chips: 0, fusionCells: 0 } });
    c = convertCurrency(c, 'dollars', 'fusionCells', 10000);
    expect(radsState(c).wallet).toEqual({ dollars: 0, chips: 0, fusionCells: 1 });
    expect(() => convertCurrency(c, 'dollars', 'chips', 1)).toThrow();
  });
});

describe('Required effect consequences and starting gear', () => {
  function drug(name: string, c = psycho()) {
    const item = catalogInventory(
      RADS_CONSUMABLES.find((i) => i.name === name)!,
      '501-rads',
    );
    return consumeRadsItem({ ...c, inventory: [item] }, item.id, () => 1).core;
  }
  it('an expired Overdrive cannot skip its damage by advancing a long interval', () => {
    let c = drug('Overdrive');
    c = advanceRadsTime(c, 3600);
    const pending = radsState(c).pending!;
    expect(pending).toHaveLength(1);
    expect(() => advanceRadsTime(c, 1)).toThrow('Resolve pending');
    expect(() => rollRadsCheck(c, { scope: 'check', stat: 'cha' })).toThrow('Resolve pending');
    const before = c.hpCurrent ?? c.hpMax!;
    const result = resolveRadsConsequence(c, pending[0].id, () => 2);
    expect(result.core.hpCurrent).toBe(before - 4);
    expect(radsState(result.core).pending).toEqual([]);
    expect(() => resolveRadsConsequence(result.core, pending[0].id, () => 6)).toThrow('already');
  });
  it('manually ending a benefit also queues its exact crash', () => {
    let c = drug('Nutrocorp Rejuvenation Serum');
    c = endRadsEffect(c, 'drug-nutrocorp-rejuvenation-serum');
    expect(radsState(c).pending).toMatchObject([
      { kind: 'damage', expression: '1d8', damageType: 'Radiation' },
    ]);
  });
  it('Psycho redosing delays a damaging crash; another class crashes at its original deadline', () => {
    const dose = (c: CharacterCore) =>
      addEffect(c, {
        id: 'overdrive',
        name: 'Overdrive',
        modifiers: [],
        expiresSecond: radsState(c).seconds + 18,
        afterEvents: [{ kind: 'damage', expression: '2d6' }],
      });
    let p = dose(psycho()),
      g = dose({ ...psycho(), class: 'Gunslinger' });
    p = dose(advanceRadsTime(p, 6));
    g = dose(advanceRadsTime(g, 6));
    expect(radsState(advanceRadsTime(p, 12)).pending).toEqual([]);
    expect(radsState(advanceRadsTime(g, 12)).pending).toHaveLength(1);
  });
  it('Burning queues damage once at the start of each own turn', () => {
    const c = withRads(psycho(), { ...radsState(psycho()), conditions: ['Burning'] });
    expect(radsState(advanceRadsTime(c, 6, true)).pending).toMatchObject([
      { expression: '1d6', damageType: 'Fire' },
    ]);
    expect(radsState(advanceRadsTime(c, 6)).pending).toEqual([]);
  });
  it('ending a super effect by game-time expiry removes its unspent extra actions', () => {
    const c = advanceRadsTime(combat(activate(psycho(), 'SuperSoldier')), 18);
    expect(radsState(c).actions.extra).toBe(0);
    expect(activeConditions(c)).toContain('Unconscious');
  });
  it('temporary HP absorbs mitigated damage and never heals real HP', () => {
    let c = psycho();
    c = withRads(c, { ...radsState(c), temporaryHP: 8 });
    c = addEffect(c, {
      id: 'medx',
      name: 'Med-X',
      modifiers: [{ scope: 'incoming', kind: 'reduce', value: 2 }],
    });
    c = takeRadsDamage(c, 7, 'Ballistic');
    expect(radsState(c).temporaryHP).toBe(3);
    expect(c.hpCurrent).toBe(c.hpMax);
    c = takeRadsDamage(c, 9, 'Ballistic');
    expect(radsState(c).temporaryHP).toBe(0);
    expect(c.hpCurrent).toBe(c.hpMax! - 4);
  });
  it('unconscious and stunned automatically fail Strength/Dexterity saves, not unrelated saves', () => {
    for (const condition of ['Unconscious', 'Stunned'] as const) {
      const c = withRads(psycho(), { ...radsState(psycho()), conditions: [condition] });
      expect(rollRadsCheck(c, { scope: 'save', stat: 'dex' }, 1, 0, () => 20).total).toBeNull();
      expect(rollRadsCheck(c, { scope: 'save', stat: 'wis' }, 0, 0, () => 10).total).not.toBeNull();
    }
  });
  it('starting gear enforces the class weapon, starts one wallet, and trades chips only for eligible classes', () => {
    const c = initializeRads({ ...createCore(), class: 'Psycho' });
    const rules = makeRadsRules(BASE_5E_RULES);
    const created = rules.completeCreation!(c, 'rads-rebar-shiv', 50, true);
    expect(radsState(created).wallet).toEqual({ dollars: 0, chips: 0, fusionCells: 0 });
    expect(created.inventory.some((i) => i['radsArmor'] === 1 && i.equipped)).toBe(true);
    expect(() => rules.completeCreation!(c, 'rads-pipe-popper-pistol', 50, false)).toThrow(
      'proficient Pipe',
    );
    expect(() =>
      rules.completeCreation!(
        initializeRads({ ...createCore(), class: 'Hacker' }),
        'rads-pipe-popper-pistol',
        50,
        true,
      ),
    ).toThrow('Only Psycho');
    expect(
      grantRadsFeat(c, 'Scholarly Training', ['history', 'hacking']).skills['hacking'].proficiency,
    ).toBe('proficient');
    expect(() => grantRadsFeat(c, 'Scholarly Training', ['history', 'history'])).toThrow();
  });
});

describe('Radiation choices and consumable timing', () => {
  function consume(name: string, core = psycho()) {
    const item = catalogInventory(
      RADS_CONSUMABLES.find((i) => i.name === name)!,
      '501-rads',
    );
    return consumeRadsItem({ ...core, inventory: [item] }, item.id, () => 1).core;
  }
  it('Rad Enthusiast saves both rolls before applying only the chosen result', () => {
    let c = psycho();
    c = {
      ...c,
      abilities: [
        ...c.abilities,
        {
          id: 'rad-feat',
          name: 'Rad Enthusiast',
          kind: 'feat',
          description: '',
          spellLevel: null,
          usesMax: null,
        },
      ],
    };
    c = consume('Nutrocorp Miracle Cure', c);
    const event = radsState(c).pending![0];
    let rolls = [3, 6];
    c = resolveRadsConsequence(c, event.id, () => rolls.shift()!).core;
    expect(radsState(c).pending![0].options).toEqual([3, 6]);
    expect(radsState(c).effects).toEqual([]);
    expect(() =>
      resolveRadsConsequence(
        c,
        event.id,
        () => {
          throw Error('Must not reroll');
        },
        9,
      ),
    ).toThrow('Choose one');
    c = resolveRadsConsequence(
      c,
      event.id,
      () => {
        throw Error('Must not reroll');
      },
      6,
    ).core;
    expect(radsState(c).effects.map((e) => e.id)).toEqual(['radiation-6']);
    expect(radsState(c).pending).toEqual([]);
  });
  it('Critical Mass applies its damage and queues a reroll that excludes 12', () => {
    let c = consume('Nutrocorp Miracle Cure');
    const event = radsState(c).pending![0];
    c = resolveRadsConsequence(c, event.id, (sides) => (sides === 12 ? 12 : 3)).core;
    expect(c.hpCurrent).toBe(c.hpMax! - 3);
    expect(radsState(c).pending![0].maximum).toBe(11);
  });
  it('experimental stimulant grants a standard Action on the next turn, not an extra Skill/Reaction', () => {
    let c = consume('Nutrocorp Experimental Stimulant');
    expect(radsState(c).pending).toHaveLength(2);
    for (const event of [...radsState(c).pending!])
      c = resolveRadsConsequence(c, event.id, () => 1).core;
    c = advanceRadsTime(c, 6, true);
    expect(radsState(c).actions.action).toBe(2);
    expect(radsState(c).actions.skill).toBe(1);
    expect(radsState(c).actions.reaction).toBe(1);
    c = advanceRadsTime(c, 6, true);
    expect(radsState(c).actions.action).toBe(1);
  });
  it('Canned Mystery Meat adds the short-rest die only once, or grants nonstacking long-rest temporary HP', () => {
    let c = consume('Canned Mystery Meat', { ...psycho(), hpCurrent: 1 });
    c = finishRadsRest(c, 'short', () => 4);
    expect(c.hpCurrent).toBe(5);
    c = finishRadsRest(c, 'short', () => 4);
    expect(c.hpCurrent).toBe(5);
    c = consume('Canned Mystery Meat', c);
    c = finishRadsRest(c, 'long');
    expect(radsState(c).temporaryHP).toBe(4);
  });
});

describe('Chemical immunity', () => {
  it('Psycho chemical immunity applies only to inhaled/ingested chemical or poison damage', () => {
    expect(resolveIncomingDamage(psycho(), 20, 'Chemical', ['inhaled'])).toBe(0);
    expect(resolveIncomingDamage(psycho(), 20, 'Chemical')).toBe(20);
    expect(resolveIncomingDamage(psycho(), 20, 'Radiation', ['ingested'])).toBe(20);
  });
});

describe('Source-specific effect boundaries', () => {
  it('OmegaMax aftermath records the glow without inventing a Stealth penalty', () => {
    const active = activate(psycho(), 'OmegaMax');
    const ended = endRadsEffect(active, 'omegamax');
    const aftermath = radsState(ended).effects[0];
    expect(aftermath.contextNote).toContain('Glow bright green');
    expect(aftermath.modifiers).toEqual([]);
    expect(aftermath.expiresSecond).toBe(120);
    expect(radsState(advanceRadsTime(ended, 120)).effects).toEqual([]);
  });
  it('pending consequences do not break sheet display totals while rolls remain blocked', () => {
    const c = withRads(psycho(), {
      ...radsState(psycho()),
      pending: [{ id: 'crash', source: 'Overdrive', kind: 'damage', expression: '2d6' }],
    });
    expect(() => resolveRadsRoll(c, { scope: 'check', stat: 'cha' })).not.toThrow();
    expect(() => rollRadsCheck(c, { scope: 'check', stat: 'cha' })).toThrow('Resolve pending');
  });
});

describe('Check display and roll parity', () => {
  it('uses the same resolved bonus and mode for stat checks, skills, saves and initiative', () => {
    const rules = makeRadsRules(BASE_5E_RULES);
    let c = psycho();
    c = addEffect(c, {
      id: 'mixed',
      name: 'Mixed',
      modifiers: [
        { scope: 'check', stat: 'int', kind: 'disadvantage' },
        { scope: 'check', stat: 'int', kind: 'flat', value: -2 },
        { scope: 'save', stat: 'wis', kind: 'advantage' },
        { scope: 'check', context: 'initiative', kind: 'advantage' },
      ],
    });
    c = withRads(c, { ...radsState(c), conditions: ['Restrained'] });
    for (const label of [
      'Intelligence check',
      'Hacking',
      'Dexterity saving throw',
      'Wisdom saving throw',
      'Initiative',
    ]) {
      const display = rules.checkSummary!(c, label, [])!,
        roll = rules.checkRoll!(c, label, 999, []);
      expect(display.mode).toBe(roll.mode);
      expect(display.modifier).toBe(roll.modifier);
      expect(display.automaticFailure).toBe(roll.automaticFailure);
    }
    expect(rules.checkSummary!(c, 'Dexterity saving throw', [])!.mode).toBe('disadvantage');
    expect(rules.checkSummary!(c, 'Wisdom saving throw', [])!.mode).toBe('advantage');
    expect(rules.checkSummary!(c, 'Initiative', [])!.mode).toBe('advantage');
  });
  it('respects declared circumstances and safely displays automatic failure without rolling', () => {
    const rules = makeRadsRules(BASE_5E_RULES);
    const c = withRads(psycho(), {
      ...radsState(psycho()),
      conditions: ['Blinded'],
      pending: [{ id: 'pending', source: 'Crash', kind: 'damage', expression: '2d6' }],
    });
    expect(rules.checkSummary!(c, 'Perception', ['sight'])!.automaticFailure).toBe(true);
    expect(rules.checkSummary!(c, 'Perception', [])!.automaticFailure).toBe(false);
  });
});
