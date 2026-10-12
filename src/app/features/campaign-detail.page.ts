import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { CampaignDetail, CampaignService } from '../core/campaigns/campaign.service';
import { RulesetService } from '../core/characters/character-ruleset';
import { currentHitPoints } from '../core/characters/character-core';
import { AuthService } from '../core/auth/auth.service';
@Component({
  selector: 'app-campaign-detail',
  imports: [RouterLink, FormsModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a routerLink="/campaigns">Back to campaigns</a>
    @if (detail(); as detail) {
      <p>{{ detail.systemName }}</p>
      <h1>{{ detail.campaign.name }}</h1>
      <p>{{ detail.campaign.description }}</p>
      <section>
        <h2>{{ detail.canManage ? 'GM party overview' : 'Party' }}</h2>
        <div class="party">
          @for (character of detail.characters; track character.id) {
            <article>
              <h3>
                <a [routerLink]="['/characters', character.id]">{{ character.name }}</a>
              </h3>
              <p>{{ owner(character.owner_id) }}</p>
              @if (character.core; as core) {
                <p>{{ core.class || 'Class not selected' }} &middot; Level {{ core.level }}</p>
                <p>HP {{ hp(core) ?? '--' }} / {{ core.hpMax ?? '--' }}</p>
                @if (rules().classResource?.(core); as resource) {
                  <p>
                    {{ resource.name }} {{ resource.current(core) }} /
                    {{ resource.maximum(core) ?? 'unlimited' }}
                  </p>
                }
              } @else {
                <p>Sheet needs review.</p>
              }
            </article>
          } @empty {
            <p>
              No characters assigned yet. Players can assign matching-system characters through the
              Characters creator.
            </p>
          }
        </div>
      </section>
      <section>
        <h2>Members</h2>
        @for (member of detail.members; track member.user_id) {
          <div class="member">
            <span
              >{{ owner(member.user_id)
              }}{{ member.user_id === detail.campaign.owner_id ? ' (GM)' : '' }}</span
            >
            @if (detail.canManage && member.user_id !== detail.campaign.owner_id) {
              <button mat-button (click)="remove(member.user_id)" [disabled]="busy()">
                Remove member
              </button>
            }
          </div>
        }
        @if (detail.canManage) {
          <form (ngSubmit)="invite()">
            <label
              >Invite by username<input
                [ngModel]="username()"
                (ngModelChange)="username.set($event)"
                name="username"
                autocomplete="off"
                [disabled]="busy()"
                placeholder="Player username" /></label
            ><button mat-flat-button type="submit" [disabled]="busy() || !username().trim()">
              Invite player
            </button>
          </form>
          <p class="hint">
            The player accepts from Campaigns. Removing a member detaches their characters and
            preserves their sheets.
          </p>
        }
      </section>
    } @else {
      <h1>Campaign</h1>
      <p>{{ loading() ? 'Loading...' : 'Campaign unavailable' }}</p>
      <button mat-button (click)="load()">Retry</button>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p role="status">{{ message() }}</p>
    }`,
  styles: `
    a,
    button,
    input {
      min-height: 44px;
      font-size: 16px;
    }
    a {
      display: inline-flex;
      align-items: center;
    }
    section {
      margin-block: 1rem;
      padding: 1rem;
      border: 1px solid #dddcd5;
      border-radius: 0.75rem;
    }
    .party {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
      gap: 1rem;
    }
    article {
      padding: 1rem;
      background: #f4f8f2;
      border-radius: 0.5rem;
      overflow-wrap: anywhere;
    }
    .member,
    form {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    label {
      display: grid;
      gap: 0.4rem;
      flex: 1;
      min-width: 0;
    }
    input {
      box-sizing: border-box;
      width: 100%;
      padding: 0.5rem;
    }
    .hint {
      font-size: 0.85rem;
      color: #5e685f;
    }
    [role='alert'] {
      color: #8b2620;
    }
  `,
})
export class CampaignDetailPage {
  private readonly service = inject(CampaignService);
  private readonly auth = inject(AuthService);
  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  private readonly adapters = inject(RulesetService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly detail = signal<CampaignDetail | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly username = signal('');
  readonly rules = computed(() => this.adapters.get(this.detail()?.rulesetKey));
  readonly hp = currentHitPoints;
  private version = 0;
  constructor() {
    effect(() => {
      const id = this.params().get('id');
      this.userId();
      if (id) untracked(() => void this.load(id));
    });
  }
  async load(id = this.params().get('id') ?? ''): Promise<void> {
    const version = ++this.version;
    this.loading.set(true);
    this.detail.set(null);
    this.error.set('');
    try {
      const detail = await this.service.load(id);
      if (version === this.version) this.detail.set(detail);
    } catch (error) {
      if (version === this.version)
        this.error.set(error instanceof Error ? error.message : 'Could not load campaign.');
    } finally {
      if (version === this.version) this.loading.set(false);
    }
  }
  owner(id: string): string {
    const profile = this.detail()?.members.find((member) => member.user_id === id)?.profiles;
    return profile?.username ? '@' + profile.username : profile?.display_name || 'Unnamed player';
  }
  async invite(): Promise<void> {
    const detail = this.detail();
    if (!detail?.canManage || this.busy()) return;
    this.busy.set(true);
    const version = this.version;
    this.error.set('');
    try {
      await this.service.invite(detail.campaign.id, this.username());
      if (version !== this.version) return;
      this.username.set('');
      this.message.set('Invitation sent. The player can accept from Campaigns.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not invite player.');
    } finally {
      this.busy.set(false);
    }
  }
  async remove(id: string): Promise<void> {
    const detail = this.detail();
    if (!detail?.canManage || this.busy() || id === detail.campaign.owner_id) return;
    this.busy.set(true);
    const version = this.version;
    this.error.set('');
    try {
      await this.service.removeMember(detail.campaign.id, id);
      if (version !== this.version) return;
      await this.load(detail.campaign.id);
      this.message.set('Member removed. Their characters were detached, not deleted.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not remove member.');
    } finally {
      this.busy.set(false);
    }
  }
}
