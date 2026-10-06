// sparx persona issue 025: four of the six "Get set up" buttons opened the wrong
// screen, and one named a screen that does not exist. Every href the server sends
// (wizeworks/services/api-rest/src/routes/v1/tenant.ts, onboarding/progress) must
// land on its own screen, and that screen must be registered.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../api/client', () => ({ api: {} }));
const { surfaceForHref } = await import('./reads');

const SERVER_HREFS: Record<string, string> = {
  '/settings/general': 'platform.settings.general',
  '/cms': 'cms.content.list',
  '/marketplace/blueprints': 'builder.blueprints',
  '/settings/domains': 'platform.settings.domains',
  '/onboarding?step=payments': 'commerce.providers',
};

const catalogDir = join(__dirname, '..', 'surfaces', 'catalog');
const registered = new Set(
  readdirSync(catalogDir)
    .filter((f) => f.endsWith('.ts'))
    .flatMap((f) =>
      [...readFileSync(join(catalogDir, f), 'utf8').matchAll(/key: '([^']+)'/g)].map((m) => m[1])
    )
);

describe('the setup checklist buttons', () => {
  for (const [href, surface] of Object.entries(SERVER_HREFS)) {
    it(`${href} opens ${surface}`, () => {
      expect(surfaceForHref(href).surface).toBe(surface);
      expect(registered.has(surface)).toBe(true);
    });
  }
});
