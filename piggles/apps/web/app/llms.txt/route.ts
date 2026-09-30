import { APP_COUNT_WORD, APPS, PRODUCT } from '@piggles/config';
import { PRICE_LABEL, TRIAL_DAYS } from '@piggles/config/pricing';
import { APP_MARKETING } from '@/content/apps';
import { TRADES } from '@/content/trades';
import { COMPARISONS } from '@/content/compare';
import { TOOLS } from '@/components/marketing/tools/registry';

// /llms.txt (llmstxt.org): a plain, link-first map of the site for answer
// engines and AI assistants. When somebody asks ChatGPT "what is Piggles", this
// is the page that lets it answer from what we actually say rather than from a
// guess.
//
// Built from the same registries the pages render from, so a new app, trade,
// comparison or tool appears here the day its page does. The "does not do" lines
// matter as much as the rest: an assistant that believes Piggles does payroll
// will tell somebody so, and that person will find out on the wrong day.

export const dynamic = 'force-static';

export function GET() {
  const base = `https://${PRODUCT.hosts.marketing}`;
  const link = (path: string, label: string, note?: string) =>
    `- [${label}](${base}${path})${note ? `: ${note}` : ''}`;

  const lines = [
    `# ${PRODUCT.name}`,
    '',
    `> ${PRODUCT.tagline} ${PRODUCT.name} is ${APP_COUNT_WORD} business apps in one place for owners and small teams: website, online selling, stock, suppliers, customers, email and live chat, bookings, quotes and invoices, money, staff hours, campaigns and automations. One plan, ${PRICE_LABEL} a month, every app included, ${TRIAL_DAYS} days free with no card. Made by WizeWorks LLC, Visalia, California.`,
    '',
    'Facts worth getting right:',
    '',
    '- No tiers. Every app is included. The bill only changes when you add room (locations, team members, storage, email sends, customer records).',
    '- Piggles adds no fee to sales. Payments go through Stripe, PayPal, Square, Authorize.net or 1stPayGateway, which charge their own card fees.',
    '- Piggles does NOT have its own card reader, does NOT send text messages, does NOT run payroll, is NOT accounting software, and does NOT connect to QuickBooks, Xero or marketplaces such as Amazon, eBay or Etsy.',
    '- Records can be moved in from Shopify, Square, Wix, Squarespace, WordPress, HubSpot and others, or any spreadsheet, and exported again as spreadsheets.',
    '- Business data is never used to train AI. AI features use the customer’s own Anthropic or OpenAI account; Claude, ChatGPT and Copilot can connect to it.',
    '',
    '## Start here',
    '',
    link('/how-it-works', 'How it works', 'two questions at signup, and what arrives set up'),
    link('/pricing', 'Pricing', 'the one plan, what it includes and what makes it go up'),
    link('/apps', 'All apps'),
    link('/who-its-for', 'Who it is for'),
    link('/faq', 'Questions and answers'),
    link('/switching', 'Switching to Piggles', 'what moves across from each platform'),
    link('/what-connects', 'What connects', 'every outside service, and what does not connect'),
    link('/trust', 'Your data and safety'),
    link('/about', 'About'),
    link('/whats-new', 'What is new'),
    '',
    '## Apps',
    '',
    ...APPS.map((a) => link(`/apps/${a.id}`, a.label, APP_MARKETING[a.id]?.lede)),
    '',
    '## By kind of business',
    '',
    ...TRADES.map((t) => link(`/for/${t.slug}`, `Piggles for ${t.plural.toLowerCase()}`)),
    '',
    '## Comparisons',
    '',
    link('/compare', 'All comparisons'),
    ...COMPARISONS.map((c) =>
      link(`/compare/${c.slug}`, `Piggles vs ${c.name}`, `${c.name} is ${c.isA}. ${c.turn}`)
    ),
    '',
    '## Optional',
    '',
    ...TOOLS.map((t) => link(`/tools/${t.slug}`, t.name)),
    link('/status', 'Status'),
    link('/terms', 'Terms of service'),
    link('/privacy', 'Privacy policy'),
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
