import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  abilityModifier,
  pointBuyRemaining,
  STATS,
  StatKey,
} from '../core/characters/character-core';

export const startingScores = (): Record<StatKey, number> => ({
  str: 8,
  dex: 8,
  con: 8,
  int: 8,
  wis: 8,
  cha: 8,
});
@Component({
  selector: 'app-point-buy',
  imports: [MatButtonModule],
  template: `
    <section aria-labelledby="point-buy-title">
      <h3 id="point-buy-title">Ability scores � point buy</h3>
      <p aria-live="polite">{{ remaining() }} of 27 points remaining</p>
      <p>
        Scores start at 8 and can be bought up to 15. Raising 13 to 14 or 14 to 15 costs 2 points.
      </p>
      <div class="scores">
        @for (stat of stats; track stat.key) {
          <div class="score">
            <strong>{{ stat.name }}</strong>
            <div class="controls">
              <button
                mat-stroked-button
                type="button"
                [attr.aria-label]="'Decrease ' + stat.name"
                [disabled]="disabled() || scores()[stat.key] <= 8"
                (click)="change(stat.key, -1)"
              >
                -
              </button>
              <span>{{ scores()[stat.key] }} ({{ signed(modifier(scores()[stat.key])) }})</span>
              <button
                mat-stroked-button
                type="button"
                [attr.aria-label]="'Increase ' + stat.name"
                [disabled]="disabled() || !canIncrease(stat.key)"
                (click)="change(stat.key, 1)"
              >
                +
              </button>
            </div>
          </div>
        }
      </div>
      <div class="actions">
        <button mat-button type="button" (click)="standardArray()" [disabled]="disabled()">
          Use standard array</button
        ><button mat-button type="button" (click)="reset()" [disabled]="disabled()">
          Reset scores
        </button>
      </div>
    </section>
  `,
  styles: `
    .scores {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
      gap: 1rem;
    }
    .score {
      padding: 1rem;
      border: 1px solid #dddcd5;
      border-radius: 0.75rem;
    }
    .controls,
    .actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .controls {
      margin-top: 0.75rem;
    }
    button {
      min-width: 44px;
      min-height: 44px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PointBuy {
  readonly scores = model<Record<StatKey, number>>(startingScores());
  readonly disabled = input(false);
  readonly stats = STATS;
  readonly remaining = computed(() => pointBuyRemaining(this.scores()));
  readonly modifier = abilityModifier;
  signed(value: number): string {
    return `${value >= 0 ? '+' : ''}${value}`;
  }
  canIncrease(stat: StatKey): boolean {
    return (
      this.scores()[stat] < 15 &&
      pointBuyRemaining({ ...this.scores(), [stat]: this.scores()[stat] + 1 }) >= 0
    );
  }
  change(stat: StatKey, delta: number): void {
    if (this.disabled()) return;
    const next = { ...this.scores(), [stat]: this.scores()[stat] + delta };
    if (next[stat] < 8 || next[stat] > 15 || pointBuyRemaining(next) < 0) return;
    this.scores.set(next);
  }
  standardArray(): void {
    if (!this.disabled()) this.scores.set({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 });
  }
  reset(): void {
    if (!this.disabled()) this.scores.set(startingScores());
  }
}
