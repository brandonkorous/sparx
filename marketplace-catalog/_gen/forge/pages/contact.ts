// Forge generator — the Contact page (singleton): a page hero over a two-column section
// pairing a working-looking inquiry form (Field + Input/Textarea/Select atoms, the
// catalog idiom) with the studio's contact details + a "what happens next" card. The
// tenant wires the form's destination post-install. This page is the funnel end, so it
// carries no closing CTA.

import { pageHero } from '../sections';
import { atom, el, node, type BuilderNode } from '../_kit';

const budgetSelect = (): BuilderNode =>
  el('select', 'w-full rounded-xl border border-white/15 bg-[#1A1611] px-4 py-3 text-sm text-[#ECE7DD]', {
    attrs: { name: 'budget' },
    children: [
      el('option', '', { text: 'Select a range', attrs: { value: '' } }),
      el('option', '', { text: 'Under $25k', attrs: { value: 'under-25k' } }),
      el('option', '', { text: '$25k – $50k', attrs: { value: '25-50k' } }),
      el('option', '', { text: '$50k – $100k', attrs: { value: '50-100k' } }),
      el('option', '', { text: '$100k+', attrs: { value: '100k-plus' } }),
    ],
  });

const form = (): BuilderNode =>
  el('form', 'flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-[#221D16] p-6 @2xl:p-8', {
    name: 'Contact form',
    children: [
      atom('Field', 'w-full', { label: 'Full name' }, [
        atom('Input', 'st-c-primary st-fv-outline', { type: 'text', name: 'name', placeholder: 'Jordan Avery' }),
      ]),
      atom('Field', 'w-full', { label: 'Work email' }, [
        atom('Input', 'st-c-primary st-fv-outline', { type: 'email', name: 'email', placeholder: 'you@company.com' }),
      ]),
      atom('Field', 'w-full', { label: 'Company' }, [
        atom('Input', 'st-c-primary st-fv-outline', { type: 'text', name: 'company', placeholder: 'Acme Inc.' }),
      ]),
      atom('Field', 'w-full', { label: 'Project budget' }, [budgetSelect()]),
      atom('Field', 'w-full', { label: 'About the project' }, [
        atom('Textarea', 'st-c-primary st-fv-outline', {
          name: 'message',
          placeholder: 'Goals, timeline, and what you’re hoping to achieve…',
        }),
      ]),
      atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md w-full rounded-full', { label: 'Send inquiry' }),
      el('p', 'text-xs text-base-content/50', { text: 'By submitting, you agree to be contacted about your inquiry. We respect your inbox.' }),
    ],
  });

const detail = (label: string, value: string, href: string): BuilderNode =>
  el('div', '', {
    children: [
      el('p', 'text-sm font-medium text-base-content/50', { text: label }),
      el('a', 'mt-1 inline-block font-heading text-lg text-[#ECE7DD] transition-colors hover:text-[#C6F24E]', {
        text: value,
        attrs: { href },
      }),
    ],
  });

const nextStep = (text: string): BuilderNode =>
  el('li', 'flex items-start gap-3 text-sm text-base-content/70', {
    children: [
      el('span', 'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C6F24E]/15 text-xs font-bold text-[#C6F24E]', { text: '✓' }),
      el('span', '', { text }),
    ],
  });

const details = (): BuilderNode =>
  el('div', 'flex flex-col gap-6', {
    children: [
      detail('Email', 'hello@forge.studio', 'mailto:hello@forge.studio'),
      detail('New business', 'newbiz@forge.studio', 'mailto:newbiz@forge.studio'),
      el('div', '', {
        children: [
          el('p', 'text-sm font-medium text-base-content/50', { text: 'Studio' }),
          el('p', 'mt-1 font-heading text-lg text-[#ECE7DD]', { text: 'Remote-first · Working worldwide' }),
        ],
      }),
      el('div', 'mt-2 rounded-[1.5rem] border border-white/10 bg-[#221D16] p-6', {
        children: [
          el('h3', 'font-heading text-lg font-semibold text-[#ECE7DD]', { text: 'What happens next' }),
          el('ul', 'mt-4 flex flex-col gap-3', {
            children: [
              nextStep('We reply within one business day.'),
              nextStep('A 30-minute intro call to understand your goals.'),
              nextStep('A tailored proposal, scope, and timeline.'),
            ],
          }),
        ],
      }),
    ],
  });

export function contactTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Contact', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero('Contact', 'Let’s talk.', 'Tell us about your project and what success looks like. We reply within one business day.'),
      node('Section', {
        box: { name: 'Inquiry', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'lg' },
        children: [
          el('div', 'grid w-full grid-cols-1 gap-10 @3xl:grid-cols-[1.3fr_1fr]', {
            children: [form(), details()],
          }),
        ],
      }),
    ],
  });
}
