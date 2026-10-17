export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type CharacterData = { [key: string]: JsonValue };

export interface GameSystem {
  id: string;
  slug: string;
  name: string;
  description: string;
  // Selects the future rules engine and visual theme; not the campaign's house rules.
  rulesetKey: string;
  themeKey: string;
  map?: { src: string; title: string; description: string };
}

export interface Campaign {
  id: string;
  ownerId: string;
  systemId: string;
  name: string;
  description: string;
}

export interface Character {
  id: string;
  ownerId: string;
  systemId: string;
  campaignId: string | null;
  name: string;
  // Version the payload independently of the shared ownership/campaign schema.
  dataVersion: number;
  data: CharacterData;
}

export interface CampaignMember {
  campaignId: string;
  userId: string;
}
