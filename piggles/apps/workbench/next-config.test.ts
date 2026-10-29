import type { NextConfig } from 'next';
import { describe, expect, it } from 'vitest';

// The three Piggles apps answered with `X-Powered-By: Next.js`, which tells a
// scanner which exploits to try, and sent no enforced CSP (WizeLens, 2026-10-29).
// The edge already refuses all framing (X-Frame-Options DENY); the CSP says the
// same in its own terms and closes the <base> and plugin tricks.

/** An app's next.config.mjs, by path from this folder (they ship no types). */
async function load(path: string): Promise<NextConfig> {
  const url = new URL(path, import.meta.url).href;
  return ((await import(/* @vite-ignore */ url)) as { default: NextConfig }).default;
}

const APPS = ['./', '../web/', '../account/'];

describe('Piggles Next configs', () => {
  it.each(APPS)('%s does not announce Next.js', async (dir) => {
    expect((await load(`${dir}next.config.mjs`)).poweredByHeader).toBe(false);
  });

  it.each(APPS)('%s enforces the baseline CSP, no framing at all', async (dir) => {
    const rules = await (await load(`${dir}next.config.mjs`)).headers?.();
    const all = rules?.find((rule) => rule.source === '/:path*');
    expect(all?.headers.find((h) => h.key === 'Content-Security-Policy')?.value).toBe(
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
    );
  });
});
