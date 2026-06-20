// Mosaic generator — the Enterprise page (singleton): a centered intro with CTAs, a
// security/scale feature grid (Icon tiles), a dark stat band, and a closing call to
// action. Tracks the clean apex/Notion aesthetic.

import { btn } from '../media';
import { band, displayHeading } from '../sections';
import { atom, el, node, type BuilderNode } from '../_kit';

const featureItem = (icon: string, title: string, body: string): BuilderNode =>
  el('div', 'flex flex-col items-start gap-4', {
    children: [
      el('div', 'inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary', {
        children: [atom('Icon', 'h-6 w-6', { name: icon })],
      }),
      el('h3', 'text-lg font-semibold text-[#191918]', { text: title }),
      el('p', 'text-sm leading-relaxed text-base-content/70', { text: body }),
    ],
  });

export function enterpriseTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Enterprise', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // Intro.
      node('Section', {
        box: { name: 'Enterprise intro', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
        children: [
          atom('Badge', 'st-badge st-c-primary st-v-soft', { label: 'Mosaic for Enterprise' }),
          displayHeading('Built for the way your company works.', 'text-center @2xl:text-5xl'),
          el('p', 'mx-auto max-w-2xl text-lg text-base-content/60', {
            text: 'The security, control, and scale that IT and security teams require — with the simplicity your whole company will actually adopt.',
          }),
          el('div', 'mt-2 flex flex-col items-center gap-3 @sm:flex-row', {
            children: [btn('Request a demo', '/request-demo', { variant: 'primary' }), btn('Talk to sales', '/request-demo', { variant: 'ghost' })],
          }),
        ],
      }),
      // Security/scale feature grid.
      band({
        name: 'Enterprise features',
        children: [
          displayHeading('Enterprise-grade by default.'),
          el('div', 'grid w-full grid-cols-1 gap-8 @2xl:grid-cols-2 @4xl:grid-cols-3', {
            children: [
              featureItem('shield-check', 'SSO & SAML', 'Bring your own identity provider with SAML single sign-on and enforce it across your whole org.'),
              featureItem('users', 'SCIM provisioning', 'Automatically provision and deprovision members and groups as your directory changes.'),
              featureItem('scroll-text', 'Audit logs', 'A complete, exportable record of every important action across your workspace.'),
              featureItem('lock', 'Advanced permissions', 'Private team spaces, granular sharing controls, and guest access that IT can govern.'),
              featureItem('server', 'Data residency & encryption', 'Encryption in transit and at rest, with regional data residency options for your records.'),
              featureItem('headset', 'Dedicated support', 'A named success manager, priority support, and a 99.9% uptime SLA in writing.'),
            ],
          }),
        ],
      }),
      // Stat band (dark).
      node('Section', {
        box: { name: 'Enterprise stats', surface: 'inverse', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'grid', columns: 4, gap: 'lg', alignItems: 'start' },
        children: [
          atom('Stat', 'flex flex-col gap-1', { value: '62%', label: 'of the Fortune 100' }),
          atom('Stat', 'flex flex-col gap-1', { value: '99.9%', label: 'uptime SLA' }),
          atom('Stat', 'flex flex-col gap-1', { value: 'SOC 2', label: 'Type II certified' }),
          atom('Stat', 'flex flex-col gap-1', { value: '24/7', label: 'priority support' }),
        ],
      }),
      // Closing CTA.
      band({
        name: 'Enterprise CTA',
        surface: 'subtle',
        align: 'center',
        children: [
          displayHeading('Bring Mosaic to your whole company.', 'text-center'),
          el('p', 'mx-auto max-w-xl text-lg text-base-content/60', { text: 'See how Mosaic scales from your first team to your entire organization.' }),
          btn('Request a demo', '/request-demo', { variant: 'primary' }),
        ],
      }),
    ],
  });
}
