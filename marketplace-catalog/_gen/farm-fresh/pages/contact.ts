// Farm Fresh generator — the Contact page: hero · three reach-us method cards · a
// visit/hours band beside a map · a newsletter sign-up. The form is a real wired
// Signup (the platform's one capture island) rather than a dead name/email/message
// form — contact details + a working sign-up, never a stub.

import { node, type BuilderNode } from '../_kit';
import { CARD_CLS } from '../theme';

/** A reach-us card: a big emoji, a label, the value, and an action button (mailto /
 *  tel / internal link). Wears the brand card shell + hover-lift like the rest. */
const contactCard = (
  emoji: string,
  label: string,
  value: string,
  cta: string,
  href: string
): BuilderNode =>
  node('Card', {
    cls: CARD_CLS,
    box: { padding: 'lg' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start', justify: 'between' },
    children: [
      node('Text', { cls: 'text-4xl leading-none', props: { variant: 'body', text: emoji } }),
      node('Heading', { cls: 'text-xl', props: { level: 'h3', text: label } }),
      node('Text', { cls: 'text-base-content/70', props: { variant: 'body', text: value } }),
      node('Button', { props: { label: cta, style: 'soft', href } }),
    ],
  });

export function contactTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Contact', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Contact hero',
          surface: 'brand',
          height: 'md',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, props: { level: 'h1', size: 'display', text: 'We’d love to hear from you' } }),
          node('Text', {
            box: { align: 'center' },
            cls: 'max-w-xl',
            props: {
              variant: 'body',
              text: 'Questions, catering, feedback, or just want to say hi — here’s how to reach the team.',
            },
          }),
        ],
      }),
      node('Section', {
        box: { name: 'Reach us', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: 3, gap: 'lg' },
        children: [
          contactCard('📧', 'Email us', 'hello@farmfreshbowls.example', 'Send an email', 'mailto:hello@farmfreshbowls.example'),
          contactCard('📞', 'Call us', '(951) 555-0142', 'Call now', 'tel:+19515550142'),
          contactCard('📅', 'Catering & events', 'Plan something fresh for any crowd.', 'Request a quote', '/catering'),
        ],
      }),
      node('Section', {
        box: { name: 'Visit', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: 2, gap: 'lg', alignItems: 'center' },
        children: [
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start', justify: 'center' },
            children: [
              node('Heading', { props: { level: 'h2', text: 'Visit a counter' } }),
              node('Text', { props: { variant: 'body', text: '214 Orchard Lane, Riverside, CA 92501' } }),
              node('Text', { props: { variant: 'body', text: '88 Maple Street, Suite B, Riverside, CA 92507' } }),
              node('Text', { cls: 'pt-2 font-semibold', props: { variant: 'body', text: 'Hours' } }),
              node('Text', { props: { variant: 'meta', text: 'Mon–Fri · 7am – 7pm' } }),
              node('Text', { props: { variant: 'meta', text: 'Sat – Sun · 8am – 5pm' } }),
              node('Button', { props: { label: 'Get directions', style: 'primary', href: '/locations' } }),
            ],
          }),
          node('Map', { props: { query: '214 Orchard Lane, Riverside, CA 92501' } }),
        ],
      }),
      node('Section', {
        box: { name: 'Newsletter', surface: 'accent', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, cls: 'text-4xl @3xl:text-5xl', props: { level: 'h2', text: 'Stay in the loop' } }),
          node('Text', {
            box: { align: 'center' },
            cls: 'max-w-lg',
            props: {
              variant: 'body',
              text: 'Seasonal menus, new flavors, and the occasional treat — straight to your inbox.',
            },
          }),
          node('Stack', {
            cls: 'w-full max-w-md',
            box: { padding: 'none' },
            layout: { direction: 'stack', gap: 'none', alignItems: 'center' },
            children: [node('Signup', { props: { cta: 'Sign up' } })],
          }),
        ],
      }),
    ],
  });
}
