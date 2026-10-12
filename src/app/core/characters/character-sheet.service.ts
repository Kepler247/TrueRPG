import { inject, Injectable } from '@angular/core';
import { SUPABASE } from '../auth/supabase';
import { AuthService } from '../auth/auth.service';
import { CHARACTER_DATA_VERSION, CharacterCore, coreSchema, readCore } from './character-core';
import { RulesetService } from './character-ruleset';
import { validateSystemCore } from '../systems/system-rules';

export interface SheetRow {
  portrait_path?: string | null;
  id: string;
  name: string;
  owner_id: string;
  system_id: string;
  campaign_id: string | null;
  data: Record<string, unknown>;
  data_version: number;
  updated_at: string;
}
export interface SheetRecord {
  canAssign?: boolean;
  row: SheetRow;
  core: CharacterCore;
  canEdit: boolean;
  canManageCarryRules: boolean;
  enforceCarryWeight: boolean;
  ownerLabel: string;
  systemName: string;
  rulesetKey?: string;
}
@Injectable({ providedIn: 'root' })
export class CharacterSheetService {
  private readonly client = inject(SUPABASE);
  private readonly auth = inject(AuthService);
  private readonly rulesets = inject(RulesetService);
  async load(id: string): Promise<SheetRecord> {
    const { data: row, error } = await this.client
      .from('characters')
      .select('*')
      .eq('id', id)
      .maybeSingle<SheetRow>();
    if (error || !row) throw new Error('Character not found, or you do not have access.');
    const [profile, system, role, campaign] = await Promise.all([
      this.client
        .from('profiles')
        .select('username,display_name')
        .eq('id', row.owner_id)
        .maybeSingle<{ username: string | null; display_name: string }>(),
      this.client
        .from('systems')
        .select('name,ruleset_key')
        .eq('id', row.system_id)
        .single<{ name: string; ruleset_key: string }>(),
      this.client.rpc('is_super_admin'),
      row.campaign_id
        ? this.client
            .from('campaigns')
            .select('owner_id,enforce_carry_weight')
            .eq('id', row.campaign_id)
            .maybeSingle<{ owner_id: string; enforce_carry_weight: boolean }>()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if ([profile, system, role, campaign].some((result) => result.error))
      throw new Error('Could not load character details. Please retry.');
    const userId = this.auth.user()?.id;
    return {
      row,
      core: readCore(row.data, row.data_version),
      canEdit:
        !!userId &&
        (row.owner_id === userId || campaign.data?.owner_id === userId || role.data === true),
      canAssign: !!userId && (row.owner_id === userId || role.data === true),
      canManageCarryRules:
        !!row.campaign_id && !!userId && (campaign.data?.owner_id === userId || role.data === true),
      enforceCarryWeight: campaign.data?.enforce_carry_weight ?? true,
      ownerLabel: profile.data?.username
        ? `@${profile.data.username}`
        : profile.data?.display_name || 'Unnamed player',
      systemName: system.data?.name ?? 'Unknown system',
      rulesetKey: system.data?.ruleset_key,
    };
  }
  async setCarryRule(record: SheetRecord, enforce: boolean): Promise<boolean> {
    if (!record.canManageCarryRules || !record.row.campaign_id)
      throw new Error('Only the campaign GM or super-admin can change this rule.');
    const { data, error } = await this.client
      .from('campaigns')
      .update({ enforce_carry_weight: enforce })
      .eq('id', record.row.campaign_id)
      .select('enforce_carry_weight')
      .maybeSingle<{ enforce_carry_weight: boolean }>();
    if (error || !data) throw new Error('Could not change the campaign rule. Please retry.');
    return data.enforce_carry_weight;
  }
  async assignmentOptions(
    record: SheetRecord,
  ): Promise<{ id: string; name: string; owner_id: string; enforce_carry_weight: boolean }[]> {
    if (!record.canAssign) return [];
    const { data: members, error } = await this.client
      .from('campaign_members')
      .select('campaign_id')
      .eq('user_id', record.row.owner_id);
    if (error) throw new Error('Could not load matching campaigns.');
    const ids = (members ?? []).map((member) => member.campaign_id);
    if (!ids.length) return [];
    const campaigns = await this.client
      .from('campaigns')
      .select('id,name,owner_id,enforce_carry_weight')
      .eq('system_id', record.row.system_id)
      .in('id', ids)
      .order('name');
    if (campaigns.error) throw new Error('Could not load matching campaigns.');
    return campaigns.data ?? [];
  }
  async assign(record: SheetRecord, campaignId: string | null): Promise<SheetRecord> {
    if (!record.canAssign) throw new Error('Only the owner or admin can assign this character.');
    const { data, error } = await this.client.rpc('set_character_campaign_checked', {
      character_id: record.row.id,
      target_campaign_id: campaignId,
      expected_updated_at: record.row.updated_at,
    });
    if (error || !data) throw new Error(error?.message ?? 'Could not assign character.');
    const { row, enforceCarryWeight, canManageCarryRules } = data as {
      row: SheetRow;
      enforceCarryWeight: boolean;
      canManageCarryRules: boolean;
    };
    return {
      ...record,
      row,
      core: readCore(row.data, row.data_version),
      canManageCarryRules,
      enforceCarryWeight,
    };
  }
  async save(record: SheetRecord, name: string, core: CharacterCore): Promise<SheetRecord> {
    if (!this.auth.user() || !record.canEdit) throw new Error('This character is read-only.');
    const validated = coreSchema.safeParse(core);
    if (!validated.success)
      throw new Error(
        `Check ${validated.error.issues[0].path.join('.')}: ${validated.error.issues[0].message}`,
      );
    if (!name.trim() || name.trim().length > 150)
      throw new Error('Enter a character name of 1-150 characters.');
    validateSystemCore(validated.data, this.rulesets.get(record.rulesetKey));
    const { data: row, error } = await this.client
      .from('characters')
      .update({
        name: name.trim(),
        data: { ...record.row.data, core: validated.data },
        data_version: CHARACTER_DATA_VERSION,
      })
      .eq('id', record.row.id)
      .eq('updated_at', record.row.updated_at)
      .select('*')
      .maybeSingle<SheetRow>();
    if (error) throw new Error('Could not save your character. Please retry.');
    if (!row)
      throw new Error('The character changed or is no longer editable. Reload before saving.');
    return { ...record, row, core: readCore(row.data, row.data_version) };
  }
}
