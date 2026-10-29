import type { NextConfig } from 'next';
import { describe, expect, it } from 'vitest';

// Every sparx app answered with `X-Powered-By: Next.js`, which tells a scanner
// which exploits to try. The marketing site also starts a report-only CSP.
//
// The fix reached the three sparx apps and left the Piggles apps and the tenant
// site behind: they still announced Next.js, and no app sent an ENFORCED CSP
// (WizeLens, 2026-10-29). So every Next app in the repo is listed here.

/** An app's next.config.mjs, by path from this folder (they ship no types). */
async function load(path: string): Promise<NextConfig> {
  const url = new URL(path, import.meta.url).href;
  return ((await import(/* @vite-ignore */ url)) as { default: NextConfig }).default;
}

/** The enforced CSP an app sends on every page, or undefined. */
async function enforcedCsp(dir: string): Promise<string | undefined> {
  const rules = await (await load(`${dir}next.config.mjs`)).headers?.();
  const all = rules?.find((rule) => rule.source === '/:path*');
  return all?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
}

const SPARX = ['../web/', './', '../market/'];
const PIGGLES = [
  '../../../piggles/apps/web/',
  '../../../piggles/apps/account/',
  '../../../piggles/apps/workbench/',
];
const TENANT_SITE = '../../../wizeworks/apps/site/';

describe('Next configs', () => {
  it.each([...SPARX, ...PIGGLES, TENANT_SITE])('%s does not announce Next.js', async (dir) => {
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

  it.each(SPARX)('%s enforces the baseline CSP, framing by itself only', async (dir) => {
    expect(await enforcedCsp(dir)).toBe(
      "frame-ancestors 'self'; base-uri 'self'; object-src 'none'"
    );
  });

  it.each(PIGGLES)('%s enforces the baseline CSP, no framing at all', async (dir) => {
    expect(await enforcedCsp(dir)).toBe(
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
    );
  });

  it('the tenant site enforces framing and base-uri, and leaves tenant content alone', async () => {
    expect(await enforcedCsp(TENANT_SITE)).toBe("frame-ancestors 'self'; base-uri 'self'");
  });
});
