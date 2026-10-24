import type { NextConfig } from 'next';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- the config is plain .mjs with no declaration file.
import rawConfig from '../next.config.mjs';

const config = rawConfig as NextConfig;

// WW-12: WizeLens saw site pages answer without X-Content-Type-Options.
describe('site response headers', () => {
  it('sends nosniff on every path', async () => {
    const rules = (await config.headers?.()) ?? [];
    const all = rules.find((r) => r.source === '/:path*');
    expect(all?.headers).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' });
  });
});
