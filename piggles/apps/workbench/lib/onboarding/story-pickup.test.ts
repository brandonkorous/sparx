// "Pick up locally" in the setup story turns on collecting (sparx persona issue 129).
//
// The setup story offered "Local pickup" and recorded it only as words. Once the
// shop set up delivery, collecting disappeared from checkout with nothing to say
// it had been chosen. A source check, since the console keeps no render tests.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EMPTY_STORY } from '@wizeworks/story-schemas';
import { fulfillment } from './story-state';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('the setup story and collecting', () => {
  it('reads pickup from the story', () => {
    const story = { ...EMPTY_STORY, cust: ['shop', 'pickup', 'ship'] };
    expect(fulfillment(story).has('pickup')).toBe(true);
  });

  it('passes it to the build and writes it after the modules', () => {
    const composer = readFileSync(
      join(HERE, '..', '..', 'surfaces', 'onboarding', 'story', 'story-composer.tsx'),
      'utf8'
    );
    expect(composer).toContain("offersCollection: fulfillment(story).has('pickup')");
    const api = readFileSync(join(HERE, 'api.ts'), 'utf8');
    expect(api).toMatch(/saveModules\(input\.modules, done\);\s+if \(input\.offersCollection/);
  });
});
