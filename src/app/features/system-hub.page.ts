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
import {
  ReferencePage,
  ReferenceSection,
  referenceSections,
} from '../core/systems/reference-sections';

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
      <a [routerLink]="['/systems', system.slug, 'catalog']">Items and shared feats</a>
    }
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
          <strong>Complete rules revision &middot; 501 Rads</strong>
          <p>
            Maximum level 12. Gain two stat points every level; scores may exceed 20. Shared feats
            at 3, 6, 9, 12 are awaiting definition. Gunslingers use d8 HP. Six classes, feats,
            equipment, consumables, loot, vehicles and enemies are defined in this revision. Fan the
            Hammer costs 2 Heat. 100 positive and 100 negative mutations are available. Death grants
            a random negative mutation; after 30 game minutes of reconstitution, return at 1 HP.
          </p>
        </aside>
      } @else if (system.slug === 'dnds') {
        <aside>
          <strong>Dogfights and Deep Space</strong>
          <p>
            2014 5E is the foundation, maximum level 20. Technology replaces Arcana. Equipment
            estimates are labeled. Ship combat is available in the original PDF only.
          </p>
          <a routerLink="/systems/5e">Shared 5E rules and attribution</a>
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
            >Open PDF ({{ doc.pageCount }} pages)</a
          >
          &middot; {{ matches().length }} matching sections
        </p>
        <label class="jump"
          >Jump to heading<select [ngModel]="selected()" (ngModelChange)="selected.set(+$event)">
            @for (section of matches(); track section.id; let i = $index) {
              <option [value]="i">{{ section.heading }}</option>
            }
          </select></label
        >
        <nav aria-label="Reference headings">
          <button (click)="selected.set(selected() - 1)" [disabled]="selected() <= 0">
            Previous heading</button
          ><span>{{ current()?.heading ?? '--' }}</span
          ><button
            (click)="selected.set(selected() + 1)"
            [disabled]="selected() >= matches().length - 1"
          >
            Next heading
          </button>
        </nav>
        @if (current(); as page) {
          <article [class.rads]="system.slug === '501-rads'" [class.space]="system.slug === 'dnds'">
            @for (block of page.blocks; track $index) {
              @if (block.kind === 'heading') {
                <h2>{{ block.text }}</h2>
              } @else {
                @if (block.kind === 'table') {
                  <div
                    class="reference-table"
                    role="region"
                    tabindex="0"
                    aria-label="Rules table, scroll horizontally for more columns"
                  >
                    <table>
                      <caption>
                        Reference table
                      </caption>
                      <tbody>
                        @for (row of block.rows ?? []; track $index) {
                          <tr>
                            @for (cell of row; track $index) {
                              <td>{{ cell }}</td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else if (block.kind === 'subheading') {
                  <h3>{{ block.text }}</h3>
                } @else {
                  <p [class.bullet]="block.kind === 'bullet'">{{ block.text }}</p>
                }
              }
            }
          </article>
        } @else {
          <p>No sections match your search.</p>
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
    () =>
      `/systems/${this.system()?.slug === '501-rads' ? '501-rads' : this.system()?.slug === 'dnds' ? 'dnds' : '5e'}`,
  );
  readonly matches = computed(
    () =>
      referenceSections(this.document()?.pages ?? []).filter(
        (p) =>
          p.category !== 'ship-reference' &&
          (this.category() === 'all' || p.category === this.category()) &&
          p.blocks.some((b) => b.text.toLowerCase().includes(this.query().trim().toLowerCase())),
      ) ?? [],
  );
  readonly current = computed<ReferenceSection | undefined>(() => this.matches()[this.selected()]);
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
      void fetch(
        `${root}/${system.slug === '501-rads' ? 'core-1' : system.slug === 'dnds' ? 'original' : 'srd-5-1'}.json`,
        {
          signal: controller.signal,
        },
      )
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
}
