// Tenant-aware robots.txt. Allows all crawlers by default; disallows
// preview-token paths so a leaked preview URL doesn't get indexed.
// Sitemap reference points back at this same host.

import { resolveSite } from '@/lib/site-context';

// NO `force-dynamic` (docs/127 §6). It was doing two things and only one was wanted:
// forcing dynamic rendering, and forcing `no-store` on every fetch beneath it — which
// overrode the revalidate window + purge tags each read in lib/* already declares. This
// route still renders per-request either way, because `resolveSite()` reads the Host
// header; what changed is that its data is now cached and purged on publish.
export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Behind the cluster ingress (Caddy → Cloud Run/GKE), `request.url` reports
  // the internal bind address (e.g. 0.0.0.0:3000), not the public host the
  // crawler used. Prefer the x-forwarded headers so the Sitemap line points
  // at the storefront origin a crawler can actually fetch.
  const headers = request.headers;
  const forwardedHost = headers.get('x-forwarded-host');
  const forwardedProto = headers.get('x-forwarded-proto');
  const url = new URL(request.url);
  const host = forwardedHost ?? headers.get('host') ?? url.host;
  const protocol = forwardedProto ? `${forwardedProto}:` : url.protocol;
  const origin = `${protocol}//${host}`;
  const site = await resolveSite();

  // Shared exclusions applied to every crawler group: the internal API, any leaked
  // preview-token URL, and the transactional pages.
  //
  // The transactional block was missing, and `@wizeworks/site-lint` is what surfaced it:
  // the seeded site ships editable Cart / Search / Login / Register / Forgot password
  // / Reset password pages, the linter reported all six as having no search
  // description, and the right answer turned out not to be "write six descriptions"
  // but that none of them belongs in an index at all. A password-reset page in search
  // results is a support ticket waiting to happen, and a crawler working through
  // per-visitor cart URLs spends the site's crawl budget on pages that are empty for
  // everyone but the person who filled them.
  const disallow = [
    'Disallow: /api/',
    'Disallow: /*?sparxPreview=',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /account/',
  ];
  // AI / answer-engine crawlers we explicitly welcome (docs/50) — sparx is
  // AI-native, so storefronts opt INTO model + answer-engine discovery. They get
  // the same exclusions as everyone else, just named so the intent is on record.
  const aiAgents = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-Web',
    'anthropic-ai',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
    'Amazonbot',
    'Meta-ExternalAgent',
  ];

  const lines = [
    'User-agent: *',
    ...disallow,
    '',
    '# AI / answer-engine crawlers are explicitly welcome — see llms.txt.',
    ...aiAgents.map((a) => `User-agent: ${a}`),
    'Allow: /',
    ...disallow,
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    `# llms.txt: ${origin}/llms.txt`,
    '',
  ];

  if (!site) {
    return new Response('User-agent: *\nDisallow: /\n', {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
