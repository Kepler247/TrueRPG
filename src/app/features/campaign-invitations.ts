import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  computed,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { CampaignInvitation, CampaignService } from '../core/campaigns/campaign.service';
import { AuthService } from '../core/auth/auth.service';
@Component({
  selector: 'app-campaign-invitations',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (invites().length) {
      <section>
        <h2>Campaign invitations</h2>
        @for (invite of invites(); track invite.id) {
          <article>
            <strong>{{ invite.campaign_name }}</strong>
            <p>{{ invite.system_name }}</p>
            <button mat-flat-button (click)="accept(invite.id)" [disabled]="busy()">Accept</button
            ><button mat-button (click)="decline(invite.id)" [disabled]="busy()">Decline</button>
          </article>
        }
      </section>
    }
    @if (error()) {
      <p role="alert">
        {{ error() }} <button mat-button (click)="load()">Retry invitations</button>
      </p>
    }`,
  styles: `
    section {
      padding: 1rem;
      border: 1px solid #dddcd5;
      border-radius: 0.75rem;
      margin-bottom: 1rem;
    }
    article + article {
      margin-top: 1rem;
    }
    button {
      min-height: 44px;
    }
  `,
})
export class CampaignInvitations {
  private readonly service = inject(CampaignService);
  private readonly auth = inject(AuthService);
  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  private readonly router = inject(Router);
  readonly invites = signal<CampaignInvitation[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  private version = 0;
  constructor() {
    effect(() => {
      this.userId();
      untracked(() => void this.load());
    });
  }
  async load(): Promise<void> {
    const version = ++this.version;
    this.error.set('');
    this.invites.set([]);
    if (!this.userId()) {
      this.invites.set([]);
      return;
    }
    try {
      const invites = await this.service.invitations();
      if (version === this.version) this.invites.set(invites);
    } catch (error) {
      if (version === this.version)
        this.error.set(error instanceof Error ? error.message : 'Could not load invitations.');
    }
  }
  async accept(id: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.version++;
    const userId = this.userId();
    this.error.set('');
    try {
      const campaign = await this.service.accept(id);
      if (this.userId() !== userId) return;
      this.invites.update((invites) => invites.filter((invite) => invite.id !== id));
      await this.router.navigate(['/campaigns', campaign]);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not accept invitation.');
    } finally {
      this.busy.set(false);
    }
  }
  async decline(id: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.version++;
    const userId = this.userId();
    this.error.set('');
    try {
      await this.service.decline(id);
      if (this.userId() !== userId) return;
      this.invites.update((invites) => invites.filter((invite) => invite.id !== id));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not decline invitation.');
    } finally {
      this.busy.set(false);
    }
  }
}
