import { inject, Injectable } from '@angular/core';
import { SUPABASE } from '../auth/supabase';
import { AuthService } from '../auth/auth.service';
import { CampaignRow } from '../adventures/adventure.service';
import { CharacterCore, readCore } from '../characters/character-core';
export interface CampaignMember {
  user_id: string;
  profiles: { username: string | null; display_name: string; avatar_path?: string | null };
}
export interface CampaignInvitation {
  id: string;
  campaign_id: string;
  campaign_name: string;
  system_name: string;
}
export interface CampaignCharacter {
  id: string;
  name: string;
  owner_id: string;
  core: CharacterCore | null;
}
export interface CampaignDetail {
  campaign: CampaignRow;
  members: CampaignMember[];
  characters: CampaignCharacter[];
  canManage: boolean;
  rulesetKey: string;
  systemName: string;
}
@Injectable({ providedIn: 'root' })
export class CampaignService {
  private readonly client = inject(SUPABASE);
  private readonly auth = inject(AuthService);
  async load(id: string): Promise<CampaignDetail> {
    const [campaign, members, characters, role] = await Promise.all([
      this.client
        .from('campaigns')
        .select('id,name,description,owner_id,system_id')
        .eq('id', id)
        .maybeSingle<CampaignRow>(),
      this.client
        .from('campaign_members')
        .select('user_id,profiles(username,display_name,avatar_path)')
        .eq('campaign_id', id)
        .returns<CampaignMember[]>(),
      this.client
        .from('characters')
        .select('id,name,owner_id,data,data_version')
        .eq('campaign_id', id)
        .order('name')
        .returns<
          {
            id: string;
            name: string;
            owner_id: string;
            data: Record<string, unknown>;
            data_version: number;
          }[]
        >(),
      this.client.rpc('is_super_admin'),
    ]);
    if ([campaign, members, characters, role].some((result) => result.error) || !campaign.data)
      throw new Error('Campaign unavailable, or you do not have access.');
    const system = await this.client
      .from('systems')
      .select('name,ruleset_key')
      .eq('id', campaign.data.system_id)
      .single<{ name: string; ruleset_key: string }>();
    if (system.error) throw new Error('Could not load system rules.');
    return {
      campaign: campaign.data,
      members: members.data ?? [],
      characters: (characters.data ?? []).map((row) => {
        let core: CharacterCore | null = null;
        try {
          core = readCore(row.data, row.data_version);
        } catch {
          /* Preserve invalid/newer data; show a link for review. */
        }
        return { id: row.id, name: row.name, owner_id: row.owner_id, core };
      }),
      canManage: campaign.data.owner_id === this.auth.user()?.id || role.data === true,
      rulesetKey: system.data.ruleset_key,
      systemName: system.data.name,
    };
  }
  async invite(id: string, username: string): Promise<void> {
    const { error } = await this.client.rpc('invite_to_campaign', {
      target_campaign: id,
      target_username: username.trim().toLowerCase(),
    });
    if (error) throw new Error(error.message);
  }
  async removeMember(id: string, userId: string): Promise<void> {
    const { data, error } = await this.client
      .from('campaign_members')
      .delete()
      .eq('campaign_id', id)
      .eq('user_id', userId)
      .select('user_id');
    if (error || !data?.length) throw new Error('Could not remove this member.');
  }
  async invitations(): Promise<CampaignInvitation[]> {
    const { data, error } = await this.client.rpc('my_campaign_invitations');
    if (error) throw new Error('Could not load campaign invitations.');
    return data ?? [];
  }
  async accept(id: string): Promise<string> {
    const { data, error } = await this.client.rpc('accept_campaign_invitation', {
      target_invitation: id,
    });
    if (error) throw new Error('Invitation unavailable. Reload and retry.');
    return data as string;
  }
  async decline(id: string): Promise<void> {
    const { data, error } = await this.client
      .from('campaign_invitations')
      .delete()
      .eq('id', id)
      .select('id');
    if (error || !data?.length) throw new Error('Could not decline invitation.');
  }
}
