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
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AuthService } from '../core/auth/auth.service';
import { CharacterSheetService, SheetRecord } from '../core/characters/character-sheet.service';
import { RulesetService } from '../core/characters/character-ruleset';
import { DiceRoll, rollWithModifier } from '../core/characters/dice';
import { validateSystemCore } from '../core/systems/system-rules';
import {
  CharacterCore,
  currentHitPoints,
  inventoryWeight,
  STATS,
} from '../core/characters/character-core';

@Component({
  selector: 'app-character-summary',
  imports: [RouterLink, MatButtonModule, FormsModule, MatInputModule, MatFormFieldModule],
  templateUrl: './character-summary.page.html',
  styleUrl: './character-summary.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterSummaryPage {
  private readonly service = inject(CharacterSheetService);
  private readonly rulesets = inject(RulesetService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly id = computed(() => this.params().get('id') ?? '');
  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  private loadVersion = 0;
  readonly record = signal<SheetRecord | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly lastRoll = signal<DiceRoll | null>(null);
  readonly rollCount = signal(0);
  roll(label: string, modifier: number): void {
    this.lastRoll.set(rollWithModifier(label, modifier, this.rules().checkDie ?? 20));
    this.rollCount.update((n) => n + 1);
  }
  readonly hpInput = signal<number | null>(null);
  readonly heatInput = signal(0);
  readonly hpAmount = signal(1);
  readonly heatAmount = signal(1);
  readonly hp = computed(() => (this.record() ? currentHitPoints(this.record()!.core) : null));
  readonly stats = STATS;
  readonly rules = computed(() => this.rulesets.get(this.record()?.rulesetKey));
  readonly skills = computed(() => this.rules().skills);
  readonly resource = computed(() =>
    this.record() ? (this.rules().classResource?.(this.record()!.core) ?? null) : null,
  );
  readonly heat = computed(() =>
    this.record() ? (this.resource()?.current(this.record()!.core) ?? 0) : 0,
  );
  constructor() {
    effect(() => {
      this.id();
      this.userId();
      untracked(() => void this.load());
    });
  }
  async load(): Promise<void> {
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.record.set(null);
    this.error.set(null);
    this.message.set(null);
    this.lastRoll.set(null);
    try {
      const record = await this.service.load(this.id());
      if (version === this.loadVersion) {
        this.record.set(record);
        this.hpInput.set(currentHitPoints(record.core));
        this.heatInput.set(this.resource()?.current(record.core) ?? 0);
      }
    } catch (error) {
      if (version === this.loadVersion)
        this.error.set(error instanceof Error ? error.message : 'Could not load character.');
    } finally {
      if (version === this.loadVersion) this.loading.set(false);
    }
  }
  signed(value: number): string {
    return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value}` : '--';
  }
  async saveVitals(patch?: Partial<CharacterCore>, resourceValue?: number): Promise<void> {
    const record = this.record();
    if (!record?.canEdit || this.saving()) return;
    let next: CharacterCore = {
      ...record.core,
      ...(this.hpInput() !== null ? { hpCurrent: this.hpInput()! } : {}),
      ...patch,
    };
    const resource = this.resource();
    const requestedResource = resourceValue ?? this.heatInput();
    if (next.hpCurrent !== undefined) this.hpInput.set(next.hpCurrent);
    if (resource) this.heatInput.set(requestedResource);
    const version = this.loadVersion;
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      if (record.core.hpMax !== null && this.hpInput() === null && patch?.hpCurrent === undefined)
        throw new Error('Enter a current HP value.');
      if (
        next.hpCurrent !== undefined &&
        (!Number.isSafeInteger(next.hpCurrent) || next.hpCurrent < 0)
      )
        throw new Error('Enter a nonnegative whole-number current HP value.');
      if (resource) {
        if (!Number.isSafeInteger(requestedResource) || requestedResource < 0)
          throw new Error(`Enter a nonnegative whole-number ${resource.name} value.`);
        next = resource.setCurrent(next, requestedResource);
      }
      validateSystemCore(next, this.rules());
      if (resource) {
        const value = resource.current(next);
        const cap = resource.maximum(next);
        if (!Number.isSafeInteger(value) || value < 0 || (cap !== null && value > cap))
          throw new Error(`Enter a valid ${resource.name} value within its maximum.`);
      }
      const saved = await this.service.save(record, record.row.name, next);
      if (version !== this.loadVersion) return;
      this.record.set(saved);
      this.hpInput.set(currentHitPoints(saved.core));
      this.heatInput.set(resource?.current(saved.core) ?? 0);
      this.message.set('Resources saved.');
    } catch (error) {
      if (version === this.loadVersion)
        this.error.set(
          error instanceof Error
            ? error.message
            : 'Could not save your resources. Your entered values are kept for retry.',
        );
    } finally {
      this.saving.set(false);
    }
  }
  async changeHp(direction: number): Promise<void> {
    const record = this.record();
    const amount = this.hpAmount();
    const value = this.hpInput();
    if (!record?.canEdit || this.saving() || value === null || record.core.hpMax === null) return;
    if (
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > record.core.hpMax
    ) {
      this.error.set(
        'Enter valid current HP and a nonnegative whole-number damage/healing amount.',
      );
      return;
    }
    await this.saveVitals({
      hpCurrent: Math.min(record.core.hpMax, Math.max(0, value + direction * amount)),
    });
  }
  async changeHeat(direction: number): Promise<void> {
    const record = this.record();
    const amount = this.heatAmount();
    const value = this.heatInput();
    const resource = this.resource();
    if (!record?.canEdit || this.saving() || !resource) return;
    if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(value) || value < 0) {
      this.error.set(`Enter nonnegative whole-number ${resource.name} values.`);
      return;
    }
    const next =
      value + direction * amount * (direction > 0 ? resource.gainMultiplier(record.core) : 1);
    if (next < 0) {
      this.error.set(`Not enough ${resource.name}.`);
      return;
    }
    await this.saveVitals(undefined, Math.min(resource.maximum(record.core) ?? Infinity, next));
  }
  skillTotal(index: number): number {
    const core = this.record()!.core;
    return this.rules().skillBonus(core, this.skills()[index], this.rules());
  }
  weight = inventoryWeight;
  trainingLabel(id: string): string {
    const training = this.record()?.core.skills[id]?.proficiency;
    return training === 'expertise'
      ? 'Expertise'
      : training === 'proficient'
        ? 'Proficient'
        : 'Untrained';
  }
}
