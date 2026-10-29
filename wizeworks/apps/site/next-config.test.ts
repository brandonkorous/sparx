import type { NextConfig } from 'next';
import { describe, expect, it } from 'vitest';

// The tenant site answered with `X-Powered-By: Next.js` and sent no enforced CSP
// (WizeLens, 2026-10-29). Its config already had a `headers` key further down, and
// a second one written above it was silently replaced: these read the config
// Next actually loads.

async function load(): Promise<NextConfig> {
  const url = new URL('./next.config.mjs', import.meta.url).href;
  return ((await import(/* @vite-ignore */ url)) as { default: NextConfig }).default;
}

describe('tenant site Next config', () => {
  it('does not announce Next.js', async () => {
    expect((await load()).poweredByHeader).toBe(false);
  });

  it('enforces framing and base-uri on every page, and leaves tenant content alone', async () => {
    const rules = await (await load()).headers?.();
    const all = rules?.find((rule) => rule.source === '/:path*');
    expect(all?.headers.find((h) => h.key === 'Content-Security-Policy')?.value).toBe(
      "frame-ancestors 'self'; base-uri 'self'"
    );
    expect(all?.headers.find((h) => h.key === 'X-Content-Type-Options')?.value).toBe('nosniff');
  });
});
