// The paid modules pause when the bill lapses (sparx persona issue 289).
//
// The banner said "Your trial has ended: paid features are paused" and every pane
// went on working. docs/17 §6 says the paid modules pause in the console while the
// public site rides out its grace week. These pin which modules pause, and that
// the pane mount asks before it draws a surface.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { moduleIsPaused, pausedModules } from './paused';

const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

const lines = [
  { moduleKey: 'commerce', monthlyCents: 4900 },
  { moduleKey: 'b2b', monthlyCents: 9900 },
];
const bill = (phase: string) => ({ billing: { phase } as never, planModules: lines });

describe('which modules pause', () => {
  it('pauses nothing while the trial runs, on a paid plan, or on a custom plan', () => {
    for (const phase of ['trialing', 'active', 'exempt']) {
      expect(pausedModules(bill(phase)).size).toBe(0);
    }
  });

  it('pauses every line on the bill in grace and when the site is offline', () => {
    for (const phase of ['grace', 'suspended']) {
      expect([...pausedModules(bill(phase))].sort()).toEqual(['b2b', 'commerce']);
    }
  });

  it('leaves a free or included module running', () => {
    expect(moduleIsPaused(bill('grace'), 'social')).toBe(false);
    expect(moduleIsPaused(bill('grace'), 'inventory')).toBe(false);
  });

  it('never pauses before the bill has loaded', () => {
    expect(moduleIsPaused(undefined, 'commerce')).toBe(false);
  });

  it('keeps the bill open when Finance itself is a paid line', () => {
    const withFinance = {
      billing: { phase: 'grace' } as never,
      planModules: [...lines, { moduleKey: 'finance', monthlyCents: 2900 }],
    };
    expect(moduleIsPaused(withFinance, 'finance', 'finance.profit')).toBe(true);
    expect(moduleIsPaused(withFinance, 'finance', 'finance.subscription')).toBe(false);
  });
});

describe('the pane mount asks', () => {
  it('draws the paused screen before the surface', () => {
    const source = read('../../components/surface-mount.tsx');
    const paused = source.indexOf('moduleIsPaused(bill, definition.module, descriptor.surface)');
    const surface = source.indexOf('const Surface = definition.component');
    expect(paused).toBeGreaterThan(-1);
    expect(paused).toBeLessThan(surface);
    expect(source).toMatch(/<SurfaceModulePaused\b/);
  });
});
