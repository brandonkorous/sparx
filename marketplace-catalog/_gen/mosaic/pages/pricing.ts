// Mosaic generator — the Pricing page (singleton): a centered intro, a three-tier plan
// grid (Plus highlighted), an Enterprise contact band, and an FAQ built on native
// <details> (no script). Tracks the clean apex/Notion aesthetic.

import { btn } from '../media';
import { band, displayHeading } from '../sections';
import { atom, el, node, type BuilderNode } from '../_kit';

const featureLine = (text: string): BuilderNode =>
  el('li', 'flex items-start gap-2 text-sm text-base-content/80', {
    children: [el('span', 'mt-0.5 shrink-0 text-primary', { text: '✓' }), el('span', '', { text })],
  });

const priceCard = (opts: {
  name: string;
  price: string;
  per: string;
  blurb: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}): BuilderNode =>
  el(
    'div',
    `relative flex flex-col gap-6 rounded-2xl p-8 ${
      opts.highlighted ? 'border-2 border-primary bg-base-100 shadow-lg' : 'border border-base-300 bg-base-100'
    }`,
    {
      children: [
        ...(opts.highlighted
          ? [
              el('div', 'absolute -top-3 left-8', {
                children: [atom('Badge', 'st-badge st-c-primary st-v-solid', { label: 'Most popular' })],
              }),
            ]
          : []),
        el('div', 'flex flex-col gap-1', {
          children: [
            el('h3', 'text-lg font-semibold text-[#191918]', { text: opts.name }),
            el('p', 'text-sm text-base-content/60', { text: opts.blurb }),
          ],
        }),
        el('div', 'flex items-baseline gap-1', {
          children: [
            el('span', 'text-4xl font-bold tracking-tight text-[#191918]', { text: opts.price }),
            el('span', 'text-sm text-base-content/50', { text: opts.per }),
          ],
        }),
        el('ul', 'flex flex-col gap-3', { children: opts.features.map(featureLine) }),
        btn(opts.cta, '/request-demo', { variant: opts.highlighted ? 'primary' : 'ghost', cls: 'mt-auto w-full' }),
      ],
    }
  );

const faqItem = (q: string, a: string, open = false): BuilderNode =>
  el('details', 'group rounded-2xl border border-base-300 bg-base-100 p-5', {
    attrs: open ? { open: true } : {},
    children: [
      el('summary', 'flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-[#191918] [&::-webkit-details-marker]:hidden', {
        children: [
          el('span', '', { text: q }),
          atom('Icon', 'h-5 w-5 shrink-0 text-base-content/50 transition-transform group-open:rotate-180', { name: 'chevron-down' }),
        ],
      }),
      el('p', 'mt-3 text-sm leading-relaxed text-base-content/70', { text: a }),
    ],
  });

export function pricingTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Pricing', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // Intro.
      node('Section', {
        box: { name: 'Pricing intro', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
        children: [
          displayHeading('Pricing that scales with your team.', 'text-center'),
          el('p', 'mx-auto max-w-xl text-lg text-base-content/60', {
            text: 'Start free, upgrade when you need more. Every plan includes unlimited docs and a 14-day trial of paid features.',
          }),
        ],
      }),
      // Tier grid.
      band({
        name: 'Plans',
        children: [
          el('div', 'grid w-full grid-cols-1 items-stretch gap-6 @3xl:grid-cols-3', {
            children: [
              priceCard({
                name: 'Free',
                price: '$0',
                per: '/user / month',
                blurb: 'For individuals organizing their work.',
                features: ['Unlimited pages & docs', 'Up to 10 guests', 'Basic page analytics', '7-day version history'],
                cta: 'Get started',
              }),
              priceCard({
                name: 'Plus',
                price: '$12',
                per: '/user / month',
                blurb: 'For small teams working together.',
                features: ['Everything in Free', 'Unlimited blocks for teams', 'Unlimited file uploads', '30-day version history', 'Custom Agents'],
                cta: 'Start free trial',
                highlighted: true,
              }),
              priceCard({
                name: 'Business',
                price: '$24',
                per: '/user / month',
                blurb: 'For companies that run on Mosaic.',
                features: ['Everything in Plus', 'SAML single sign-on', 'Private team spaces', 'Advanced page analytics', 'Bulk export'],
                cta: 'Start free trial',
              }),
            ],
          }),
        ],
      }),
      // Enterprise band.
      band({
        name: 'Enterprise band',
        children: [
          el('div', 'flex w-full flex-col items-start gap-4 rounded-2xl bg-[#191918] p-8 text-white @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:p-10', {
            children: [
              el('div', 'flex flex-col gap-2', {
                children: [
                  atom('Heading', 'text-2xl font-semibold', { level: 'h2', text: 'Need enterprise controls?' }),
                  el('p', 'max-w-xl text-sm text-white/70', { text: 'Advanced security, SCIM provisioning, audit logs, a dedicated success manager, and a 99.9% uptime SLA.' }),
                ],
              }),
              btn('Contact sales', '/enterprise', { variant: 'ghost', cls: 'shrink-0' }),
            ],
          }),
        ],
      }),
      // FAQ.
      band({
        name: 'Pricing FAQ',
        surface: 'subtle',
        children: [
          displayHeading('Frequently asked questions'),
          el('div', 'flex w-full flex-col gap-3', {
            children: [
              faqItem('Is there a free plan?', 'Yes. The Free plan is genuinely free forever for individuals and small teams — no credit card required to start.', true),
              faqItem('Can I change plans later?', 'Anytime. Upgrade or downgrade in a click; we prorate the difference so you only pay for what you use.'),
              faqItem('Do you offer discounts for nonprofits or education?', 'We do. Eligible nonprofits and educational institutions get a significant discount — reach out and our team will set you up.'),
              faqItem('What happens when my trial ends?', 'Your workspace stays intact. Paid features pause until you choose a plan — nothing is deleted, and you can upgrade whenever you’re ready.'),
            ],
          }),
        ],
      }),
    ],
  });
}
