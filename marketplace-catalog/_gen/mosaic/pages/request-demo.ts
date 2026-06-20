// Mosaic generator — the Request-a-demo page (singleton): a two-column section pairing
// the pitch + reassurances with a working-looking contact form (Field + Input/Textarea
// atoms, the catalog idiom). The tenant wires the form's destination post-install.

import { displayHeading } from '../sections';
import { atom, el, node, type BuilderNode } from '../_kit';

const reassure = (text: string): BuilderNode =>
  el('li', 'flex items-start gap-3 text-sm text-base-content/80', {
    children: [
      el('span', 'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary', { text: '✓' }),
      el('span', '', { text }),
    ],
  });

export function requestDemoTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Request a demo', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'lg' },
    children: [
      el('div', 'grid w-full grid-cols-1 gap-10 @3xl:grid-cols-2', {
        children: [
          // Left — pitch + reassurances.
          el('div', 'flex flex-col gap-5', {
            children: [
              displayHeading('See Mosaic in action.'),
              el('p', 'max-w-md text-lg text-base-content/60', {
                text: 'Tell us a bit about your team and we’ll walk you through how Mosaic brings your docs, projects, and agents together.',
              }),
              el('ul', 'mt-1 flex flex-col gap-3', {
                children: [
                  reassure('A tailored 30-minute walkthrough, not a generic pitch.'),
                  reassure('Answers on security, SSO, and rollout for your org.'),
                  reassure('We’ll reply within one business day.'),
                ],
              }),
              el('div', 'mt-2 flex flex-col gap-1 text-sm text-base-content/70', {
                children: [
                  el('p', '', {
                    children: [el('span', 'font-medium text-[#191918]', { text: 'Email — ' }), el('span', '', { text: 'sales@mosaic.example' })],
                  }),
                  el('p', '', {
                    children: [el('span', 'font-medium text-[#191918]', { text: 'Sales — ' }), el('span', '', { text: '(555) 010-0142' })],
                  }),
                ],
              }),
            ],
          }),
          // Right — the contact form.
          el('form', 'flex flex-col gap-4 rounded-2xl border border-base-300 bg-base-100 p-6 @2xl:p-8', {
            name: 'Demo request form',
            children: [
              atom('Field', 'w-full', { label: 'Full name' }, [atom('Input', 'st-c-primary st-fv-outline', { type: 'text', name: 'name', placeholder: 'Jordan Avery' })]),
              atom('Field', 'w-full', { label: 'Work email' }, [atom('Input', 'st-c-primary st-fv-outline', { type: 'email', name: 'email', placeholder: 'you@company.com' })]),
              atom('Field', 'w-full', { label: 'Company' }, [atom('Input', 'st-c-primary st-fv-outline', { type: 'text', name: 'company', placeholder: 'Acme Inc.' })]),
              atom('Field', 'w-full', { label: 'What would you like to see?' }, [
                atom('Textarea', 'st-c-primary st-fv-outline', { name: 'message', placeholder: 'A few words about your team and goals…' }),
              ]),
              atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md w-full', { label: 'Request a demo' }),
              el('p', 'text-xs text-base-content/50', { text: 'By submitting, you agree to be contacted about Mosaic. We respect your inbox.' }),
            ],
          }),
        ],
      }),
    ],
  });
}
