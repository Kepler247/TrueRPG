import type { AbilityChoices, AbilityChoice } from '../characters/character-ruleset';
import { STATS, StatKey } from '../characters/character-core';
import { applyMutationTreatment, mutationViews } from './rads-mutations';
import type { CharacterCore } from '../characters/character-core';
import { RADS_FEATURES } from './rads-definitions';
import {
  addEffect,
  consumeAction,
  radsState,
  RadsEffect,
  RadsModifier,
  withRads,
  activeEffects,
} from './rads-engine';
const adv = (
  scope: 'check' | 'save' | 'attack',
  stat?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha',
): RadsModifier => ({ scope, kind: 'advantage', ...(stat ? { stat } : {}) });
const dis = (
  scope: 'check' | 'save' | 'attack',
  stat?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha',
): RadsModifier => ({ ...adv(scope, stat), kind: 'disadvantage' });
export function classEffect(
  name: string,
  core: CharacterCore,
  choices: AbilityChoices = {},
): RadsEffect | null {
  const s = radsState(core),
    base = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      modifiers: [] as RadsModifier[],
    };
  const turn = (n: number, m: RadsModifier[], extra: Partial<RadsEffect> = {}) => ({
    ...base,
    modifiers: m,
    expiresTurn: s.turn + n,
    ...extra,
  });
  const sec = (n: number, m: RadsModifier[], extra: Partial<RadsEffect> = {}) => ({
    ...base,
    modifiers: m,
    expiresSecond: s.seconds + n,
    ...extra,
  });
  switch (name) {
    case 'Fan the Hammer':
      return {
        ...base,
        modifiers: [
          { scope: 'damage', family: 'pistol', kind: 'multiply', value: 3 },
          { scope: 'damage', family: 'revolver', kind: 'multiply', value: 3 },
        ],
        consumeOnAttack: ['pistol', 'revolver'],
        contextNote: 'Announced for your next pistol attack. Consumed even if it misses.',
      };
    case 'Wild Plan':
      return {
        ...base,
        modifiers: [{ scope: 'check', kind: 'advantage', context: 'wild-plan' }],
        contextNote:
          'Only checks following or advancing the declared plan. GM confirms allies follow the same plan.',
      };
    case 'Heroin':
      return turn(1, [{ scope: 'incoming', kind: 'multiply', value: 0.5 }, dis('check', 'dex')]);
    case 'Meth':
      return turn(3, [
        { scope: 'speed', kind: 'multiply', value: 2 },
        { scope: 'attack', family: 'melee', kind: 'flat', value: 2 },
        dis('check', 'int'),
      ]);
    case 'IntelliBoostPro':
      return sec(300, [adv('check', 'int'), dis('check', 'str')], {
        after: [adv('check', 'str'), dis('check', 'int')],
        afterSeconds: 300,
      });
    case 'Bromo-Dragonfly':
      return sec(180, [], {
        contextNote:
          'See weak points and valuables. Taking damage turns the trip evil: attack nearest target every 15 seconds; GM resolves targets.',
      });
    case 'DMT':
      return sec(
        1800,
        [
          { ...dis('check'), context: 'sight' },
          { ...dis('attack'), context: 'sight' },
        ],
        {
          contextNote: 'See emotions and detect lies. Normal-vision checks have disadvantage.',
        },
      );
    case 'SuperSoldier':
      return turn(3, [{ scope: 'speed', kind: 'multiply', value: 2 }, adv('attack')], {
        after: [],
        afterConditions: ['Unconscious'],
        afterTurns: 2,
      });
    case 'UltraSoldier':
      return turn(
        3,
        [
          { scope: 'speed', kind: 'multiply', value: 3 },
          adv('attack'),
          { scope: 'damage', kind: 'flat', value: 4 },
        ],
        { after: [], afterConditions: ['Unconscious'], afterTurns: 3 },
      );
    case 'OmegaMax':
      return sec(1200, [], {
        contextNote: 'Camouflage only while still. Afterward glow bright green for 2 minutes.',
        afterNote: 'Glow bright green for 2 minutes.',
        afterSeconds: 120,
      });
    case 'Jericho':
      return sec(
        180,
        [
          { ...adv('attack'), context: 'obsessed-target' },
          { ...adv('check'), context: 'obsessed-target' },
          { scope: 'damage', kind: 'multiply', value: 2, context: 'obsessed-target' },
        ],
        {
          contextNote:
            'Only actions that harm the chosen target are permitted. GM confirms the target; end when it dies.',
        },
      );
    case 'Wrecking Ball':
      return sec(180, [], {
        contextNote:
          'Run through reasonably thin objects; collision damage and pushing are GM-decided.',
      });
    case 'UltraCocaMethMorphine':
      return sec(180, [{ scope: 'incoming', kind: 'immunity' }], {
        contextNote: 'Invincible and immortal for 3 minutes.',
      });
    case 'Performance Enhancing Drugs':
      return turn(
        3,
        [
          { scope: 'attack', kind: 'flat', value: 2 },
          { scope: 'speed', kind: 'multiply', value: 2 },
        ],
        { after: [dis('check', 'dex'), dis('check', 'str')], afterTurns: 3 },
      );
    case 'Hold the Line':
      return turn(
        3,
        [
          { ...adv('save'), context: 'defensive' },
          { scope: 'incoming', kind: 'multiply', value: 0.5, context: 'ranged' },
        ],
        { contextNote: 'Only while remaining in the designated defensive position.' },
      );
    case 'Judgment Day':
      return turn(
        3,
        [
          { ...adv('attack'), context: 'judged-target', family: 'ranged' },
          {
            scope: 'damage',
            kind: 'multiply',
            value: 2,
            context: 'judged-target',
            family: 'ranged',
          },
        ],
        { contextNote: 'Ignore ordinary cover against the designated target. End when it dies.' },
      );
    case 'Distraction':
      return turn(
        1,
        [
          { ...adv('attack'), context: 'distracted-target' },
          { ...adv('check'), context: 'distracted-target' },
        ],
        {
          contextNote:
            'Against the eligible distracted target for the rest of this turn; pistol attacks are guaranteed hits. GM confirms eligibility and no previous Distraction on that target. End after the turn.',
        },
      );
    case 'Backdoor':
    case 'Identity Theft':
      return sec(86400, [], {
        contextNote:
          'Only the accessed system/identity described by this ability. Backdoor maintains one connection at a time.',
      });
    case 'Ghost in the Machine':
      return sec(300, [], {
        contextNote: 'GM resolves control of the eligible electronic device.',
      });
    case 'System Override':
      return sec(180, [], {
        contextNote:
          'Control applies to the specified connected local network; GM resolves commands.',
      });
    case 'Root Access':
      return sec(600, [], {
        contextNote:
          'Near-absolute control of the chosen accessible system, within its physical capabilities. GM adjudicates extraordinary commands.',
      });
    case 'Questionable Prescription': {
      const benefit = choices['benefit'],
        drawback = choices['drawback'];
      if (
        !STATS.some((s) => s.key === benefit) ||
        !STATS.some((s) => s.key === drawback) ||
        benefit === drawback
      )
        throw new Error(
          'Choose two different ability scores for the self-administered prescription.',
        );
      return sec(600, [adv('check', benefit as StatKey), dis('check', drawback as StatKey)], {
        contextNote:
          'Self-administered prescription. Received doses from another Medic remain GM-resolved to preserve the secret choices.',
      });
    }
    case 'Unlicensed Experimentation': {
      const adaptation = ADAPTATIONS.find((a) => a.id === choices['adaptation']);
      if (!adaptation) throw new Error('Choose a published biological adaptation.');
      return sec(1800, [], {
        contextNote: adaptation.name + '.',
        afterNote:
          'A harmless but conspicuous biological side effect occurs; the GM determines it and when it ends.',
      });
    }
    case 'Command Presence':
      return sec(300, [{ ...adv('check', 'cha'), context: 'command-audience' }], {
        contextNote:
          'Only checks organizing, directing or negotiating with the addressed group. Hostile resistance remains GM-resolved.',
      });
    case 'Coordinated Assault':
      return turn(1, [{ ...adv('attack'), context: 'coordinated-assault' }], {
        contextNote:
          'One immediate coordinated attack, once per participant per round. End after your granted attack; other participants record their own effects.',
      });
    case 'Follow My Lead':
      return s.inCombat
        ? turn(3, [], {
            contextNote:
              'The designated ally gains advantage on the next similar task after your successful STR/WIS check. Ally and GM resolve the trigger.',
          })
        : sec(300, [], {
            contextNote:
              'The designated ally gains advantage on the next similar task after your successful STR/WIS check.',
          });
    case 'Chain of Command':
      return sec(600, [], {
        contextNote:
          'The selected eligible group treats you as its superior officer until contradicted by convincing evidence.',
      });
    case 'Tactical Genius':
      return sec(3600, [{ ...adv('check'), context: 'tactical-plan' }], {
        contextNote:
          'Only checks directly carrying out the declared steps while the plan remains applicable.',
      });
    case 'Supreme Commander':
      return sec(600, [{ ...adv('check'), context: 'ordered-objective' }], {
        contextNote:
          'For willing participants pursuing the order: ignore ordinary fear and intimidation. GM confirms applicable tasks and extraordinary coordinated sequences.',
      });
    case 'Mark of the Heretic':
      return sec(600, [{ ...adv('attack'), context: 'heretic-target' }], {
        contextNote:
          'Advantage only on the first attack against the marked creature; manually End that advantage after use. Direction guidance lasts the full duration. Only one creature may be marked.',
      });
    case 'Blessed Ammunition':
      return sec(3600, [], {
        contextNote:
          'Up to three blessed rounds: ignore ordinary cover penalties and count as extraordinary/sanctified. Track spent rounds manually; unused blessings expire after one hour.',
      });
    case 'Street Preacher':
      return sec(600, [{ ...adv('check', 'cha'), context: 'sermon-audience' }], {
        contextNote:
          'After one minute of preaching: persuasion, intimidation or inspiration of the audience. GM resolves hostile resistance.',
      });
    case 'Divine Retribution':
      return {
        ...base,
        modifiers: [
          {
            scope: 'damage',
            family: 'ranged',
            kind: 'multiply',
            value: 2,
            context: 'retribution-target',
          },
        ],
        contextNote:
          'One immediate ranged attack against the creature that harmed your ally. Once per round. End after resolving the attack, even on a miss.',
      };
    case 'Thou Shalt Not Miss':
      return {
        ...base,
        modifiers: [{ scope: 'damage', family: 'ranged', kind: 'multiply', value: 3 }],
        contextNote:
          'The single declared ranged attack automatically hits subject to the source eligibility and extraordinary defenses. End after resolving it.',
      };
    case 'Prophet of the Wasteland':
      return sec(86400, [{ ...adv('check'), context: 'prophecy-event' }], {
        contextNote: 'Only checks directly bringing about or preventing the declared event.',
      });
    case 'And God Said, Let There Be Lead':
      return {
        ...base,
        modifiers: [{ scope: 'damage', family: 'ranged', kind: 'multiply', value: 3 }],
        afterNote:
          'Spend your next turn reloading, praying or otherwise recovering. End this reminder after that turn.',
        contextNote:
          'One ranged attack against each of up to six eligible creatures: automatic hits, triple damage. End this effect after the volley; the required recovery reminder then begins.',
      };
    default:
      return null;
  }
}
export function activateRadsAbility(
  core: CharacterCore,
  id: string,
  choices: AbilityChoices = {},
): CharacterCore {
  const f = RADS_FEATURES.find(
    (f) => f.id === id && f.class === core.class && f.level <= core.level,
  );
  if (!f || f.cost === null) throw new Error('This is not an unlocked active class ability.');
  if (!core.abilities.some((a) => a.id === id))
    throw new Error('The class ability is missing from this sheet.');
  const key = (
    {
      Gunslinger: 'heat',
      Psycho: 'tolerance',
      Hacker: 'access',
      Medic: 'malpractice',
      Soldier: 'authority',
      Prophet: 'faith',
    } as Record<string, string>
  )[core.class ?? ''];
  const points = Number(core[key] ?? 0);
  if (points < f.cost) throw new Error('Not enough class resource.');
  const free = f.level === 1 && (f.cost === 1 || f.cost === 3);
  let next = consumeAction(core, f.name === 'Divine Retribution' ? 'reaction' : 'skill', free);
  const uses = next.abilityUses?.[id] ?? 0;
  if (f.usesMax && uses >= f.usesMax) throw new Error('No uses remain before a long rest.');
  next = { ...next, [key]: points - f.cost, abilityUses: { ...next.abilityUses, [id]: uses + 1 } };
  if (free) return next;
  if (['Divine Retribution', 'Coordinated Assault'].includes(f.name)) {
    const state = radsState(next),
      round = Math.floor(state.seconds / 6),
      last = (state['abilityRounds'] ?? {}) as Record<string, number>;
    if (last[id] === round) throw new Error(f.name + ' may be used only once per round.');
    next = withRads(next, { ...state, abilityRounds: { ...last, [id]: round } });
  }
  if (MEDIC_RECIPIENT_ABILITIES.includes(f.name) && choices['recipient'] === 'other') {
    return addEffect(next, {
      id: 'context:' + f.id,
      name: f.name + ' (other recipient)',
      modifiers: [],
      contextNote:
        f.description +
        ' GM resolves the recipient effect. Record any public treatment on the recipient sheet separately. Received Questionable Prescription choices stay secret with the GM.',
    });
  }
  if (f.name === 'Organ Donation' && choices['mutation'] === 'other-characteristic') {
    const state = radsState(next);
    return addEffect(next, {
      id: 'organ-donation-characteristic',
      name: 'Organ Donation: natural characteristic',
      modifiers: [],
      expiresSecond: state.seconds + 600,
      contextNote:
        'GM confirms an eligible sense or natural adaptation. Donor loses it and recipient gains it for 10 minutes. Recipient cannot already possess it; record the recipient separately.',
    });
  }
  if (['Mutational Medicine', 'Experimental Evolution', 'Organ Donation'].includes(f.name)) {
    return applyMutationTreatment(
      next,
      choices['mutation'] ?? '',
      f.name === 'Mutational Medicine'
        ? 'suppress'
        : f.name === 'Experimental Evolution'
          ? 'amplify'
          : 'donate',
    );
  }
  if (f.name === 'Mark of the Heretic') {
    const state = radsState(next);
    next = addEffect(next, {
      id: 'heretic-guidance',
      name: 'Mark of the Heretic: direction',
      modifiers: [],
      expiresSecond: state.seconds + 600,
      contextNote:
        "Know the marked creature's approximate direction within 300 ft for 10 minutes. The first-attack advantage is tracked on its separate card.",
    });
  }
  const mechanical = classEffect(f.name, next, choices);
  const effect = mechanical ?? {
    id: 'context:' + f.id,
    name: f.name,
    modifiers: [],
    contextNote:
      f.description +
      ' Resolve target, saves and situational outcomes with the GM; this entry does not apply an undefined numerical bonus.',
  };
  if (effect) {
    const old = activeEffects(next).some((e) => e.id === effect.id);
    next = addEffect(next, effect);
    if (!old && (f.name === 'SuperSoldier' || f.name === 'UltraSoldier')) {
      const state = radsState(next);
      next = withRads(next, {
        ...state,
        actions: {
          ...state.actions,
          extra: state.actions.extra + (f.name === 'SuperSoldier' ? 1 : 2),
          extraSources: {
            ...state.actions.extraSources,
            [effect.id]: f.name === 'SuperSoldier' ? 1 : 2,
          },
        },
      });
    }
  }
  return next;
}

