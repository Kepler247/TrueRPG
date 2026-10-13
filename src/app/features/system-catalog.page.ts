import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { GAME_SYSTEMS } from '../core/models/game-systems';
import { systemCatalog } from '../core/systems/system-catalog';
@Component({
  selector: 'app-system-catalog',
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a [routerLink]="['/systems', system()?.slug]">Back to system reference</a>
    <h1>{{ system()?.name }} catalog</h1>
    <p>
      Mock entries are labeled for testing. Missing D&DS equipment values are labeled estimates and
      can be replaced as the ruleset develops.
    </p>
    <div class="filters">
      <label
        >Search<input
          type="search"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)" /></label
      ><label
        >Category<select [ngModel]="category()" (ngModelChange)="category.set($event)">
          <option value="all">All entries</option>
          <option value="weapon">Weapons</option>
          <option value="gear">Gear</option>
          <option value="consumable">Consumables</option>
          <option value="feat">Shared feats</option>
        </select></label
      >
    </div>
    <div class="catalog">
      @for (entry of entries(); track entry.id) {
        <article>
          <span class="badge">{{ entry.isMock ? 'MOCK / TEST' : 'RULESET' }}</span>
          <h2>{{ entry.name }}</h2>
          <p>{{ entry.description }}</p>
          @if (entry.weapon) {
            <p>Price: {{ entry.weapon.price }} credits (estimate)</p>
          }
          @if (entry.armor) {
            <p>AC {{ entry.armor.ac }}; price {{ entry.armor.price }} credits (estimates)</p>
          }
          <p>
            {{ entry.category
            }}{{
              entry.category === 'feat' ? ' / Any class' : ' / ' + entry.weight + ' lb (estimate)'
            }}
          </p>
        </article>
      } @empty {
        <p>No entries match.</p>
      }
    </div>
    <p>
      Add catalog equipment from a character's edit page. Shared feat choices appear during
      level-up.
    </p>`,
  styles: `
    :host {
      display: block;
    }
    a,
    input,
    select {
      min-height: 44px;
      font-size: 16px;
    }
    a {
      display: inline-flex;
      align-items: center;
    }
    .filters {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    label {
      display: grid;
      gap: 0.4rem;
      flex: 1;
      min-width: 0;
    }
    input,
    select {
      box-sizing: border-box;
      width: 100%;
      padding: 0.5rem;
    }
    .catalog {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    article {
      border: 1px solid #dddcd5;
      border-radius: 0.75rem;
      padding: 1rem;
      overflow-wrap: anywhere;
    }
    .badge {
      font-size: 0.75rem;
      color: #775519;
      font-weight: 700;
    }
  `,
})
export class SystemCatalogPage {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly system = computed(() =>
    GAME_SYSTEMS.find((system) => system.slug === this.params().get('slug')),
  );
  readonly query = signal('');
  readonly category = signal('all');
  readonly entries = computed(() =>
    this.system()
      ? systemCatalog(this.system()?.rulesetKey).filter(
          (entry) =>
            (this.category() === 'all' || entry.category === this.category()) &&
            `${entry.name} ${entry.description}`.toLowerCase().includes(this.query().toLowerCase()),
        )
      : [],
  );
}
