import { inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { CollectionKind } from './adventure.service';
export type AdventureSort = 'name' | 'name-desc' | 'system' | 'recent';
@Injectable({ providedIn: 'root' })
export class AdventureHistory {
  private readonly auth = inject(AuthService);
  readonly revision = signal(0);
  private key(): string {
    return `rpg-adventures:${this.auth.user()?.id ?? 'anonymous'}`;
  }
  private read(): {
    opened?: Record<string, number>;
    sorts?: Partial<Record<CollectionKind, AdventureSort>>;
  } {
    try {
      const value = JSON.parse(localStorage.getItem(this.key()) ?? '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }
  private write(value: object): void {
    try {
      localStorage.setItem(this.key(), JSON.stringify(value));
    } catch {
      /* Private or full storage: browsing still works. */
    }
    this.revision.update((n) => n + 1);
  }
  open(kind: CollectionKind, id: string): void {
    const data = this.read();
    this.write({ ...data, opened: { ...data.opened, [`${kind}:${id}`]: Date.now() } });
  }
  opened(kind: CollectionKind, id: string): number {
    this.revision();
    const n = this.read().opened?.[`${kind}:${id}`];
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  }
  sort(kind: CollectionKind): AdventureSort {
    this.revision();
    const value = this.read().sorts?.[kind];
    return value && ['name', 'name-desc', 'system', 'recent'].includes(value) ? value : 'name';
  }
  setSort(kind: CollectionKind, value: AdventureSort): void {
    const data = this.read();
    this.write({ ...data, sorts: { ...data.sorts, [kind]: value } });
  }
}
export function sortAdventures<T extends { id: string; name: string; system_id: string }>(
  rows: readonly T[],
  sort: AdventureSort,
  systemName: (id: string) => string,
  lastOpened: (id: string) => number,
): T[] {
  const name = (a: T, b: T) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) ||
    a.id.localeCompare(b.id);
  return [...rows].sort((a, b) =>
    sort === 'recent'
      ? lastOpened(b.id) - lastOpened(a.id) || name(a, b)
      : sort === 'system'
        ? systemName(a.system_id).localeCompare(systemName(b.system_id), undefined, {
            sensitivity: 'base',
          }) || name(a, b)
        : sort === 'name-desc'
          ? -name(a, b)
          : name(a, b),
  );
}
