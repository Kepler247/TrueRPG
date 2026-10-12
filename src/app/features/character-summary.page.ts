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
import { AuthService } from '../core/auth/auth.service';
import { CharacterSheetService, SheetRecord } from '../core/characters/character-sheet.service';
import { RulesetService } from '../core/characters/character-ruleset';
import { inventoryWeight, STATS } from '../core/characters/character-core';

@Component({
  selector: 'app-character-summary',
  imports: [RouterLink, MatButtonModule],
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
  readonly stats = STATS;
  readonly rules = computed(() => this.rulesets.get(this.record()?.rulesetKey));
  readonly skills = computed(() => this.rules().skills);
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
    try {
      const record = await this.service.load(this.id());
      if (version === this.loadVersion) this.record.set(record);
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
