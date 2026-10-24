import type { NextConfig } from 'next';
import { describe, expect, it } from 'vitest';

// Every sparx app answered with `X-Powered-By: Next.js`, which tells a scanner
// which exploits to try. The marketing site also starts a report-only CSP.

/** An app's next.config.mjs, by path from this folder (they ship no types). */
async function load(path: string): Promise<NextConfig> {
  const url = new URL(path, import.meta.url).href;
  return ((await import(/* @vite-ignore */ url)) as { default: NextConfig }).default;
}

describe('sparx Next configs', () => {
  it.each(['../web/', './', '../market/'])('%s does not announce Next.js', async (dir) => {
    expect((await load(`${dir}next.config.mjs`)).poweredByHeader).toBe(false);
  });

  it('web sends a report-only Content-Security-Policy on every page', async () => {
    const web = await load('../web/next.config.mjs');
    const rules = await web.headers?.();
    const all = rules?.find((rule) => rule.source === '/:path*');
    const csp = all?.headers.find((h) => h.key === 'Content-Security-Policy-Report-Only');
    expect(csp?.value).toContain("default-src 'self'");
    expect(csp?.value).toContain("object-src 'none'");
  });
});
