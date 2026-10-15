import type { StatKey } from '../characters/character-core';
import data from './rads-features.json';
export interface RadsClass {
  primary: [StatKey, StatKey];
  physical: StatKey;
  casting: StatKey;
  die: number;
  baseAC: number;
  acCap: number;
  speed: number;
  resource: string;
  storage: string;
  weapons: string[];
}
export const RADS_CLASSES: Record<string, RadsClass> = {
  Gunslinger: {
    casting: 'dex',
    primary: ['dex', 'cha'],
    physical: 'dex',
    die: 8,
    baseAC: 7,
    acCap: 18,
    speed: 35,
    resource: 'Heat',
    storage: 'heat',
    weapons: ['Sidearms', 'Melee Weapons'],
  },
  Psycho: {
    casting: 'str',
    primary: ['str', 'cha'],
    physical: 'str',
    die: 12,
    baseAC: 9,
    acCap: 20,
    speed: 40,
    resource: 'Tolerance',
    storage: 'tolerance',
    weapons: ['Melee Weapons'],
  },
  Hacker: {
    casting: 'int',
    primary: ['dex', 'int'],
    physical: 'dex',
    die: 6,
    baseAC: 6,
    acCap: 16,
    speed: 30,
    resource: 'Access',
    storage: 'access',
    weapons: ['Sidearms'],
  },
  Medic: {
    casting: 'int',
    primary: ['con', 'int'],
    physical: 'con',
    die: 10,
    baseAC: 7,
    acCap: 18,
    speed: 30,
    resource: 'Malpractice',
    storage: 'malpractice',
    weapons: ['Sidearms', 'Melee Weapons'],
  },
  Soldier: {
    casting: 'wis',
    primary: ['str', 'wis'],
    physical: 'str',
    die: 12,
    baseAC: 8,
    acCap: 20,
    speed: 35,
    resource: 'Authority',
    storage: 'authority',
    weapons: ['Sidearms', 'Long Guns', 'Heavy Weapons', 'Melee Weapons'],
  },
  Prophet: {
    casting: 'wis',
    primary: ['dex', 'wis'],
    physical: 'dex',
    die: 8,
    baseAC: 7,
    acCap: 16,
    speed: 25,
    resource: 'Faith',
    storage: 'faith',
    weapons: ['Long Guns', 'Melee Weapons'],
  },
};
export interface RadsFeature {
  id: string;
  class: string;
  level: number;
  name: string;
  description: string;
  cost: number | null;
  usesMax?: number | null;
}
export const RADS_FEATURES: readonly RadsFeature[] = data;
export const featDescriptions: Record<string, string> = {
  'Sidearm Training': 'Gain proficiency with Sidearms, including throwables.',
  'Long Gun Training': 'Gain proficiency with Long Guns.',
  'Heavy Weapons Training': 'Gain proficiency with Heavy Weapons.',
  'Melee Training': 'Gain proficiency with Melee Weapons.',
  'Athletic Training': 'Gain proficiency in Athletics and increase movement speed by 5 ft.',
  'Acrobatic Training':
    'Gain proficiency in Acrobatics; standing from prone costs only 5 ft of movement.',
  'Stealth Training': 'Gain proficiency in Stealth; gain +2 to Initiative rolls.',
  'Survival Training':
    'Gain proficiency in Survival; ordinary difficult terrain no longer slows movement.',
  'Medical Training':
    'Gain proficiency in Medicine; advantage on checks to treat ordinary injuries.',
  'Technical Training':
    'Gain proficiency in Hacking; advantage on checks to repair ordinary electronics.',
  'Investigative Training':
    'Gain proficiency in Investigation; advantage when searching a specific object or container.',
  'Diplomatic Training':
    'Gain proficiency in Persuasion; advantage when negotiating ordinary commercial transactions.',
  'Deception Training':
    'Gain proficiency in Deception; advantage when maintaining a prepared false identity.',
  'Intimidation Training':
    'Gain proficiency in Intimidation; advantage when interrogating an isolated, frightened target.',
  'Scholarly Training':
    'Choose History or Religion, then one additional Intelligence-based skill. Existing proficiency may become Expertise or another eligible proficiency may be chosen.',
  'Animal Training':
    'Gain proficiency in Animal Handling; ordinary domesticated animals are less likely to react aggressively.',
  Toughness: 'Increase maximum HP by 2 per level, including previous levels.',
  'Armor Familiarity': 'Increase the AC bonus provided by armor you wear by +1.',
  'Sharpshooter Training': 'Gain +1 accuracy with ranged weapon attacks.',
  'Close-Quarters Training': 'Gain +1 accuracy with melee attacks and unarmed strikes.',
  'Built Different':
    'Once per long rest, when damage would reduce you to 0 HP, remain at 1 HP instead.',
  'OSHA Violation':
    'Advantage on checks involving improvised machinery, dangerous tools and unsafe construction. Improvised melee weapons deal +2 damage.',
  Menace:
    'After successfully intimidating a creature, advantage on your next attack against it before the end of your next turn.',
  Coward:
    'When combat begins, you may immediately move half your speed away from a visible enemy before the first turn.',
  'Unlicensed Pharmacist':
    'When administering a drug or stimulant to another creature, increase one beneficial numerical effect by 50%, rounded up. Negative side effects also increase by 50% where applicable.',
  'Rad Enthusiast':
    'When a radioactive side effect would affect you, roll twice and choose a result.',
  'Union Representative':
    'Once per long rest, give a short speech to up to five allies. Each gains temporary HP equal to Charisma modifier + proficiency, minimum 1.',
  'Scrap Genius':
    'Given 10 minutes and suitable scrap, temporarily repair a broken ordinary mechanical device for one hour.',
  'Bad Influence':
    'After convincing someone to do something foolish through Deception/Persuasion, one witnessing ally gains advantage on their next Charisma check against that person.',
  'I Meant To Do That':
    'Once per long rest, turn an ability check failed by 3 or less into success with a minor inconvenient GM consequence.',
};
export const featSkill: Record<string, string> = {
  'Athletic Training': 'athletics',
  'Acrobatic Training': 'acrobatics',
  'Stealth Training': 'stealth',
  'Survival Training': 'survival',
  'Medical Training': 'medicine',
  'Technical Training': 'hacking',
  'Investigative Training': 'investigation',
  'Diplomatic Training': 'persuasion',
  'Deception Training': 'deception',
  'Intimidation Training': 'intimidation',
  'Animal Training': 'animal_handling',
};
export const featWeapon: Record<string, string> = {
  'Sidearm Training': 'Sidearms',
  'Long Gun Training': 'Long Guns',
  'Heavy Weapons Training': 'Heavy Weapons',
  'Melee Training': 'Melee Weapons',
};
