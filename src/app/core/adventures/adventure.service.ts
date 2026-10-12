import {
  CHARACTER_DATA_VERSION,
  CharacterCore,
  coreSchema,
  createCore,
} from '../characters/character-core';
import { inject, Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SUPABASE } from '../auth/supabase';
import { Profile } from '../profiles/profile.service';

export type CollectionKind = 'characters' | 'campaigns';
export interface SystemRow {
  ruleset_key?: string;
  id: string;
  name: string;
}
export interface CampaignRow {
  id: string;
  owner_id: string;
  system_id: string;
  name: string;
  description: string;
}
export interface CharacterRow {
  id: string;
  owner_id: string;
  system_id: string;
  campaign_id: string | null;
  name: string;
}
export interface AdventureContext {
  systems: SystemRow[];
  profiles: Profile[];
  campaigns: CampaignRow[];
  characters: CharacterRow[];
  memberCampaignIds: string[];
}

@Injectable({ providedIn: 'root' })
export class AdventureService {
  private readonly client = inject(SUPABASE);
  private readonly auth = inject(AuthService);
  private userId(): string {
    const id = this.auth.user()?.id;
    if (!id) throw new Error('Sign in to manage your adventures.');
    return id;
  }

  async load(kind: CollectionKind): Promise<AdventureContext> {
    const userId = this.userId();
    const [systems, profiles, campaigns, memberships, characters] = await Promise.all([
      this.client
        .from('systems')
        .select('id,name,ruleset_key')
        .order('name')
        .returns<SystemRow[]>(),
      this.client.from('profiles').select('id,username,display_name').returns<Profile[]>(),
      this.client
        .from('campaigns')
        .select('id,owner_id,system_id,name,description')
        .order('name')
        .returns<CampaignRow[]>(),
      this.client
        .from('campaign_members')
        .select('campaign_id')
        .eq('user_id', userId)
        .returns<{ campaign_id: string }[]>(),
      kind === 'characters'
        ? this.client
            .from('characters')
            .select('id,owner_id,system_id,campaign_id,name')
            .order('name')
            .returns<CharacterRow[]>()
        : Promise.resolve({ data: [] as CharacterRow[], error: null }),
    ]);
    if ([systems, profiles, campaigns, memberships, characters].some((result) => result.error)) {
      throw new Error('Could not load your adventures. Please retry.');
    }
    return {
      systems: systems.data ?? [],
      profiles: profiles.data ?? [],
      campaigns: campaigns.data ?? [],
      characters: characters.data ?? [],
      memberCampaignIds: (memberships.data ?? []).map((member) => member.campaign_id),
    };
  }

  async createCampaign(name: string, systemId: string, description: string): Promise<CampaignRow> {
    const { data, error } = await this.client
      .from('campaigns')
      .insert({
        owner_id: this.userId(),
        system_id: systemId,
        name: name.trim(),
        description: description.trim(),
      })
      .select('id,owner_id,system_id,name,description')
      .single<CampaignRow>();
    if (error) throw new Error('Could not create the campaign. Please retry.');
    return data;
  }

  async createCharacter(
    name: string,
    systemId: string,
    campaignId: string | null,
    core: CharacterCore = createCore(),
  ): Promise<CharacterRow> {
    const { data, error } = await this.client
      .from('characters')
      .insert({
        owner_id: this.userId(),
        system_id: systemId,
        campaign_id: campaignId,
        data: { core: coreSchema.parse(core) },
        data_version: CHARACTER_DATA_VERSION,
        name: name.trim(),
      })
      .select('id,owner_id,system_id,campaign_id,name')
      .single<CharacterRow>();
    if (error?.code === '23503')
      throw new Error(
        'That campaign is no longer available for this character. Refresh and choose again.',
      );
    if (error) throw new Error('Could not create the character. Please retry.');
    return data;
  }
}
