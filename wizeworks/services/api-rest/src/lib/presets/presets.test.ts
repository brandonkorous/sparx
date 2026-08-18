import { describe, expect, it } from 'vitest';

import { CMS_CONTENT_TYPES, ContentTypeSchema, cmsPresets } from './cms';
import { emailPresets } from './email';
import { schedulingPresets } from './scheduling';

// The composition-root module presets (cms / scheduling / email) — authored here
// because their module packages don't dep the preset contract. Importing the
// arrays runs the definePreset factories (a module-load smoke test); the
// assertions guard metadata completeness, key uniqueness, and collision-avoidance.

const ALL = [...cmsPresets, ...schedulingPresets, ...emailPresets];

// Built-in content-type keys live in the platform tenant (shared via RLS); our
// content-type presets must not reuse them.
const BUILTIN_CONTENT_TYPE_KEYS = [
  'page',
  'blog_post',
  'landing_page',
  'news_article',
  'case_study',
  'event',
  'team_member',
  'job_posting',
  'help_article',
  'announcement',
];

describe('composition-root module presets', () => {
  it('has no duplicate (module, slug) keys', () => {
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

  it('cmsPresets are module=cms and cover all three kinds', () => {
    for (const preset of cmsPresets) expect(preset.module).toBe('cms');
    const kinds = new Set(cmsPresets.map((p) => p.kind));
    expect(kinds.has('content-types')).toBe(true);
    expect(kinds.has('taxonomy')).toBe(true);
    expect(kinds.has('navigation')).toBe(true);
  });

  it('every CMS content-type schema validates + avoids the built-in keys', () => {
    for (const def of CMS_CONTENT_TYPES) {
      expect(() => ContentTypeSchema.parse(def.schema)).not.toThrow();
      expect(BUILTIN_CONTENT_TYPE_KEYS).not.toContain(def.key);
    }
  });

  it('schedulingPresets are module=scheduling and avoid the built-in "Standard" policy name', () => {
    for (const preset of schedulingPresets) {
      expect(preset.module).toBe('scheduling');
      expect(preset.kind).toBe('scheduling');
    }
    expect(schedulingPresets.length).toBeGreaterThan(0);
  });

  it('emailPresets are module=email of kind email-campaign', () => {
    for (const preset of emailPresets) {
      expect(preset.module).toBe('email');
      expect(preset.kind).toBe('email-campaign');
    }
    expect(emailPresets.length).toBeGreaterThan(0);
  });
});
