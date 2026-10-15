import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  DestroyRef,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { CharacterCore } from '../core/characters/character-core';
import {
  MutationDefinition,
  MutationRules,
  MutationPolarity,
  MutationTreatment,
} from '../core/systems/rads-mutations';
@Component({
  selector: 'app-mutation-panel',
  imports: [A11yModule, FormsModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="mutation-panel" aria-labelledby="mutations-title">
      <div class="heading">
        <h2 id="mutations-title">
          Mutations <span>{{ views().length }}</span>
        </h2>
        <button mat-button (click)="expanded.set(!expanded())" [attr.aria-expanded]="expanded()">
          {{ expanded() ? 'Close menu' : 'View mutations' }}
        </button>
      </div>
      <p class="hint">
        {{ positiveCount() }} positive / {{ views().length - positiveCount() }} negative. Every
        mutation is unique.
      </p>
      @if (expanded()) {
        @if (canEdit() && rules().treat) {
          <details class="treatment-menu">
            <summary>Record a Medic treatment</summary>
            <p>
              Use this to record a treatment received at the table. The Medic spends their own
              resources. Mutational Medicine needs one minute of examination; the GM approves
              donation eligibility and amplification. Apply GM-defined enhancement bonuses at the
              table.
            </p>
            <label
              ><input type="checkbox" [(ngModel)]="treatmentConfirmed" />GM/Medic confirms the
              procedure is complete and eligible.</label
            >
            <label
              >Received Organ Donation<select [(ngModel)]="borrowedMutation">
                <option value="">Choose the donor's positive minor mutation</option>
                @for (mutation of receivable(); track mutation.id) {
                  <option [value]="mutation.id">{{ mutation.name }}</option>
                }
              </select></label
            >
            <button
              mat-stroked-button
              (click)="treat(borrowedMutation, 'receive')"
              [disabled]="busy() || pending() || !treatmentConfirmed || !borrowedMutation"
            >
              Record borrowed mutation (10 minutes)
            </button>
          </details>
        }
        <div class="mutation-menu">
          @for (mutation of views(); track mutation.id) {
            <details>
              <summary>
                <span class="polarity" [class.negative]="mutation.polarity === 'negative'">{{
                  mutation.polarity === 'positive' ? '+' : '-'
                }}</span>
                {{ mutation.name }}
              </summary>
              <p>{{ mutation.description }}</p>
              @if (mutation.temporary) {
                <p class="hint">Temporary / borrowed. This is not a permanent grant.</p>
              }
              @for (state of mutation.states; track state.id) {
                <p
                  class="mutation-state"
                  [class.negative]="state.mode === 'suppressed' || state.mode === 'inactive'"
                >
                  {{ state.name }}: {{ state.mode }}
                  @if (state.seconds !== undefined) {
                    &middot; {{ state.seconds }} game seconds remaining
                  }
                </p>
                @if (canEdit() && rules().endTreatment) {
                  <button
                    mat-button
                    (click)="endTreatment(state.id)"
                    [disabled]="busy() || pending() || !!result()"
                  >
                    End {{ state.mode }}
                  </button>
                }
              }
              @if (canEdit() && rules().treat) {
                @if (mutation.polarity === 'negative') {
                  <button
                    mat-button
                    (click)="treat(mutation.id, 'suppress')"
                    [disabled]="busy() || pending() || !treatmentConfirmed"
                  >
                    Record suppression
                  </button>
                }
                @if (mutation.polarity === 'positive') {
                  <button
                    mat-button
                    (click)="treat(mutation.id, 'amplify')"
                    [disabled]="busy() || pending() || !treatmentConfirmed"
                  >
                    Record amplification
                  </button>
                }
                @if (mutation.polarity === 'positive') {
                  <button
                    mat-button
                    (click)="treat(mutation.id, 'donate')"
                    [disabled]="busy() || pending() || !treatmentConfirmed"
                  >
                    Record donated characteristic
                  </button>
                }
              }
              @if (canEdit() && !mutation.temporary) {
                <button
                  mat-button
                  (click)="remove(mutation.id)"
                  [disabled]="busy() || pending() || !!result()"
                  [attr.aria-label]="'Remove ' + mutation.name"
                >
                  Remove
                </button>
              }
            </details>
          } @empty {
            <p>No mutations yet. Your genome is suspiciously ordinary.</p>
          }
        </div>
      }
      @if (rules().recovering(core())) {
        <div class="recovery" role="status">
          <strong>Reconstituting &middot; 0 HP</strong>
          <p>
            Your body needs 30 game minutes to rebuild. Reloading the page does not complete
            recovery.
          </p>
          @if (canEdit()) {
            <label
              ><input
                type="checkbox"
                [ngModel]="recoveryConfirmed()"
                (ngModelChange)="recoveryConfirmed.set($event)"
                [disabled]="busy() || pending()"
              />
              30 minutes have passed in the game.</label
            ><button
              mat-flat-button
              (click)="finish()"
              [disabled]="busy() || pending() || !recoveryConfirmed()"
            >
              Return at 1 HP
            </button>
          }
        </div>
      } @else if (canEdit()) {
        <details class="grant-menu">
          <summary>Radiation roulette</summary>
          <p>
            Grant a positive mutation for a reward or treatment. Use death reconstitution only when
            this character would die.
          </p>
          <div class="actions">
            <button
              mat-stroked-button
              (click)="begin('positive', false)"
              [disabled]="busy() || pending() || !!result()"
            >
              Random positive</button
            ><button
              mat-flat-button
              (click)="deathConfirm.set(true)"
              [disabled]="busy() || pending() || !!result() || core().hpMax === null"
            >
              Death reconstitution
            </button>
          </div>
          @if (deathConfirm()) {
            <div class="recovery">
              <p>
                This replaces death with a random negative mutation and 30 game minutes at 0 HP.
              </p>
              <button
                mat-flat-button
                (click)="begin('negative', true)"
                [disabled]="busy() || pending()"
              >
                Confirm death and mutate</button
              ><button mat-button (click)="deathConfirm.set(false)">Cancel</button>
            </div>
          }
        </details>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
    </section>
    @if (result(); as result) {
      <div class="mutation-backdrop">
        <section
          class="mutation-reveal"
          tabindex="-1"
          cdkFocusInitial
          role="dialog"
          aria-modal="true"
          aria-labelledby="mutation-reveal-title"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (keydown.escape)="dismiss()"
        >
          <p class="eyebrow">501 RADS / GENOME ANALYSIS</p>
          @if (spinning() || (!saved() && busy())) {
            <h2 id="mutation-reveal-title">Your DNA is changing...</h2>
            <div class="dna" aria-hidden="true">RAD / DNA / RAD</div>
            <p>Something inside you is rearranging itself.</p>
          } @else if (saved()) {
            <p class="polarity" [class.negative]="result.mutation.polarity === 'negative'">
              {{ result.mutation.polarity }} mutation / {{ result.mutation.number }}
            </p>
            <h2 id="mutation-reveal-title">{{ result.mutation.name }}</h2>
            <p>{{ result.mutation.description }}</p>
            <p class="hint">
              Mutation saved.
              {{
                result.death
                  ? 'Reconstitution has begun. Return at 1 HP after 30 game minutes.'
                  : 'Your genome will never be quite the same.'
              }}
            </p>
            <button mat-flat-button (click)="dismiss()" cdkFocusInitial>Meet the new you</button>
          } @else {
            <h2 id="mutation-reveal-title">Genome awaiting confirmation</h2>
            <p>
              The mutation has not saved. Its result is held for retry; rolling again will not
              replace it.
            </p>
            @if (problem()) {
              <p role="alert">{{ problem() }}</p>
            }
            @if (pending()) {
              <button mat-flat-button (click)="retry.emit()" [disabled]="busy()">Retry save</button>
            }
            <button mat-button (click)="dismiss()" [disabled]="busy()">Back to character</button>
          }
        </section>
      </div>
    }`,
  styleUrl: './mutation-panel.scss',
})
export class MutationPanel {
  readonly core = input.required<CharacterCore>();
  readonly rules = input.required<MutationRules>();
  readonly canEdit = input(false);
  readonly busy = input(false);
  readonly pending = input(false);
  readonly ready = input(true);
  readonly problem = input<string | null>(null);
  readonly action = output<{ core: CharacterCore; message: string }>();
  readonly retry = output<void>();
  readonly expanded = signal(false);
  readonly error = signal('');
  readonly deathConfirm = signal(false);
  readonly recoveryConfirmed = signal(false);
  readonly result = signal<{ mutation: MutationDefinition; death: boolean } | null>(null);
  readonly spinning = signal(false);
  readonly acquired = computed(() => this.rules().acquired(this.core()));
  readonly views = computed(
    () =>
      this.rules().views?.(this.core()) ??
      this.acquired().map((m) => ({
        ...m,
        temporary: false,
        states: [] as { id: string; name: string; mode: string; seconds?: number }[],
      })),
  );
  readonly receivable = computed(() =>
    this.rules().catalog.filter(
      (m) => m.polarity === 'positive' && !this.views().some((owned) => owned.id === m.id),
    ),
  );
  treatmentConfirmed = false;
  borrowedMutation = '';
  readonly positiveCount = computed(
    () => this.views().filter((m) => m.polarity === 'positive').length,
  );
  readonly saved = computed(
    () => !!this.result() && this.acquired().some((m) => m.id === this.result()!.mutation.id),
  );
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    effect(() => {
      if (!this.rules().recovering(this.core())) this.recoveryConfirmed.set(false);
    });
  }
  begin(polarity: MutationPolarity, death: boolean): void {
    if (!this.canEdit() || this.busy() || this.pending() || this.result()) return;
    if (!this.ready()) {
      this.error.set('Save HP and resource changes before granting a mutation.');
      return;
    }
    this.error.set('');
    try {
      const mutation = this.rules().draw(this.core(), polarity),
        core = this.rules().award(this.core(), mutation, death);
      this.result.set({ mutation, death });
      this.spinning.set(true);
      this.deathConfirm.set(false);
      this.timer = setTimeout(() => this.spinning.set(false), 1800);
      this.action.emit({
        core,
        message: death
          ? 'Negative mutation saved. Reconstituting for 30 game minutes at 0 HP.'
          : 'Random mutation saved.',
      });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Mutation could not be granted.');
    }
  }
  dismiss(): void {
    if (this.busy()) return;
    clearTimeout(this.timer);
    this.result.set(null);
    this.spinning.set(false);
    this.expanded.set(true);
  }
  remove(id: string): void {
    if (!this.canEdit() || this.busy() || this.pending() || this.result()) return;
    if (!this.ready()) {
      this.error.set('Save HP and resource changes before removing a mutation.');
      return;
    }
    this.error.set('');
    try {
      this.action.emit({
        core: this.rules().remove(this.core(), id),
        message: 'Mutation removed. It remains excluded from future rolls.',
      });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Mutation could not be removed.');
    }
  }
  treat(id: string, kind: MutationTreatment): void {
    this.mutationAction(() => {
      if (!this.treatmentConfirmed)
        throw new Error('Confirm treatment completion and eligibility first.');
      return this.rules().treat!(this.core(), id, kind);
    }, 'Mutation treatment recorded. The Medic tracks their resource cost separately.');
  }
  endTreatment(id: string): void {
    this.mutationAction(
      () => this.rules().endTreatment!(this.core(), id),
      'Mutation effect ended; required recovery applied.',
    );
  }
  private mutationAction(fn: () => CharacterCore, message: string): void {
    if (!this.canEdit() || this.busy() || this.pending() || this.result()) return;
    if (!this.ready()) {
      this.error.set('Save HP/resource changes first.');
      return;
    }
    this.error.set('');
    try {
      this.action.emit({ core: fn(), message });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Treatment failed.');
    }
  }
  finish(): void {
    if (!this.canEdit() || this.busy() || this.pending() || !this.recoveryConfirmed()) return;
    if (!this.ready()) {
      this.error.set('Reset unsaved HP/resource changes before completing recovery.');
      return;
    }
    try {
      this.action.emit({
        core: this.rules().finishRecovery(this.core()),
        message: 'Reconstitution complete. Returned at 1 HP.',
      });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Recovery failed.');
    }
  }
}
