import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { localMediaRoot } from '../src/storage.js';

/**
 * EVERY SERVICE WRITES DEV MEDIA WHERE API-REST SERVES IT (sparx persona issue 056).
 *
 * The import worker wrote Gillett Diesel's 653 product photos under its own
 * directory; api-rest served from its own; every photo was "ready" and 404ed.
 */
const here = process.cwd();
const repo = resolve(here, '..', '..', '..');
const served = join(repo, 'wizeworks', 'services', 'api-rest', '.media-tmp');

afterEach(() => {
  process.chdir(here);
});

describe('localMediaRoot', () => {
  it('is api-rest’s folder from the import worker', () => {
    process.chdir(join(repo, 'wizeworks', 'services', 'import-worker'));
    expect(localMediaRoot()).toBe(served);
  });

  it('is the same folder from api-rest itself and from this package', () => {
    process.chdir(join(repo, 'wizeworks', 'services', 'api-rest'));
    expect(localMediaRoot()).toBe(served);
    process.chdir(here);
    expect(localMediaRoot()).toBe(served);
  });
});
