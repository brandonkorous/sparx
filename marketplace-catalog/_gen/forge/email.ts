// Forge generator — the blueprint's MARKETING email starters (the platform already ships
// the 19 keyed transactional defaults on email activation, so the blueprint never
// duplicates those). These are brand-voiced examples a studio forks: an inquiry-received
// Welcome and a "Studio Notes" broadcast. Both lead with the pinned `email_wordmark`; the
// broadcast carries the CAN-SPAM compliance footer (unsubscribe + physical address).
// Personalization uses the canonical merge tokens so a fork re-themes to the tenant.

import { node, type BuilderNode } from './_kit';

/** A small emoji-led line — a single Text node, email-safe. */
const perk = (text: string): BuilderNode => node('Text', { props: { variant: 'body', text } });

/** The marketing compliance footer (divider · unsubscribe · postal address). */
const complianceFooter = (): BuilderNode[] => [
  node('Divider'),
  node('unsubscribe_link'),
  node('physical_address'),
];

export function welcomeEmail(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('email_wordmark', { props: { treatment: 'lockup', align: 'center', size: 'md' } }),
      node('Heading', { props: { level: 'h1', text: 'Thanks — we’ll be in touch 👋' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Hi {{customer.firstName ?? "there"}} — thanks for reaching out to {{site.name}}. Your note landed with our team and we’ll reply within one business day.',
        },
      }),
      node('Text', { props: { variant: 'body', text: 'In the meantime, here’s what happens next:' } }),
      perk('📥  We read your note and route it to the right lead.'),
      perk('📞  A 30-minute intro call to understand your goals.'),
      perk('📝  A tailored proposal, scope, and timeline.'),
      node('Button', { props: { label: 'See our work', href: '{{site.url}}' } }),
      node('Text', {
        props: { variant: 'meta', text: 'Impactful brands & websites. Engineered growth.' },
      }),
    ],
  });
}

export function studioNotesEmail(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('email_wordmark', { props: { treatment: 'lockup', align: 'center', size: 'md' } }),
      node('Heading', { props: { level: 'h1', text: 'Studio Notes from {{site.name}} ✦' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Hi {{customer.firstName ?? "there"}} — a short note from the studio on what we’ve been making and thinking about.',
        },
      }),
      perk('🚀  New work: a rebrand and product site we’re proud to show.'),
      perk('🧭  New thinking: how the best brand systems survive growth.'),
      perk('📈  A field note on turning a launch into compounding pipeline.'),
      node('Button', { props: { label: 'Read the latest', href: '{{site.url}}' } }),
      ...complianceFooter(),
    ],
  });
}
