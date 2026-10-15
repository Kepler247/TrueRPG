import { undefinedWeaponReference } from '../core/characters/weapon-reference';
import { InventoryEntry } from '../core/characters/character-core';
import { RadsStatus } from './rads-status';
import { MutationPanel } from './mutation-panel';
import { AdventureHistory } from '../core/adventures/adventure-history';
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
import {
  AbilityActionDefinition,
  CheckSummary,
  RulesetService,
} from '../core/characters/character-ruleset';
import { ImageUpload } from './image-upload';
import { availableHitDice, completeRest, inventoryAction } from '../core/characters/play-actions';
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
  imports: [
    RouterLink,
    MatButtonModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    ImageUpload,
    MutationPanel,
    RadsStatus,
  ],
  templateUrl: './character-summary.page.html',
  styleUrl: './character-summary.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterSummaryPage {
  private readonly history = inject(AdventureHistory);
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
  readonly preparedTriple = signal(false);
  readonly rollChoices = signal<DiceRoll[]>([]);
  abilityAction(id: string): AbilityActionDefinition | undefined {
    return this.record()
      ? this.rules()
          .abilityActions?.(this.record()!.core)
          .find((action) => action.abilityId === id)
      : undefined;
  }
  chooseRoll(index: number): void {
    const roll = this.rollChoices()[index];
    if (roll) {
      this.lastRoll.set(roll);
      this.rollChoices.set([]);
      this.rollCount.update((n) => n + 1);
    }
  }
  async useAbility(id: string): Promise<void> {
    const record = this.record();
    const resource = this.resource();
    const action = this.abilityAction(id);
    if (
      !record?.canEdit ||
      !resource ||
      !action ||
      this.saving() ||
      this.pendingAction() ||
      this.preparedTriple() ||
      this.rollChoices().length ||
      !record.core.abilities.some((ability) => ability.id === id)
    )
      return;
    if (
      this.hpInput() !== currentHitPoints(record.core) ||
      this.heatInput() !== resource.current(record.core)
    ) {
      this.error.set('Save resource changes before using an ability.');
      return;
    }
    if (resource.current(record.core) < action.cost) {
      this.error.set(`Not enough ${resource.name}.`);
      return;
    }
    const previousRoll = this.lastRoll();
    if (action.rollMode === 'reroll' && !previousRoll) {
      this.error.set('Roll a check first, then use this reroll ability.');
      return;
    }
    let next: CharacterCore;
    try {
      next =
        this.rules().useClassAbility?.(record.core, id, this.abilityChoices()[id] ?? {}) ??
        resource.setCurrent(
          {
            ...record.core,
            abilityUses: {
              ...record.core.abilityUses,
              [id]: (record.core.abilityUses?.[id] ?? 0) + 1,
            },
          },
          resource.current(record.core) - action.cost,
        );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Ability could not be activated.');
      return;
    }
    const version = this.loadVersion;
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      const saved = await this.service.save(record, record.row.name, next);
      if (version !== this.loadVersion) return;
      this.record.set(saved);
      this.hpInput.set(currentHitPoints(saved.core));
      this.heatInput.set(resource.current(saved.core));
      if (action.rollMode === 'reroll' && previousRoll) {
        this.lastRoll.set(this.checkRoll(previousRoll.label, previousRoll.modifier));
        this.rollCount.update((n) => n + 1);
      }
      if (action.rollMode === 'choose-three') this.preparedTriple.set(true);
      this.message.set(
        action.rollMode === 'choose-three'
          ? 'Tap a check modifier to roll three dice and choose any result.'
          : `Ability used; ${action.cost} ${resource.name} spent. Resolve its effect using the feature text.`,
      );
    } catch (error) {
      if (version === this.loadVersion)
        this.error.set(
          error instanceof Error
            ? error.message
            : 'Ability could not be saved. No roll was applied.',
        );
    } finally {
      this.saving.set(false);
    }
  }
  readonly unknownWeights = computed(
    () => this.record()?.core.inventory.some((i) => i['weightKnown'] === false) ?? false,
  );
  readonly checkTags = signal<string[]>([]);
  readonly abilityChoices = signal<Record<string, Record<string, string>>>({});
  chooseAbilityOption(id: string, key: string, value: string): void {
    this.abilityChoices.update((all) => ({ ...all, [id]: { ...all[id], [key]: value } }));
  }
  private readonly checkSummaries = computed(() => {
    const core = this.record()?.core,
      describe = this.rules().checkSummary;
    const labels = [
      ...STATS.flatMap((stat) => [stat.name + ' check', stat.name + ' saving throw']),
      ...this.skills().map((skill) => skill.name),
      'Initiative',
    ];
    return new Map(
      core && describe
        ? labels.map((label) => [label, describe(core, label, this.checkTags())])
        : [],
    );
  });
  checkSummary(label: string, modifier: number): CheckSummary {
    return (
      this.checkSummaries().get(label) ?? { modifier, mode: 'normal', automaticFailure: false }
    );
  }
  checkText(check: CheckSummary): string {
    return check.automaticFailure
      ? 'Auto fail'
      : this.signed(check.modifier) +
          (check.mode === 'advantage' ? ' A' : check.mode === 'disadvantage' ? ' D' : '');
  }
  checkTitle(label: string, check: CheckSummary): string {
    return `${label}: ${check.automaticFailure ? 'automatic failure' : this.signed(check.modifier) + (check.mode === 'normal' ? '' : ', ' + check.mode)}`;
  }
  private checkRoll(label: string, modifier: number, forcedSingle = false): DiceRoll {
    return this.record() && this.rules().checkRoll
      ? this.rules().checkRoll!(
          this.record()!.core,
          label,
          modifier,
          this.checkTags(),
          forcedSingle,
        )
      : rollWithModifier(label, modifier, this.rules().checkDie ?? 20);
  }
  roll(label: string, modifier: number): void {
    try {
      this.performRoll(label, modifier);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Check could not be rolled.');
    }
  }
  private performRoll(label: string, modifier: number): void {
    if (this.saving()) return;
    if (this.rollChoices().length) {
      this.error.set('Choose one of the three results first.');
      return;
    }
    if (this.preparedTriple()) {
      this.lastRoll.set(null);
      this.rollChoices.set(Array.from({ length: 3 }, () => this.checkRoll(label, modifier, true)));
      this.preparedTriple.set(false);
      return;
    }
    this.lastRoll.set(this.checkRoll(label, modifier));
    this.rollCount.update((n) => n + 1);
  }
  readonly selectedAmmo = signal('');
  private readonly weaponReferences = computed(() => {
    const core = this.record()?.core;
    const reference = this.rules().weaponReference ?? undefinedWeaponReference;
    return new Map(core?.inventory.map((entry) => [entry.id, reference(core, entry)]) ?? []);
  });
  weaponReference(entry: InventoryEntry) {
    return this.weaponReferences().get(entry.id) ?? null;
  }
  async adjustWeaponAmmo(id: string, delta: number): Promise<void> {
    const record = this.record();
    if (!record?.canEdit || this.saving() || this.pendingAction() || !this.rules().adjustWeaponAmmo)
      return;
    try {
      const action = this.rules().adjustWeaponAmmo!(record.core, id, delta);
      await this.savePlayAction(action.core, action.message);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Ammunition could not be saved.');
    }
  }
  async reloadWeapon(id: string): Promise<void> {
    const record = this.record();
    if (!record?.canEdit || this.saving() || this.pendingAction() || !this.rules().reloadWeapon)
      return;
    try {
      const action = this.rules().reloadWeapon!(record.core, id, this.selectedAmmo() || undefined);
      await this.savePlayAction(action.core, action.message);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Reload could not be completed.');
    }
  }
  readonly restConfirmed = signal(false);
  readonly pendingAction = signal<{ core: CharacterCore; message: string } | null>(null);
  readonly hitDiceAvailable = computed(() =>
    this.record() ? availableHitDice(this.record()!.core) : 0,
  );
  async rest(kind: 'short' | 'long', spend = false): Promise<void> {
    const record = this.record();
    if (!record?.canEdit || this.saving() || this.pendingAction()) return;
    if (this.recovering()) {
      this.error.set('Finish the 30-minute reconstitution before resting.');
      return;
    }
    if (!this.restConfirmed()) {
      this.error.set('Confirm the rest conditions first.');
      return;
    }
    try {
      const core = completeRest(record.core, this.rules(), kind, spend);
      await this.savePlayAction(
        core,
        `${kind === 'short' ? 'Short' : 'Long'} rest saved; ${core.lastRest!.healing} HP recovered.`,
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Rest could not be completed.');
    }
  }
  async consumeItem(id: string): Promise<void> {
    const record = this.record();
    if (!record?.canEdit || this.saving() || this.pendingAction() || !this.rules().consumeItem)
      return;
    if (!this.playReady()) {
      this.error.set('Save HP/resource edits first.');
      return;
    }
    try {
      const action = this.rules().consumeItem!(record.core, id);
      await this.savePlayAction(action.core, action.message);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Item could not be consumed.');
    }
  }
  async inventoryAction(id: string, action: 'equip' | 'add' | 'remove'): Promise<void> {
    const record = this.record();
    if (!record?.canEdit || this.saving() || this.pendingAction()) return;
    await this.savePlayAction(inventoryAction(record.core, id, action), 'Inventory saved.');
  }
  async savePlayAction(core: CharacterCore, message: string, retry = false): Promise<void> {
    const record = this.record();
    if (!record?.canEdit || this.saving()) return;
    if (
      !retry &&
      (this.hpInput() !== currentHitPoints(record.core) ||
        this.heatInput() !== (this.resource()?.current(record.core) ?? 0))
    ) {
      this.error.set('Save HP and resource changes first.');
      return;
    }
    const version = this.loadVersion;
    this.pendingAction.set({ core, message });
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      const saved = await this.service.save(record, record.row.name, core);
      if (version !== this.loadVersion) return;
      this.record.set(saved);
      this.hpInput.set(currentHitPoints(saved.core));
      this.heatInput.set(this.resource()?.current(saved.core) ?? 0);
      this.pendingAction.set(null);
      this.message.set(message);
      this.restConfirmed.set(false);
      this.preparedTriple.set(false);
      this.rollChoices.set([]);
    } catch (error) {
      if (version === this.loadVersion)
        this.error.set(
          error instanceof Error ? error.message : 'Save failed. Retry keeps the same result.',
        );
    } finally {
      if (version === this.loadVersion) this.saving.set(false);
    }
  }
  async useLimitedAbility(id: string): Promise<void> {
    const record = this.record();
    if (!record?.canEdit || this.saving() || this.pendingAction()) return;
    const ability = record.core.abilities.find((entry) => entry.id === id);
    if (!ability || ability.usesMax === null || this.abilityAction(id)) return;
    const used = record.core.abilityUses?.[id] ?? 0;
    if (used >= ability.usesMax) {
      this.error.set('No uses remaining.');
      return;
    }
    await this.savePlayAction(
      { ...record.core, abilityUses: { ...record.core.abilityUses, [id]: used + 1 } },
      'Ability use saved. Resolve its effect using the feature text.',
    );
  }
  async retryAction(): Promise<void> {
    const pending = this.pendingAction();
    if (pending) await this.savePlayAction(pending.core, pending.message, true);
  }
  readonly recovering = computed(
    () => !!this.record() && (this.rules().mutations?.recovering(this.record()!.core) ?? false),
  );
  readonly playReady = computed(() => {
    const record = this.record();
    return (
      !!record &&
      this.hpInput() === currentHitPoints(record.core) &&
      this.heatInput() === (this.resource()?.current(record.core) ?? 0)
    );
  });
  readonly hpInput = signal<number | null>(null);
  readonly heatInput = signal(0);
  readonly damageType = signal('Untyped');
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
    this.pendingAction.set(null);
    this.restConfirmed.set(false);
    this.error.set(null);
    this.message.set(null);
    this.lastRoll.set(null);
    this.preparedTriple.set(false);
    this.rollChoices.set([]);
    try {
      const record = await this.service.load(this.id());
      if (version === this.loadVersion) {
        this.record.set(record);
        this.history.open('characters', record.row.id);
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
    if (!record?.canEdit || this.saving() || this.pendingAction()) return;
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
      if (this.rules().healthChange && next.hpCurrent !== undefined) {
        next = this.rules().healthChange!(
          { ...next, hpCurrent: currentHitPoints(record.core) ?? undefined },
          next.hpCurrent,
        );
      }
      validateSystemCore(next, this.rules());
      if (this.rules().healthChange)
        this.pendingAction.set({ core: next, message: 'Health and resources saved.' });
      const saved = await this.service.save(record, record.row.name, next);
      if (version !== this.loadVersion) return;
      this.record.set(saved);
      this.hpInput.set(currentHitPoints(saved.core));
      this.heatInput.set(resource?.current(saved.core) ?? 0);
      this.pendingAction.set(null);
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
    if (direction < 0 && this.rules().takeDamage) {
      if (!this.playReady()) {
        this.error.set('Save HP/resource edits first.');
        return;
      }
      try {
        await this.savePlayAction(
          this.rules().takeDamage!(record.core, amount, this.damageType(), this.checkTags()),
          'Damage resolved, including active defenses and death-prevention effects.',
        );
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : 'Damage could not be applied.');
      }
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
    return this.rules().skillBonus(core, this.skills()[index], this.rules(), this.checkTags());
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
