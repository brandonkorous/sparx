import { describe, expect, it } from 'vitest';

import { commercePresets } from './index';

// Importing `commercePresets` executes every preset file's module-load code (the
// FITMENT_DICTIONARIES map, the commercePreset() factories) — so this suite is
// also a smoke test that nothing throws at import (e.g. a temporal-dead-zone
// reference). The install/isInstalled bodies need a DB and run elsewhere.

describe('commercePresets', () => {
  it('has no duplicate (module, slug) registry keys', () => {
    const keys = commercePresets.map((p) => `${p.module}:${p.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every preset is module=commerce with complete metadata', () => {
    for (const preset of commercePresets) {
      expect(preset.module).toBe('commerce');
      expect(preset.slug).toMatch(/^[a-z0-9-]+$/);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.iconKey.length).toBeGreaterThan(0);
      expect(preset.summary.length).toBeGreaterThan(0);
      expect(typeof preset.install).toBe('function');
      expect(typeof preset.isInstalled).toBe('function');
    }
  });

  it('covers every commerce preset kind', () => {
    const kinds = new Set(commercePresets.map((p) => p.kind));
    for (const kind of [
      'fitment',
      'tax',
      'shipping',
      'categories',
      'collections',
      'markup',
      'surcharge',
    ]) {
      expect(kinds.has(kind as (typeof commercePresets)[number]['kind'])).toBe(true);
    }
  });
});
