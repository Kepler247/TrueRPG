import { RulesetService } from '../core/characters/character-ruleset';
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
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly id = computed(() => this.params().get('id') ?? '');
  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  private loadVersion = 0;
  readonly record = signal<SheetRecord | null>(null);
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
  readonly sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
  readonly pb = computed(() => this.rules().proficiencyBonus(this.core().level));
  readonly initiative = computed(() => this.rules().initiative(this.core(), this.rules()));
  readonly capacity = computed(() => this.rules().carryCapacity(this.core()));
  readonly weight = computed(() => inventoryWeight(this.core()));
  readonly disabled = computed(() => !this.record()?.canEdit || this.saving());
  readonly leveling = signal(false);
  readonly hpGain = signal(0);
  readonly newFeature = signal('');

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
    try {
      const record = await this.service.load(this.id());
      if (version !== this.loadVersion) return;
      this.record.set(record);
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
    if (this.disabled() || this.core().level >= 20) return;
    this.hpGain.set(0);
    this.newFeature.set('');
    this.leveling.set(true);
  }
  applyLevelUp(): void {
    const core = this.core();
    if (this.disabled() || !this.leveling() || core.level >= 20) return;
    if (core.hpMax === null || !Number.isInteger(this.hpGain()) || this.hpGain() < 0) {
      this.error.set('Set maximum HP first, then enter a nonnegative whole-number HP increase.');
      return;
    }
    const abilities = this.newFeature().trim()
      ? [
          ...core.abilities,
          {
            id: createEntryId(),
            name: this.newFeature().trim(),
            kind: 'feature',
            description: `Gained at level ${core.level + 1}.`,
            spellLevel: null,
            usesMax: null,
          },
        ]
      : core.abilities;
    this.patch({ level: core.level + 1, hpMax: core.hpMax + this.hpGain(), abilities });
    this.leveling.set(false);
    this.error.set(null);
    this.message.set('Level-up applied to your draft. Save the sheet to keep it.');
  }
  async save(): Promise<void> {
    const record = this.record();
    if (!record || this.disabled()) return;
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    const version = this.loadVersion;
    try {
      const saved = await this.service.save(record, this.name(), this.core());
      if (version !== this.loadVersion) return;
      this.record.set(saved);
      this.name.set(saved.row.name);
      this.core.set(structuredClone(saved.core));
      this.dirty.set(false);
      this.message.set('Character saved.');
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
