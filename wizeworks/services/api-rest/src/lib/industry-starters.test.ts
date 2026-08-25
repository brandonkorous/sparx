import { describe, expect, it } from 'vitest';

import { toIndustryStarterView, type ModuleSlug } from '@wizeworks/auth';

import { industryAuditPayload, starterRegistry } from './industry-starters';
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

/**
 * The audit row an install leaves behind (issue 174).
 *
 * A starter sorts every preset into three buckets and the row recorded two of
 * them, so an install that found all fifteen presets already present wrote
 * `installed: 0, skipped: 0`. Read months later, next to an unexplained location
 * in somebody's stock list, that line says "this install did nothing" — and it
 * sent the reader looking in the wrong system.
 *
 * These assert the property that was missing: three different outcomes must not
 * produce the same sentence.
 */
describe('the audit row an industry install leaves behind', () => {
  const ref = (module: string, slug: string) =>
    ({ module, slug }) as (typeof ALL)[number]['presets'][number];

  const apparel = ALL.find((s) => s.slug === 'apparel');

  it('distinguishes "nothing to do" from "nothing applied"', () => {
    const presets = apparel?.presets ?? [ref('commerce', 'a'), ref('crm', 'b')];

    const allPresent = industryAuditPayload('apparel', {
      installed: [],
      alreadyInstalled: [...presets],
      skipped: [],
    });
    const allSkipped = industryAuditPayload('apparel', {
      installed: [],
      alreadyInstalled: [],
      skipped: [...presets],
    });
    const genuinelyEmpty = industryAuditPayload('apparel', {
      installed: [],
      alreadyInstalled: [],
      skipped: [],
    });

    // All three used to serialise identically. None of them may now.
    expect(allPresent).not.toEqual(allSkipped);
    expect(allPresent).not.toEqual(genuinelyEmpty);
    expect(allSkipped).not.toEqual(genuinelyEmpty);

    expect(allPresent.alreadyPresent).toBe(presets.length);
    expect(allSkipped.skipped).toBe(presets.length);
    expect(genuinelyEmpty.alreadyPresent).toBe(0);
  });

  it('names what it did, not only how much', () => {
    const payload = industryAuditPayload('apparel', {
      installed: [ref('commerce', 'tax-us-sales')],
      alreadyInstalled: [ref('crm', 'vip-customers')],
      skipped: [ref('email', 'newsletter-campaign')],
    });
    expect(payload.installedPresets).toEqual(['commerce/tax-us-sales']);
    expect(payload.alreadyPresentPresets).toEqual(['crm/vip-customers']);
    expect(payload.skippedPresets).toEqual(['email/newsletter-campaign']);
  });

  it('accounts for every preset the starter declares', () => {
    // The three buckets partition the starter — a preset that falls out of all
    // three is work nothing records, which is the whole failure mode.
    for (const s of ALL) {
      const payload = industryAuditPayload(s.slug, {
        installed: s.presets.slice(0, 1),
        alreadyInstalled: s.presets.slice(1, 2),
        skipped: s.presets.slice(2),
      });
      const total =
        Number(payload.installed) + Number(payload.alreadyPresent) + Number(payload.skipped);
      expect(total).toBe(s.presets.length);
    }
  });
});
