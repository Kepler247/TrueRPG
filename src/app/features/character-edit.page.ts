import { RulesetService } from '../core/characters/character-ruleset';
import { ImageUpload } from './image-upload';
import { ImageChange } from '../core/images/image.service';
import { catalogInventory, systemCatalog } from '../core/systems/system-catalog';
import { validateSystemCore } from '../core/systems/system-rules';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckbox, MatCheckboxModule } from '@angular/material/checkbox';
import { AuthService } from '../core/auth/auth.service';
import { CharacterSheetService, SheetRecord } from '../core/characters/character-sheet.service';
import {
  CharacterAbility,
  CharacterCore,
  createCore,
  createEntryId,
  currentHitPoints,
  InventoryEntry,
  inventoryWeight,
  SaveTraining,
  SkillTraining,
  STATS,
  StatKey,
} from '../core/characters/character-core';

@Component({
  selector: 'app-character-sheet',
  imports: [
    ImageUpload,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
  ],
  templateUrl: './character-edit.page.html',
  styleUrl: './character-edit.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterEditPage {
  private readonly service = inject(CharacterSheetService);
  private readonly rulesets = inject(RulesetService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly id = computed(() => this.params().get('id') ?? '');
  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  private loadVersion = 0;
  readonly record = signal<SheetRecord | null>(null);
  imageChanged(change: ImageChange): void {
    this.record.update((record) =>
      record
        ? {
            ...record,
            row: { ...record.row, portrait_path: change.path, updated_at: change.updated_at },
          }
        : null,
    );
  }
  readonly core = signal<CharacterCore>(createCore());
  readonly name = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly dirty = signal(false);
  readonly changingCarryRule = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly stats = STATS;
  readonly rules = computed(() => this.rulesets.get(this.record()?.rulesetKey));
  readonly skills = computed(() => this.rules().skills);
  readonly catalogItems = computed(() =>
    systemCatalog(this.record()?.rulesetKey).filter((entry) => entry.category !== 'feat'),
  );
  readonly catalogFeats = computed(() =>
    systemCatalog(this.record()?.rulesetKey).filter((entry) => entry.category === 'feat'),
  );
  readonly selectedCatalogItem = signal('');
  readonly campaignChoices = signal<{ id: string; name: string }[]>([]);
  readonly selectedCampaign = signal('');
  readonly assigning = signal(false);
  async assignCampaign(): Promise<void> {
    const record = this.record();
    if (!record?.canAssign || this.assigning() || this.saving()) return;
    const version = this.loadVersion;
    this.assigning.set(true);
    this.error.set(null);
    try {
      const saved = await this.service.assign(record, this.selectedCampaign() || null);
      if (version === this.loadVersion) {
        this.record.set(saved);
        this.message.set('Campaign assignment saved.');
      }
    } catch (error) {
      if (version === this.loadVersion)
        this.error.set(error instanceof Error ? error.message : 'Could not assign character.');
    } finally {
      this.assigning.set(false);
    }
  }
  importCatalogItem(): void {
    const entry = this.catalogItems().find((entry) => entry.id === this.selectedCatalogItem());
    if (entry)
      this.patch({
        inventory: [
          ...this.core().inventory,
          catalogInventory(entry, this.record()?.rulesetKey ?? 'base5e'),
        ],
      });
  }
  readonly sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
  readonly pb = computed(() => this.rules().proficiencyBonus(this.core().level));
  readonly initiative = computed(() => this.rules().initiative(this.core(), this.rules()));
  readonly capacity = computed(() => this.rules().carryCapacity(this.core()));
  readonly weight = computed(() => inventoryWeight(this.core()));
  readonly currentHp = computed(() => currentHitPoints(this.core()));
  readonly disabled = computed(() => !this.record()?.canEdit || this.saving() || this.assigning());
  readonly leveling = signal(false);
  readonly pendingLevelUp = signal(false);
  readonly hpGain = signal(0);
  readonly newFeature = signal('');
  readonly allocation = signal<Partial<Record<StatKey, number>>>({});
  readonly hpDieResult = signal(0);
  readonly resource = computed(() => this.rules().classResource?.(this.core()) ?? null);
  readonly heat = computed(() => this.resource()?.current(this.core()) ?? 0);
  readonly heatAmount = signal(1);
  readonly points = computed(
    () => this.rules().statPoints?.(this.core(), this.core().level + 1) ?? 0,
  );
  readonly allocated = computed(() =>
    Object.values(this.allocation()).reduce((sum, n) => sum + (n ?? 0), 0),
  );
  readonly hitDie = computed(() => this.rules().hitDie?.(this.core()) ?? null);
  allocate(stat: StatKey, value: number): void {
    this.allocation.update((a) => ({ ...a, [stat]: value }));
  }
  changeHeat(direction: number): void {
    const resource = this.resource();
    if (!resource || this.disabled()) return;
    const amount = this.heatAmount();
    if (!Number.isSafeInteger(amount) || amount < 0) {
      this.error.set(`Enter a nonnegative whole-number ${resource.name} amount.`);
      return;
    }
    const value =
      this.heat() + direction * amount * (direction > 0 ? resource.gainMultiplier(this.core()) : 1);
    if (value < 0) {
      this.error.set(`Not enough ${resource.name}.`);
      return;
    }
    const cap = resource.maximum(this.core()) ?? Infinity;
    this.patch(resource.setCurrent(this.core(), Math.min(cap, value)));
    this.error.set(null);
  }
  resetResource(): void {
    const resource = this.resource();
    if (resource) this.patch(resource.setCurrent(this.core(), 0));
  }
  fixedHp(): void {
    const die = this.hitDie();
    if (die) this.hpDieResult.set(die / 2 + 1);
  }
  rollHp(): void {
    const die = this.hitDie();
    if (!die) return;
    const bytes = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / die) * die;
    do {
      crypto.getRandomValues(bytes);
    } while (bytes[0] >= limit);
    this.hpDieResult.set((bytes[0] % die) + 1);
  }

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
    this.dirty.set(false);
    this.leveling.set(false);
    this.pendingLevelUp.set(false);
    try {
      const record = await this.service.load(this.id());
      if (version !== this.loadVersion) return;
      this.record.set(record);
      this.selectedCampaign.set(record.row.campaign_id ?? '');
      this.campaignChoices.set([]);
      if (record.canAssign) {
        void this.service
          .assignmentOptions(record)
          .then((choices) => {
            if (version === this.loadVersion) this.campaignChoices.set(choices);
          })
          .catch(() => {
            if (version === this.loadVersion) this.error.set('Could not load matching campaigns.');
          });
      }
      this.name.set(record.row.name);
      this.core.set(structuredClone(record.core));
      if (this.route.snapshot.queryParamMap?.get('levelUp') === '1' && record.canEdit)
        this.beginLevelUp();
    } catch (error) {
      if (version === this.loadVersion)
        this.error.set(error instanceof Error ? error.message : 'Could not load character.');
    } finally {
      if (version === this.loadVersion) this.loading.set(false);
    }
  }
  patch(value: Partial<CharacterCore>): void {
    if (this.disabled()) return;
    this.core.update((core) => ({ ...core, ...value }));
    this.dirty.set(true);
    this.message.set(null);
  }
  rename(name: string): void {
    if (!this.disabled()) {
      this.name.set(name);
      this.dirty.set(true);
    }
  }
  score(stat: StatKey, value: number): void {
    this.patch({ scores: { ...this.core().scores, [stat]: value } });
  }
  saveTraining(stat: StatKey, patch: Partial<SaveTraining>): void {
    this.patch({
      saves: { ...this.core().saves, [stat]: { ...this.core().saves[stat], ...patch } },
    });
  }
  skillTraining(id: string, patch: Partial<SkillTraining>): void {
    this.patch({
      skills: {
        ...this.core().skills,
        [id]: { ...(this.core().skills[id] ?? { proficiency: 'none', bonus: 0 }), ...patch },
      },
    });
  }
  speed(patch: Partial<CharacterCore['speed']>): void {
    this.patch({ speed: { ...this.core().speed, ...patch } });
  }
  modifier(score: number): number {
    return this.rules().abilityModifier(score);
  }
  saveBonus(stat: StatKey): number {
    return this.rules().savingThrow(this.core(), stat, this.rules());
  }
  skillTotal(index: number): number {
    return this.rules().skillBonus(this.core(), this.skills()[index], this.rules());
  }
  signed(value: number): string {
    return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value}` : '--';
  }
  addItem(): void {
    this.patch({
      inventory: [
        ...this.core().inventory,
        { id: createEntryId(), name: '', quantity: 1, weight: 0, description: '' },
      ],
    });
  }
  item(id: string, patch: Partial<InventoryEntry>): void {
    this.patch({
      inventory: this.core().inventory.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }
  removeItem(id: string): void {
    this.patch({ inventory: this.core().inventory.filter((item) => item.id !== id) });
  }
  addAbility(): void {
    this.patch({
      abilities: [
        ...this.core().abilities,
        {
          id: createEntryId(),
          name: '',
          kind: 'feature',
          description: '',
          spellLevel: null,
          usesMax: null,
        },
      ],
    });
  }
  resetAbilityUses(id: string): void {
    this.patch({ abilityUses: { ...this.core().abilityUses, [id]: 0 } });
  }
  ability(id: string, patch: Partial<CharacterAbility>): void {
    this.patch({
      abilities: this.core().abilities.map((ability) =>
        ability.id === id ? { ...ability, ...patch } : ability,
      ),
    });
  }
  removeAbility(id: string): void {
    this.patch({ abilities: this.core().abilities.filter((ability) => ability.id !== id) });
  }
  beginLevelUp(): void {
    if (
      this.disabled() ||
      this.pendingLevelUp() ||
      this.core().level >= (this.rules().maxLevel ?? 20)
    )
      return;
    this.hpGain.set(0);
    this.newFeature.set('');
    this.allocation.set({});
    this.fixedHp();
    this.leveling.set(true);
  }
  async applyLevelUp(): Promise<void> {
    const core = this.core();
    if (
      this.disabled() ||
      this.pendingLevelUp() ||
      !this.leveling() ||
      core.level >= (this.rules().maxLevel ?? 20)
    )
      return;
    const feat = this.newFeature().trim();
    let featInstead = false;
    try {
      featInstead = this.points() > 0 && (this.rules().featReplacesPoints?.(core, feat) ?? false);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Invalid feat choice.');
      return;
    }
    if (this.rules().featRequired?.(core.level + 1) && !feat) {
      this.error.set('Record your shared feat choice for this level.');
      return;
    }
    if (
      this.allocated() !== (featInstead ? 0 : this.points()) ||
      Object.values(this.allocation()).some((n) => !Number.isInteger(n) || n! < 0 || n! > 2)
    ) {
      this.error.set(`Allocate exactly ${featInstead ? 0 : this.points()} ability-score points.`);
      return;
    }
    const scores = { ...core.scores };
    for (const stat of STATS) {
      const gain = this.allocation()[stat.key] ?? 0;
      const cap = this.rules().improvementMax;
      if (cap != null && gain && scores[stat.key] + gain > cap) {
        this.error.set(`Ability-score improvements cannot raise a score above ${cap}.`);
        return;
      }
      scores[stat.key] += gain;
    }
    const die = this.hitDie();
    if (
      die &&
      (!Number.isInteger(this.hpDieResult()) || this.hpDieResult() < 1 || this.hpDieResult() > die)
    ) {
      this.error.set(`Enter a d${die} result from 1 to ${die}.`);
      return;
    }
    const conDelta = this.modifier(scores.con) - this.modifier(core.scores.con);
    const hpIncrease = die
      ? Math.max(1, this.hpDieResult() + this.modifier(scores.con)) +
        (this.rules().hpPerLevelBonus?.(core) ?? 0)
      : this.hpGain();
    if (core.hpMax === null || !Number.isInteger(this.hpGain()) || this.hpGain() < 0) {
      this.error.set('Set maximum HP first, then enter a nonnegative whole-number HP increase.');
      return;
    }
    const selectedFeat = this.catalogFeats().find(
      (entry) => entry.name === this.newFeature().trim(),
    );
    const abilities = this.newFeature().trim()
      ? [
          ...core.abilities,
          {
            id: createEntryId(),
            name: this.newFeature().trim(),
            kind: selectedFeat ? 'feat' : 'feature',
            description: selectedFeat?.description ?? `Gained at level ${core.level + 1}.`,
            spellLevel: null,
            usesMax: null,
            ...(selectedFeat ? { isMock: selectedFeat.isMock, catalogId: selectedFeat.id } : {}),
          },
        ]
      : core.abilities;
    let next: CharacterCore = {
      ...core,
      level: core.level + 1,
      scores,
      hpMax: core.hpMax + hpIncrease + conDelta * core.level,
      abilities,
    };
    next = this.rules().advance?.(next) ?? next;
    this.patch(next);
    this.pendingLevelUp.set(true);
    this.leveling.set(false);
    this.error.set(null);
    await this.save();
    if (!this.dirty() && !this.error()) this.message.set('Level-up saved.');
  }
  async save(): Promise<void> {
    const record = this.record();
    if (!record || this.disabled()) return;
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    const version = this.loadVersion;
    const completingLevelUp = this.pendingLevelUp();
    try {
      validateSystemCore(this.core(), this.rules());
      const saved = await this.service.save(record, this.name(), this.core());
      if (version !== this.loadVersion) return;
      this.record.set(saved);
      this.name.set(saved.row.name);
      this.core.set(structuredClone(saved.core));
      this.dirty.set(false);
      this.pendingLevelUp.set(false);
      this.message.set('Character saved.');
      if (completingLevelUp) await this.router.navigate(['/characters', saved.row.id]);
    } catch (error) {
      if (version === this.loadVersion)
        this.error.set(error instanceof Error ? error.message : 'Could not save character.');
    } finally {
      this.saving.set(false);
    }
  }
  async setCarryRule(enforce: boolean, checkbox?: MatCheckbox): Promise<void> {
    const record = this.record();
    if (!record || this.changingCarryRule()) return;
    this.changingCarryRule.set(true);
    this.error.set(null);
    const version = this.loadVersion;
    try {
      const saved = await this.service.setCarryRule(record, enforce);
      if (version === this.loadVersion)
        this.record.update((current) =>
          current ? { ...current, enforceCarryWeight: saved } : current,
        );
    } catch (error) {
      if (version === this.loadVersion)
        this.error.set(error instanceof Error ? error.message : 'Could not change the rule.');
    } finally {
      this.changingCarryRule.set(false);
      if (checkbox) checkbox.checked = this.record()?.enforceCarryWeight ?? true;
    }
  }
  canLeave(): boolean {
    return !this.dirty() || window.confirm('Discard unsaved character changes?');
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
