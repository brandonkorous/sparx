// Tenant-aware robots.txt. Allows all crawlers by default; disallows
// preview-token paths so a leaked preview URL doesn't get indexed.
// Sitemap reference points back at this same host.

import { resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';
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

  // Shared exclusions applied to every crawler group: the internal API and any
  // leaked preview-token URL.
  const disallow = ['Disallow: /api/', 'Disallow: /*?sparxPreview='];
  // AI / answer-engine crawlers we explicitly welcome (docs/50) — Sparx is
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
