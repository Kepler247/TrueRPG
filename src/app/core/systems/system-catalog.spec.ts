import { describe, expect, it } from 'vitest';
import { catalogInventory, systemCatalog } from './system-catalog';
describe('System test catalogs', () => {
  it('labels all fixtures and distinguishes shared feats from equipment', () => {
    const entries = systemCatalog('501-rads');
    expect(entries.length).toBeGreaterThanOrEqual(6);
    expect(entries.every((entry) => entry.isMock)).toBe(true);
    expect(entries.some((entry) => entry.name === 'Test pistol')).toBe(true);
    expect(entries.filter((entry) => entry.category === 'feat')).toHaveLength(3);
  });
  it('copies inventory entries independently with source metadata', () => {
    const entry = systemCatalog('501-rads').find((entry) => entry.id === 'test-pistol')!;
    const first = catalogInventory(entry, '501-rads'),
      second = catalogInventory(entry, '501-rads');
    expect(first.id).not.toBe(second.id);
    expect(first['catalogId']).toBe(entry.id);
    expect(first['isMock']).toBe(true);
    expect(first.weight).toBe(2);
    expect(() =>
      catalogInventory(
        systemCatalog('501-rads').find((entry) => entry.category === 'feat')!,
        '501-rads',
      ),
    ).toThrow();
  });
});
