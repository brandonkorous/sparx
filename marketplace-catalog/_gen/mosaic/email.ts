// Mosaic generator — the blueprint's MARKETING email starters (the platform already
// ships the 19 keyed transactional defaults on email activation, so the blueprint never
// duplicates those). These are brand-voiced examples a tenant forks: a sign-up Welcome
// and a product-tips Broadcast. Both lead with the pinned `email_wordmark`; the
// broadcast carries the CAN-SPAM compliance footer (unsubscribe + physical address).
// Personalization uses the canonical merge tokens so a fork re-themes to the tenant.

import { node, type BuilderNode } from './_kit';

/** A small emoji-led perk/highlight line — a single Text node, email-safe. */
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to {{site.name}} ✨' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Hi {{customer.firstName ?? "there"}} — thanks for joining {{site.name}}. Your AI workspace is ready: capture context, find answers, and let agents handle the busywork.',
        },
      }),
      node('Text', { props: { variant: 'body', text: 'Three ways to get started:' } }),
      perk('📋  Spin up your first workspace and drop in a doc or a project board.'),
      perk('🔍  Connect your tools so one search covers everything.'),
      perk('⚡  Build a Custom Agent to automate a task you do every week.'),
      node('Button', { props: { label: 'Open your workspace', href: '{{site.url}}' } }),
      node('Text', {
        props: { variant: 'meta', text: 'The AI workspace where your work comes together.' },
      }),
    ],
  });
}

export function productTipsEmail(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('email_wordmark', { props: { treatment: 'lockup', align: 'center', size: 'md' } }),
      node('Heading', { props: { level: 'h1', text: 'New in {{site.name}} this month 🚀' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Hi {{customer.firstName ?? "there"}} — a few things we shipped to help your team move faster.',
        },
      }),
      perk('🤖  Custom Agents can now answer from your whole knowledge base.'),
      perk('🔍  Enterprise Search spans docs, chats, and connected drives.'),
      perk('🎙️  AI Meeting Notes captures decisions and action items automatically.'),
      node('Button', { props: { label: 'See what’s new', href: '{{site.url}}' } }),
      ...complianceFooter(),
    ],
  });
}
