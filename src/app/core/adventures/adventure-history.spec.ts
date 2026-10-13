import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AdventureHistory } from './adventure-history';
import { sortAdventures } from './adventure-history';
describe('Adventure sorting', () => {
  const rows = [
    { id: 'b', name: 'Beta', system_id: 'a' },
    { id: 'a', name: 'alpha', system_id: 'z' },
    { id: 'c', name: 'Gamma', system_id: 'a' },
  ];
  it('sorts names in either direction without modifying the loaded collection', () => {
    expect(
      sortAdventures(
        rows,
        'name',
        (id) => id,
        () => 0,
      ).map((r) => r.id),
    ).toEqual(['a', 'b', 'c']);
    expect(
      sortAdventures(
        rows,
        'name-desc',
        (id) => id,
        () => 0,
      ).map((r) => r.id),
    ).toEqual(['c', 'b', 'a']);
    expect(rows[0].id).toBe('b');
  });
  it('sorts by system display name then character or campaign name', () => {
    expect(
      sortAdventures(
        rows,
        'system',
        (id) => (id === 'a' ? '5E' : 'D&DS'),
        () => 0,
      ).map((r) => r.id),
    ).toEqual(['b', 'c', 'a']);
  });
  it('puts opened records first and uses name order for unseen entries', () => {
    expect(
      sortAdventures(
        rows,
        'recent',
        (id) => id,
        (id) => (id === 'c' ? 10 : 0),
      ).map((r) => r.id),
    ).toEqual(['c', 'a', 'b']);
  });
});

describe('Browser adventure preferences', () => {
  it('persists separate sort choices and history for each account', () => {
    const user = signal({ id: 'sort-test-a' });
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { user } }] });
    const history = TestBed.inject(AdventureHistory);
    localStorage.removeItem('rpg-adventures:sort-test-a');
    localStorage.removeItem('rpg-adventures:sort-test-b');
    history.setSort('characters', 'recent');
    history.setSort('campaigns', 'system');
    history.open('characters', 'one');
    expect(history.opened('characters', 'one')).toBeGreaterThan(0);
    user.set({ id: 'sort-test-b' });
    expect(history.sort('characters')).toBe('name');
    expect(history.opened('characters', 'one')).toBe(0);
    user.set({ id: 'sort-test-a' });
    expect(history.sort('characters')).toBe('recent');
    expect(history.sort('campaigns')).toBe('system');
    localStorage.removeItem('rpg-adventures:sort-test-a');
    localStorage.removeItem('rpg-adventures:sort-test-b');
  });
  it('recovers from malformed stored preferences', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal({ id: 'sort-test-corrupt' }) } },
      ],
    });
    localStorage.setItem('rpg-adventures:sort-test-corrupt', 'not json');
    const history = TestBed.inject(AdventureHistory);
    expect(history.sort('characters')).toBe('name');
    expect(() => history.open('campaigns', 'one')).not.toThrow();
    localStorage.removeItem('rpg-adventures:sort-test-corrupt');
  });
});
