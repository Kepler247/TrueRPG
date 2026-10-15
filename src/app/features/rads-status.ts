import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { CharacterCore } from '../core/characters/character-core';
import {
  RadsEffect,
  RadsModifier,
  radsState,
  withRads,
  endRadsEffect,
  advanceRadsTime,
  activeConditions,
  consumeAction,
  convertCurrency,
  walletChange,
} from '../core/systems/rads-engine';
import { resolveRadsConsequence } from '../core/systems/rads-items';
import { RADS_CONSUMABLES } from '../core/systems/rads-consumables';
import { RADS_FEATURES } from '../core/systems/rads-definitions';
const CONDITIONS: Record<string, string> = {
  Blinded:
    'Attacks have disadvantage. Checks requiring sight automatically fail; attacks against you have advantage.',
  Deafened: 'Cannot hear; checks requiring hearing automatically fail.',
  Poisoned: 'Disadvantage on attacks and ability checks.',
  Prone:
    'Your attacks have disadvantage. Melee attacks within 5 ft against you have advantage; farther attacks have disadvantage. Standing normally costs half movement.',
  Restrained:
    'Movement 0; attacks against you have advantage; your attacks and Dexterity saves have disadvantage.',
  Stunned:
    'No actions, bonus actions, skill actions, movement or reactions; attacks against you have advantage.',
  Incapacitated:
    'No actions, bonus actions, skill actions or reactions. Movement remains available.',
  Frightened:
    'Disadvantage on attacks and checks while the fear source is visible; cannot willingly move closer.',
  Burning:
    '1d6 fire damage at the beginning of each turn until extinguished. Extinguishing costs an action.',
  Irradiated: 'Affected by the specific radioactive side effect shown in Active effects.',
  Unconscious:
    'Cannot act or move; resolve attacks against an unconscious target using the inherited 5E rules.',
};
@Component({
  selector: 'app-rads-status',
  imports: [FormsModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <section class="status-panel">
      <h2>
        Active effects
        <span>{{
          state().effects.length + state().conditions.length + (state().pending?.length ?? 0)
        }}</span>
      </h2>
      <p class="hint">
        Listed modifiers apply to your rolls; follow the full rule for target-dependent or
        GM-decided outcomes. End them when the GM says their duration has elapsed. Ending a benefit
        starts its required aftermath.
      </p>
      <div class="effect-list">
        @for (event of state().pending ?? []; track event.id) {
          <article class="effect negative">
            <header>
              <strong>{{ event.source }} consequence</strong><span>Resolution required</span>
            </header>
            <p>
              {{
                event.kind === 'damage'
                  ? event.expression + ' ' + (event.damageType ?? '') + ' damage'
                  : 'Roll a radiation side effect'
              }}
            </p>
            @if (canEdit()) {
              @if (event.options) {
                @for (choice of event.options; track $index) {
                  <button
                    mat-stroked-button
                    (click)="resolve(event.id, choice)"
                    [disabled]="busy()"
                  >
                    Choose radiation {{ choice }}
                  </button>
                }
              } @else {
                <button mat-stroked-button (click)="resolve(event.id)" [disabled]="busy()">
                  Resolve consequence
                </button>
              }
            }
          </article>
        }
        @for (condition of state().conditions; track condition) {
          <article class="effect negative">
            <header>
              <strong>{{ condition }}</strong
              ><span>Negative condition</span>
            </header>
            <p>{{ descriptions[condition] }}</p>
            @if (canEdit()) {
              @if (condition === 'Burning') {
                <button mat-stroked-button (click)="extinguish()" [disabled]="busy()">
                  Extinguish (Action)
                </button>
              }
              <button mat-button (click)="conditionChange(condition, false)" [disabled]="busy()">
                End condition (GM)
              </button>
            }
          </article>
        }
        @for (effect of state().effects; track effect.id) {
          <article
            class="effect"
            [class.positive]="tone(effect) === 'positive'"
            [class.negative]="tone(effect) === 'negative'"
          >
            <header>
              <strong>{{ effect.name }}</strong
              ><span>{{ tone(effect) }} effect</span>
            </header>
            <details>
              <summary>Full rule</summary>
              <p>{{ ruleText(effect) }}</p>
            </details>
            @for (modifier of effect.modifiers; track $index) {
              <p
                class="modifier"
                [class.positive]="modifierTone(modifier) === 'positive'"
                [class.negative]="modifierTone(modifier) === 'negative'"
              >
                {{ describe(modifier) }}
              </p>
            }
            @if (effect.conditions?.length) {
              <p class="negative">{{ effect.conditions?.join(', ') }}</p>
            }
            @if (effect.contextNote) {
              <p>{{ effect.contextNote }}</p>
            }
            @if (effect.expiresTurn !== undefined) {
              <p class="hint">{{ effect.expiresTurn! - state().turn }} own turns remaining</p>
            }
            @if (effect.expiresSecond !== undefined) {
              <p class="hint">
                {{ effect.expiresSecond! - state().seconds }} game seconds remaining
              </p>
            }
            @if (
              effect.after?.length ||
              effect.afterConditions?.length ||
              effect.afterEvents?.length ||
              effect.afterNote
            ) {
              <p class="hint">Ending this effect starts its drawback.</p>
            }
            @if (canEdit()) {
              <button mat-stroked-button (click)="end(effect.id)" [disabled]="busy()">
                End effect
              </button>
            }
          </article>
        } @empty {
          @if (!state().conditions.length) {
            <p>No active buffs, drawbacks or conditions.</p>
          }
        }
      </div>
      @if (canEdit()) {
        <div class="control-row">
          <label
            >Condition<select [(ngModel)]="selectedCondition">
              <option value="">Choose a condition</option>
              @for (name of conditionNames; track name) {
                <option [value]="name">{{ name }}</option>
              }
            </select></label
          ><button
            mat-stroked-button
            (click)="conditionChange(selectedCondition, true)"
            [disabled]="busy() || !selectedCondition"
          >
            Add condition
          </button>
        </div>
      }
      <details>
        <summary>Check circumstances</summary>
        <p class="hint">
          Tell the roller what this task requires. Circumstantial effects apply only when their
          stated condition holds.
        </p>
        <div class="circumstances">
          @for (tag of circumstances; track tag.id) {
            <label
              ><input
                type="checkbox"
                [checked]="tags().includes(tag.id)"
                (change)="toggleTag(tag.id, $any($event.target).checked)"
              />{{ tag.label }}</label
            >
          }
        </div>
      </details>
      @if (canEdit()) {
        <details>
          <summary>Turn and game-time controls</summary>
          <p>
            Own turn {{ state().turn + 1 }}. Game time advanced {{ state().seconds }} seconds. No
            real-time countdown runs.
          </p>
          <p>
            Actions: {{ state().actions.action }} / Bonus: {{ state().actions.bonus }} / Skill:
            {{ state().actions.skill }} / Reaction: {{ state().actions.reaction }} / Extra
            standard-or-bonus: {{ state().actions.extra }}
          </p>
          <div class="actions">
            <button mat-stroked-button (click)="combat()" [disabled]="busy()">
              {{ state().inCombat ? 'Leave combat' : 'Start combat' }}</button
            ><button mat-stroked-button (click)="advance(6, true)" [disabled]="busy()">
              Next own turn
            </button>
            @for (type of actionTypes; track type) {
              <button mat-button (click)="spend(type)" [disabled]="busy()">Spend {{ type }}</button>
            }
          </div>
          <label>Game minutes<input type="number" min="1" step="1" [(ngModel)]="minutes" /></label
          ><button mat-stroked-button (click)="advance(minutes * 60)" [disabled]="busy()">
            Advance game time
          </button>
        </details>
        <details>
          <summary>Temporary HP</summary>
          <p>
            Current: {{ state().temporaryHP }}. Temporary HP absorbs damage first and does not
            stack.
          </p>
          <label
            >Granted amount<input type="number" min="1" step="1" [(ngModel)]="temporaryHP" /></label
          ><button mat-stroked-button (click)="grantTemporaryHP()" [disabled]="busy()">
            Grant temporary HP</button
          ><button mat-button (click)="clearTemporaryHP()" [disabled]="busy()">
            Clear temporary HP
          </button>
        </details>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
    </section>
    <section class="status-panel" aria-labelledby="wallet-title">
      <h2 id="wallet-title">Wallet</h2>
      <dl class="wallet-balances">
        <div>
          <dt>Dollars</dt>
          <dd>\${{ state().wallet.dollars }}</dd>
        </div>
        <div>
          <dt>Chips</dt>
          <dd>{{ state().wallet.chips }}&cent;</dd>
        </div>
        <div>
          <dt>Fusion cells</dt>
          <dd>{{ state().wallet.fusionCells }} <span>FC</span></dd>
        </div>
      </dl>
      <p class="hint">
        100 dollars = 1 chip. 100 chips = 1 fusion cell. Vehicle fuel spends this same fusion-cell
        balance.
      </p>
      @if (canEdit()) {
        <div class="control-row">
          <label
            >Currency<select [(ngModel)]="currency">
              <option value="dollars">Dollars</option>
              <option value="chips">Chips (&cent;)</option>
              <option value="fusionCells">Fusion cells</option>
            </select></label
          ><label>Amount<input type="number" step="1" min="1" [(ngModel)]="amount" /></label>
        </div>
        <div class="actions">
          <button mat-stroked-button (click)="money(1)" [disabled]="busy()">Receive</button
          ><button mat-stroked-button (click)="money(-1)" [disabled]="busy()">Spend</button
          ><label
            >Convert to<select [(ngModel)]="convertTo">
              <option value="dollars">Dollars</option>
              <option value="chips">Chips (&cent;)</option>
              <option value="fusionCells">Fusion cells</option>
            </select></label
          ><button mat-stroked-button (click)="convert()" [disabled]="busy()">
            Convert exact amount
          </button>
        </div>
      }
    </section>`,
  styleUrl: './rads-status.scss',
})
export class RadsStatus {
  readonly core = input.required<CharacterCore>();
  readonly canEdit = input(false);
  readonly busy = input(false);
  readonly tags = input<string[]>([]);
  readonly tagsChange = output<string[]>();
  readonly action = output<{ core: CharacterCore; message: string }>();
  readonly error = signal('');
  readonly state = computed(() => radsState(this.core()));
  readonly descriptions = CONDITIONS;
  readonly conditionNames = Object.keys(CONDITIONS);
  readonly actionTypes = ['action', 'bonus', 'skill', 'reaction'] as const;
  readonly circumstances = [
    {
      id: 'command-audience',
      label: 'Organizing / directing / negotiating with Command Presence audience',
    },
    { id: 'sermon-audience', label: 'Persuading / intimidating / inspiring the sermon audience' },
    { id: 'tactical-plan', label: 'Carrying out a Tactical Genius step' },
    { id: 'ordered-objective', label: 'Pursuing the Supreme Commander objective' },
    { id: 'prophecy-event', label: 'Bringing about / preventing the prophesied event' },
    { id: 'gambling', label: 'Gambling money or property' },
    { id: 'wild-plan', label: 'Following the declared Wild Plan' },
    { id: 'coordinated-movement', label: 'Coordinated movement / retreat' },
    { id: 'inhaled', label: 'Inhaled chemical / poison damage' },
    { id: 'ingested', label: 'Ingested chemical / poison damage' },
    { id: 'heat-exhaustion', label: 'CON save against heat / exhaustion' },
    { id: 'fatigue', label: 'CON check resisting fatigue' },
    { id: 'improvised', label: 'Improvised melee weapon' },
    { id: 'initiative', label: 'Initiative context' },
    { id: 'ranged', label: 'Incoming ranged damage' },
    { id: 'ordinary-injury', label: 'Treat ordinary injury' },
    { id: 'ordinary-repair', label: 'Repair ordinary electronics' },
    { id: 'container-search', label: 'Search a specific container' },
    { id: 'trade', label: 'Ordinary trade' },
    { id: 'false-identity', label: 'Prepared false identity' },
    { id: 'interrogation', label: 'Isolated frightened target' },
    { id: 'unsafe-machinery', label: 'Unsafe machinery' },
    { id: 'medical-professional', label: 'Presenting as a medical professional' },
    { id: 'fear', label: 'Save against fear / intimidation' },
    { id: 'tactical', label: 'Tactical assessment' },
    { id: 'ordinary-wastelander', label: 'Ordinary wastelander' },
    { id: 'sight', label: 'Requires sight' },
    { id: 'hearing', label: 'Requires hearing' },
    { id: 'fear-visible', label: 'Fear source visible' },
    { id: 'technical', label: 'Electronic repair / modification' },
    { id: 'medical', label: 'Medical procedure' },
    { id: 'observation', label: 'Observation' },
    { id: 'religious', label: 'Religious knowledge' },
    { id: 'defensive', label: 'Defensive save' },
  ];
  selectedCondition = '';
  temporaryHP = 1;
  minutes = 1;
  amount = 1;
  currency: 'dollars' | 'chips' | 'fusionCells' = 'chips';
  convertTo: 'dollars' | 'chips' | 'fusionCells' = 'fusionCells';
  toggleTag(id: string, on: boolean): void {
    this.tagsChange.emit(
      on ? [...new Set([...this.tags(), id])] : this.tags().filter((t) => t !== id),
    );
  }
  private run(fn: () => CharacterCore, message: string): void {
    if (!this.canEdit() || this.busy()) return;
    this.error.set('');
    try {
      this.action.emit({ core: fn(), message });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Action failed.');
    }
  }
  resolve(id: string, choice?: number): void {
    if (!this.canEdit() || this.busy()) return;
    this.error.set('');
    try {
      this.action.emit(resolveRadsConsequence(this.core(), id, undefined, choice));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Resolution failed.');
    }
  }
  end(id: string): void {
    this.run(() => endRadsEffect(this.core(), id), 'Effect ended; required aftermath applied.');
  }
  extinguish(): void {
    this.run(() => {
      const next = consumeAction(this.core(), 'action'),
        s = radsState(next);
      return withRads(next, {
        ...s,
        conditions: s.conditions.filter((c) => c !== 'Burning'),
        effects: s.effects.map((e) => ({
          ...e,
          conditions: e.conditions?.filter((c) => c !== 'Burning'),
        })),
      });
    }, 'Burning extinguished; Action spent when in combat.');
  }
  grantTemporaryHP(): void {
    this.run(() => {
      if (!Number.isSafeInteger(this.temporaryHP) || this.temporaryHP < 1)
        throw new Error('Enter a positive whole temporary HP amount.');
      return withRads(this.core(), {
        ...this.state(),
        temporaryHP: Math.max(this.state().temporaryHP, this.temporaryHP),
      });
    }, 'Temporary HP saved without stacking.');
  }
  clearTemporaryHP(): void {
    this.run(
      () => withRads(this.core(), { ...this.state(), temporaryHP: 0 }),
      'Temporary HP cleared.',
    );
  }
  conditionChange(name: string, on: boolean): void {
    if (!CONDITIONS[name]) return;
    this.run(() => {
      const state = this.state();
      return withRads(this.core(), {
        ...state,
        conditions: (on
          ? [...new Set([...state.conditions, name])]
          : state.conditions.filter((c) => c !== name)) as typeof state.conditions,
      });
    }, 'Conditions saved.');
  }
  advance(seconds: number, turn = false): void {
    this.run(
      () => advanceRadsTime(this.core(), seconds, turn),
      'Game time advanced; effects updated.',
    );
  }
  combat(): void {
    this.run(
      () => withRads(this.core(), { ...this.state(), inCombat: !this.state().inCombat }),
      'Combat tracking updated.',
    );
  }
  spend(type: 'action' | 'bonus' | 'skill' | 'reaction'): void {
    this.run(() => consumeAction(this.core(), type), 'Action spent.');
  }
  money(direction: number): void {
    this.run(() => {
      if (!Number.isSafeInteger(this.amount) || this.amount < 1)
        throw new Error('Enter a positive whole amount.');
      return walletChange(this.core(), { [this.currency]: direction * this.amount });
    }, 'Wallet saved.');
  }
  convert(): void {
    this.run(
      () => convertCurrency(this.core(), this.currency, this.convertTo, this.amount),
      'Currency converted.',
    );
  }
  modifierTone(m: RadsModifier): 'positive' | 'negative' | 'neutral' {
    if (['advantage', 'resistance', 'immunity', 'reduce', 'die'].includes(m.kind))
      return 'positive';
    if (['disadvantage', 'vulnerability'].includes(m.kind)) return 'negative';
    if (m.kind === 'flat') {
      if (!m.value) return 'neutral';
      return (m.scope === 'incoming' ? m.value < 0 : m.value > 0) ? 'positive' : 'negative';
    }
    if (m.kind === 'multiply') {
      if (m.value === undefined || m.value === 1) return 'neutral';
      return (m.scope === 'incoming' ? m.value < 1 : m.value > 1) ? 'positive' : 'negative';
    }
    return 'neutral';
  }
  tone(e: RadsEffect): string {
    const tones = e.modifiers.map((m) => this.modifierTone(m)),
      good = tones.includes('positive'),
      bad = !!e.conditions?.length || tones.includes('negative');
    return good && bad ? 'mixed' : good ? 'positive' : bad ? 'negative' : 'neutral';
  }
  describe(m: RadsModifier): string {
    return `${m.stat?.toUpperCase() ?? ''} ${m.family ?? ''} ${m.skill ?? ''} ${m.scope}: ${m.kind} ${m.value ?? ''}${m.context ? ' (when ' + m.context + ')' : ''}`.trim();
  }
  ruleText(e: RadsEffect): string {
    const name = e.name.replace(/ aftermath$/, '');
    return (
      RADS_FEATURES.find((f) => f.name === name)?.description ??
      RADS_CONSUMABLES.find((i) => i.name === name)?.description ??
      e.contextNote ??
      'Follow the condition and modifiers listed here.'
    );
  }
}
