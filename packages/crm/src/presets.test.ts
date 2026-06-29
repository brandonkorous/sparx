import { describe, expect, it } from 'vitest';

import { b2bPresets, crmPresets, invoicingPresets } from './presets';

// Importing the preset arrays executes the module-load code (the definePreset
// factories) — a smoke test that nothing throws at import. The slugs/keys must
// also avoid the built-ins each module's activation seeds, or an install would
// hit a unique constraint.

const BUILTIN_PIPELINE_SLUGS = ['sales'];
const BUILTIN_SEGMENT_SLUGS = [
  'high-value',
  'at-risk',
  'b2b-fleet',
  'new-customers',
  'newsletter-subscribers',
  'early-access',
];
const BUILTIN_WORKFLOW_SLUGS = ['invoice', 'service-repair'];

const ALL = [...crmPresets, ...b2bPresets, ...invoicingPresets];

describe('CRM-hosted module presets', () => {
  it('has no duplicate (module, slug) registry keys across all three arrays', () => {
    const keys = ALL.map((p) => `${p.module}:${p.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every preset has complete metadata + install/isInstalled fns', () => {
    for (const preset of ALL) {
      expect(preset.slug).toMatch(/^[a-z0-9-]+$/);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.summary.length).toBeGreaterThan(0);
      expect(typeof preset.install).toBe('function');
      expect(typeof preset.isInstalled).toBe('function');
    }
  });

  it('crmPresets are module=crm and avoid built-in pipeline/segment slugs', () => {
    for (const preset of crmPresets) {
      expect(preset.module).toBe('crm');
      if (preset.kind === 'pipeline') expect(BUILTIN_PIPELINE_SLUGS).not.toContain(preset.slug);
      if (preset.kind === 'segments') expect(BUILTIN_SEGMENT_SLUGS).not.toContain(preset.slug);
    }
    const kinds = new Set(crmPresets.map((p) => p.kind));
    expect(kinds.has('pipeline')).toBe(true);
    expect(kinds.has('segments')).toBe(true);
  });

  it('b2bPresets are module=b2b and cover pricing + approval', () => {
    for (const preset of b2bPresets) expect(preset.module).toBe('b2b');
    const kinds = new Set(b2bPresets.map((p) => p.kind));
    expect(kinds.has('b2b-pricing')).toBe(true);
    expect(kinds.has('b2b-approval')).toBe(true);
  });

  it('invoicingPresets are module=invoicing and avoid built-in workflow slugs', () => {
    for (const preset of invoicingPresets) {
      expect(preset.module).toBe('invoicing');
      expect(BUILTIN_WORKFLOW_SLUGS).not.toContain(preset.slug);
    }
    expect(invoicingPresets.length).toBeGreaterThan(0);
  });
});
