import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  AdventureContext,
  AdventureService,
  CollectionKind,
} from '../core/adventures/adventure.service';
import { AuthService } from '../core/auth/auth.service';

const emptyContext = (): AdventureContext => ({
  systems: [],
  profiles: [],
  campaigns: [],
  characters: [],
  memberCampaignIds: [],
});
@Component({
  selector: 'app-adventure-collection',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './adventure-collection.html',
  styleUrl: './adventure-collection.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdventureCollection {
  readonly kind = input.required<CollectionKind>();
  readonly auth = inject(AuthService);
  private readonly adventures = inject(AdventureService);
  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  private loadVersion = 0;
  readonly context = signal<AdventureContext>(emptyContext());
  readonly loading = signal(true);
  readonly loaded = signal(false);
  readonly saving = signal(false);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly selectedSystem = signal('');
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    systemId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    campaignId: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
  });
  readonly eligibleCampaigns = computed(() =>
    this.context().campaigns.filter(
      (campaign) =>
        campaign.system_id === this.selectedSystem() &&
        this.context().memberCampaignIds.includes(campaign.id),
    ),
  );
  readonly rows = computed(() =>
    this.kind() === 'characters' ? this.context().characters : this.context().campaigns,
  );

  constructor() {
    effect(() => {
      this.kind();
      this.userId();
      untracked(() => void this.load());
    });
  }
  async load(): Promise<void> {
    const version = ++this.loadVersion;
    const userId = this.userId();
    this.loading.set(true);
    this.loaded.set(false);
    this.creating.set(false);
    this.error.set(null);
    this.message.set(null);
    this.context.set(emptyContext());
    try {
      const context = await this.adventures.load(this.kind());
      if (version !== this.loadVersion || userId !== this.userId()) return;
      this.context.set(context);
      this.loaded.set(true);
    } catch (error) {
      if (version === this.loadVersion && userId === this.userId())
        this.error.set(
          error instanceof Error ? error.message : 'Could not load your adventures. Please retry.',
        );
    } finally {
      if (version === this.loadVersion && userId === this.userId()) this.loading.set(false);
    }
  }
  startCreate(): void {
    const systemId = this.context().systems[0]?.id ?? '';
    this.form.reset({ name: '', systemId, campaignId: '', description: '' });
    this.selectedSystem.set(systemId);
    this.error.set(null);
    this.message.set(null);
    this.creating.set(true);
  }
  changeSystem(): void {
    this.selectedSystem.set(this.form.controls.systemId.value);
    this.form.controls.campaignId.setValue('');
  }
  cancelCreate(): void {
    if (this.saving()) return;
    this.creating.set(false);
    this.error.set(null);
  }
  async create(): Promise<void> {
    if (this.saving() || !this.loaded()) return;
    this.form.controls.name.setValue(this.form.controls.name.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, systemId, campaignId, description } = this.form.getRawValue();
    if (!this.context().systems.some((system) => system.id === systemId)) return;
    if (
      this.kind() === 'characters' &&
      campaignId &&
      !this.eligibleCampaigns().some((campaign) => campaign.id === campaignId)
    ) {
      this.error.set('Choose a campaign you belong to using the same system.');
      return;
    }
    const userId = this.userId();
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      if (this.kind() === 'campaigns') {
        const campaign = await this.adventures.createCampaign(name, systemId, description);
        if (userId !== this.userId()) return;
        this.context.update((context) => ({
          ...context,
          campaigns: [...context.campaigns, campaign].sort((a, b) => a.name.localeCompare(b.name)),
          memberCampaignIds: [...context.memberCampaignIds, campaign.id],
        }));
        this.message.set('Campaign created. You are its GM.');
      } else {
        const character = await this.adventures.createCharacter(name, systemId, campaignId || null);
        if (userId !== this.userId()) return;
        this.context.update((context) => ({
          ...context,
          characters: [...context.characters, character].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        }));
        this.message.set('Character created.');
      }
      this.creating.set(false);
      this.form.reset();
    } catch (error) {
      if (userId === this.userId())
        this.error.set(error instanceof Error ? error.message : 'Could not save. Please retry.');
    } finally {
      this.saving.set(false);
    }
  }
  ownerLabel(ownerId: string): string {
    const profile = this.context().profiles.find((profile) => profile.id === ownerId);
    return profile?.username ? `@${profile.username}` : profile?.display_name || 'Unnamed player';
  }
  systemLabel(systemId: string): string {
    return (
      this.context().systems.find((system) => system.id === systemId)?.name ?? 'Unknown system'
    );
  }
  campaignDescription(campaignId: string): string {
    return (
      this.context().campaigns.find((campaign) => campaign.id === campaignId)?.description ?? ''
    );
  }
  campaignLabel(characterId: string): string {
    const character = this.context().characters.find((character) => character.id === characterId);
    return (
      this.context().campaigns.find((campaign) => campaign.id === character?.campaign_id)?.name ??
      'No campaign'
    );
  }
}