const ADAPTATIONS = [
  { id: 'underwater', name: 'Breathe underwater' },
  { id: 'temperature', name: 'Immunity to ordinary environmental temperatures' },
  { id: 'night-vision', name: 'Enhanced night vision' },
  { id: 'no-breath', name: 'Survive without breathing' },
];
const MEDIC_RECIPIENT_ABILITIES = [
  'Questionable Prescription',
  'Performance Enhancing Drugs',
  'Unlicensed Experimentation',
  'Mutational Medicine',
  'Experimental Evolution',
  'Organ Donation',
];
export function radsAbilityChoices(
  core: CharacterCore,
  id: string,
  choices: AbilityChoices = {},
): readonly AbilityChoice[] {
  const f = RADS_FEATURES.find((f) => f.id === id);
  if (!f) return [];
  const recipient: AbilityChoice[] = MEDIC_RECIPIENT_ABILITIES.includes(f.name)
    ? [
        {
          key: 'recipient',
          label: 'Recipient / procedure',
          options: [
            { id: 'self', name: 'Self (Organ Donation: I am the donor)' },
            { id: 'other', name: 'Other character: GM resolves and recipient records' },
          ],
        },
      ]
    : [];
  if (choices['recipient'] === 'other') return recipient;
  if (f.name === 'Questionable Prescription')
    return [
      ...recipient,
      {
        key: 'benefit',
        label: 'Self dose: advantage on',
        options: STATS.map((s) => ({ id: s.key, name: s.name })),
      },
      {
        key: 'drawback',
        label: 'Self dose: disadvantage on a different stat',
        options: STATS.map((s) => ({ id: s.key, name: s.name })),
      },
    ];
  if (f.name === 'Unlicensed Experimentation')
    return [...recipient, { key: 'adaptation', label: 'Self adaptation', options: ADAPTATIONS }];
  if (['Mutational Medicine', 'Experimental Evolution', 'Organ Donation'].includes(f.name))
    return [
      ...recipient,
      {
        key: 'mutation',
        label: 'Your mutation (activate after required preparation)',
        options: [
          ...mutationViews(core)
            .filter((m) =>
              f.name === 'Mutational Medicine'
                ? m.polarity === 'negative'
                : m.polarity === 'positive',
            )
            .map((m) => ({ id: m.id, name: m.name })),
          ...(f.name === 'Organ Donation'
            ? [
                {
                  id: 'other-characteristic',
                  name: 'Other natural sense / adaptation (GM resolves)',
                },
              ]
            : []),
        ],
      },
    ];
  return recipient;
}
