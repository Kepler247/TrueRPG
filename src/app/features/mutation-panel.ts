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
} from '../core/systems/rads-mutations';
@Component({
  selector: 'app-mutation-panel',
  imports: [A11yModule, FormsModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="mutation-panel" aria-labelledby="mutations-title">
      <div class="heading">
        <h2 id="mutations-title">
          Mutations <span>{{ acquired().length }}</span>
        </h2>
        <button mat-button (click)="expanded.set(!expanded())" [attr.aria-expanded]="expanded()">
          {{ expanded() ? 'Close menu' : 'View mutations' }}
        </button>
      </div>
      <p class="hint">
        {{ positiveCount() }} positive / {{ acquired().length - positiveCount() }} negative. Every
        mutation is unique.
      </p>
      @if (expanded()) {
        <div class="mutation-menu">
          @for (mutation of acquired(); track mutation.id) {
            <details>
              <summary>
                <span class="polarity" [class.negative]="mutation.polarity === 'negative'">{{
                  mutation.polarity === 'positive' ? '+' : '-'
                }}</span>
                {{ mutation.name }}
              </summary>
              <p>{{ mutation.description }}</p>
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
  readonly positiveCount = computed(
    () => this.acquired().filter((m) => m.polarity === 'positive').length,
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
