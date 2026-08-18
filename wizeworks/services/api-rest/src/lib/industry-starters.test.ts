import { describe, expect, it } from 'vitest';

import { toIndustryStarterView, type ModuleSlug } from '@wizeworks/auth';

import { starterRegistry } from './industry-starters';
import { presetRegistry } from './preset-registry';

// Industry starters compose module presets by (module, slug) REFERENCE. The
// reference is just data, so the one thing a test must guarantee is that every
// ref resolves to a real preset in the aggregated registry — otherwise a typo
// would silently skip a slice at install time. Importing the registries also runs
// their module-load (a smoke test that no definition throws).

const ALL = starterRegistry.all();

describe('industry starters', () => {
  it('registers at least a few varied starters', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(6);
  });

  it('every starter has complete metadata + at least one preset ref', () => {
    for (const s of ALL) {
      expect(s.slug).toMatch(/^[a-z0-9-]+$/);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.iconKey.length).toBeGreaterThan(0);
      expect(s.presets.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate (module, slug) refs within a starter', () => {
    for (const s of ALL) {
      const keys = s.presets.map((p) => `${p.module}:${p.slug}`);
      expect(new Set(keys).size, `${s.slug} has a duplicate ref`).toBe(keys.length);
    }
  });

  it('EVERY preset ref resolves to a real preset of the same module', () => {
    for (const s of ALL) {
      for (const ref of s.presets) {
        const preset = presetRegistry.get(ref.module, ref.slug);
        expect(preset, `${s.slug} → ${ref.module}:${ref.slug} must resolve`).toBeDefined();
        expect(preset?.module).toBe(ref.module);
      }
    }
  });

  it('view scopes applicable presets to enabled modules + marks the active one', () => {
    const starter = ALL[0]!;
    const onlyModule = starter.presets[0]!.module;
    const view = toIndustryStarterView(starter, [onlyModule] as ModuleSlug[], true);
    // Active flag passes through.
    expect(view.active).toBe(true);
    // applicable = refs whose module is enabled (only `onlyModule` here).
    const expectedApplicable = starter.presets.filter((p) => p.module === onlyModule).length;
    expect(view.applicablePresetCount).toBe(expectedApplicable);
    expect(view.applicablePresetCount).toBeLessThanOrEqual(view.totalPresetCount);
    expect(view.enabledModules).toEqual([onlyModule]);
  });

  it('with no modules enabled, nothing is applicable', () => {
    const view = toIndustryStarterView(ALL[0]!, [], false);
    expect(view.applicablePresetCount).toBe(0);
    expect(view.enabledModules).toEqual([]);
    expect(view.active).toBe(false);
  });
});
