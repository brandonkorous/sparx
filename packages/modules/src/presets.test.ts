import { describe, expect, it } from 'vitest';

import {
  ModulePresetRegistry,
  toModulePresetView,
  type ModulePreset,
  type ModuleSlug,
} from './index';

// A minimal preset stub — install/isInstalled are no-ops; the registry only
// indexes metadata and routes calls, it never inspects the bodies.
function stub(module: ModuleSlug, slug: string, extra: Partial<ModulePreset> = {}): ModulePreset {
  return {
    module,
    slug,
    kind: 'fitment',
    name: `${module}:${slug}`,
    description: 'desc',
    iconKey: 'boxes',
    tags: [],
    summary: [],
    isInstalled: () => Promise.resolve(false),
    install: () => Promise.resolve({ id: `${module}-${slug}` }),
    ...extra,
  };
}

describe('ModulePresetRegistry', () => {
  it('rejects duplicate (module, slug) keys', () => {
    expect(() => new ModulePresetRegistry([stub('commerce', 'a'), stub('commerce', 'a')])).toThrow(
      /Duplicate module preset: commerce:a/
    );
  });

  it('allows the same slug across different modules', () => {
    const reg = new ModulePresetRegistry([stub('commerce', 'a'), stub('crm', 'a')]);
    expect(reg.all()).toHaveLength(2);
  });

  it('forModules filters to the enabled set', () => {
    const reg = new ModulePresetRegistry([
      stub('commerce', 'a'),
      stub('commerce', 'b'),
      stub('crm', 'c'),
    ]);
    const commerceOnly = reg.forModules(['commerce']);
    expect(commerceOnly.map((p) => p.slug).sort()).toEqual(['a', 'b']);
    expect(reg.forModules([])).toHaveLength(0);
    expect(reg.forModules(['cms'])).toHaveLength(0);
  });

  it('get resolves by (module, slug) and returns undefined for unknown', () => {
    const reg = new ModulePresetRegistry([stub('commerce', 'a')]);
    expect(reg.get('commerce', 'a')?.slug).toBe('a');
    expect(reg.get('commerce', 'missing')).toBeUndefined();
    expect(reg.get('crm', 'a')).toBeUndefined();
  });
});

describe('toModulePresetView', () => {
  it('projects the preset metadata and folds in the installed flag', () => {
    const preset = stub('commerce', 'fitment-vehicle', {
      kind: 'fitment',
      name: 'Vehicle',
      description: 'Make → Model → Engine',
      iconKey: 'car',
      tags: ['fitment', 'auto'],
      summary: [{ label: 'Make → Model → Engine · Year' }, { label: '4 makes', tone: 'module' }],
    });
    const view = toModulePresetView(preset, true);
    expect(view).toEqual({
      module: 'commerce',
      slug: 'fitment-vehicle',
      kind: 'fitment',
      name: 'Vehicle',
      description: 'Make → Model → Engine',
      iconKey: 'car',
      tags: ['fitment', 'auto'],
      summary: [{ label: 'Make → Model → Engine · Year' }, { label: '4 makes', tone: 'module' }],
      installed: true,
    });
    // The view carries no functions — it is wire-safe.
    expect('install' in view).toBe(false);
    expect('isInstalled' in view).toBe(false);
  });
});
