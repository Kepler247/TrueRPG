import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { GAME_SYSTEMS } from '../core/models/game-systems';

interface ReferencePage {
  number: number;
  category: string;
  blocks: { kind: string; text: string }[];
}
interface ReferenceDocument {
  title: string;
  revision: string;
  sourceFile: string;
  pageCount: number;
  pages: ReferencePage[];
}
@Component({
  selector: 'app-system-hub',
  imports: [RouterLink, FormsModule],
  template: `
    <a routerLink="/systems">All systems</a>
    <h1>{{ system()?.name ?? 'System not found' }}</h1>
    <p>{{ system()?.description }}</p>
    @if (system(); as system) {
      <div class="tools">
        <label
          >Search reference<input
            type="search"
            [ngModel]="query()"
            (ngModelChange)="query.set($event); selected.set(0)"
            placeholder="Faction, spell, class, item..."
        /></label>
        <label
          >Read<select
            [ngModel]="category()"
            (ngModelChange)="category.set($event); selected.set(0)"
          >
            <option value="all">Everything</option>
            <option value="lore">Lore</option>
            <option value="rules">Rules</option>
          </select></label
        >
      </div>
      @if (system.slug === '501-rads') {
        <aside>
          <strong>Draft 1 &middot; author clarifications</strong>
          <p>
            Maximum level 12. Gain two stat points every level; scores may exceed 20. Shared feats
            at 3, 6, 9, 12 are awaiting definition. Gunslingers use d10 HP. Fan the Hammer costs 2
            Heat. The original PDF is preserved below.
          </p>
        </aside>
      } @else {
        <aside>
          <strong>Plain 5E &middot; 2014 SRD 5.1</strong>
          <p>
            Complete open rules, including races, classes, equipment, spells, monsters, and GM
            guidance. The shared character foundation uses these calculations. Class and race
            choices initialize HP, speed, scores, and saving throws; use the reference for detailed
            choices and combat resolution.
          </p>
          <p>
            This work includes material taken from the System Reference Document 5.1 (&ldquo;SRD
            5.1&rdquo;) by Wizards of the Coast LLC, available at
            <a href="https://dnd.wizards.com/resources/systems-reference-document"
              >the official SRD site</a
            >. The SRD 5.1 is licensed under the
            <a href="https://creativecommons.org/licenses/by/4.0/legalcode"
              >Creative Commons Attribution 4.0 International License</a
            >.
          </p>
        </aside>
      }
      @if (document(); as doc) {
        <p>
          <a [href]="assetRoot() + '/' + doc.sourceFile" target="_blank" rel="noopener"
            >Open original PDF ({{ doc.pageCount }} pages)</a
          >
          &middot; {{ matches().length }} matching pages
        </p>
        <label class="jump"
          >Jump to page or section<select
            [ngModel]="selected()"
            (ngModelChange)="selected.set(+$event)"
          >
            @for (page of matches(); track page.number; let i = $index) {
              <option [value]="i">{{ pageLabel(page) }}</option>
            }
          </select></label
        >
        <nav aria-label="Reference pages">
          <button (click)="selected.set(selected() - 1)" [disabled]="selected() <= 0">
            Previous</button
          ><span>Page {{ current()?.number ?? '--' }}</span
          ><button
            (click)="selected.set(selected() + 1)"
            [disabled]="selected() >= matches().length - 1"
          >
            Next
          </button>
        </nav>
        @if (current(); as page) {
          <article [class.rads]="system.slug === '501-rads' && page.category === 'lore'">
            @for (block of page.blocks; track $index) {
              @if (block.kind === 'heading') {
                <h2>{{ block.text }}</h2>
              } @else {
                <p [class.bullet]="block.kind === 'bullet'">{{ block.text }}</p>
              }
            }
          </article>
        } @else {
          <p>No pages match your search.</p>
        }
      } @else {
        <p role="status">{{ error() || 'Loading reference...' }}</p>
      }
    }
  `,
  styleUrl: './system-hub.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemHubPage {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly system = computed(() => GAME_SYSTEMS.find((s) => s.slug === this.params().get('slug')));
  readonly document = signal<ReferenceDocument | null>(null);
  readonly error = signal('');
  readonly query = signal('');
  readonly category = signal('all');
  readonly selected = signal(0);
  readonly assetRoot = computed(
    () => `/systems/${this.system()?.slug === '501-rads' ? '501-rads' : '5e'}`,
  );
  readonly matches = computed(
    () =>
      this.document()?.pages.filter(
        (p) =>
          (this.category() === 'all' || p.category === this.category()) &&
          p.blocks.some((b) => b.text.toLowerCase().includes(this.query().trim().toLowerCase())),
      ) ?? [],
  );
  readonly current = computed<ReferencePage | undefined>(() => this.matches()[this.selected()]);
  constructor() {
    effect((onCleanup) => {
      const system = this.system();
      const root = this.assetRoot();
      this.document.set(null);
      this.error.set('');
      this.selected.set(0);
      if (!system) return;
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      void fetch(`${root}/${system.slug === '501-rads' ? 'draft-1' : 'srd-5-1'}.json`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Reference could not be loaded. Please retry.');
          const doc = (await response.json()) as ReferenceDocument;
          if (!controller.signal.aborted) this.document.set(doc);
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            this.error.set(
              error instanceof Error ? error.message : 'Reference could not be loaded.',
            );
        });
    });
  }
  pageLabel(page: ReferencePage): string {
    return `${page.number}: ${page.blocks.find((b) => b.kind === 'heading')?.text ?? page.blocks[0]?.text.slice(0, 60) ?? 'Continued'}`;
  }
}
