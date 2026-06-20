// Tempo generator — the Help page: a hero, a 3-up of support topic cards, and a contact
// block (email · phone · hours). Lead-gen / support copy in the brand voice.

import { arrowLink, btn } from '../media';
import { pageHero, sectionHead } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

const topic = (emoji: string, title: string, body: string): BuilderNode =>
  el('div', 'flex flex-col gap-2 border border-base-300 p-6', {
    children: [
      el('span', 'text-3xl leading-none', { text: emoji }),
      el('h3', 'font-heading text-lg font-black uppercase tracking-tight text-base-content', { text: title }),
      el('p', 'text-sm leading-relaxed text-base-content/65', { text: body }),
      arrowLink('Learn More', '/help', { cls: 'mt-2' }),
    ],
  });

export function helpTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Help', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero('Help & Support', 'How can we help?', 'Orders, returns, shipping and sizing — find an answer fast, or reach the team directly.'),
      // Topics.
      node('Section', {
        box: { name: 'Support topics', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          sectionHead('Popular Topics'),
          el('div', 'grid w-full grid-cols-1 gap-3 @3xl:grid-cols-3', {
            children: [
              topic('📦', 'Orders & Tracking', 'Check your order status and track every step from warehouse to door.'),
              topic('↩️', 'Returns & Exchanges', 'Free returns within 30 days — start a return or swap a size in minutes.'),
              topic('📏', 'Sizing & Fit', 'Find your size with our charts and fit notes for every category.'),
            ],
          }),
        ],
      }),
      // Contact.
      node('Section', {
        box: { name: 'Contact us', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: 2, gap: 'xl', alignItems: 'center' },
        children: [
          el('div', 'flex flex-col gap-3', {
            children: [
              el('h2', 'font-heading text-2xl font-black uppercase tracking-tightest text-base-content @2xl:text-3xl', { text: 'Still need a hand?' }),
              el('p', 'max-w-md text-base leading-relaxed text-base-content/70', {
                text: 'Our team is here seven days a week. Reach out and we’ll get you sorted.',
              }),
              el('div', 'mt-2', { children: [btn('Email the Team', '/help')] }),
            ],
          }),
          el('div', 'flex flex-col gap-4 bg-base-100 p-6', {
            children: [
              el('div', '', {
                children: [
                  el('p', 'font-heading text-xs font-bold uppercase tracking-widest text-base-content/50', { text: 'Email' }),
                  el('p', 'mt-1 text-base text-base-content', { text: 'support@tempo.example' }),
                ],
              }),
              el('div', '', {
                children: [
                  el('p', 'font-heading text-xs font-bold uppercase tracking-widest text-base-content/50', { text: 'Phone' }),
                  el('p', 'mt-1 text-base text-base-content', { text: '(800) 555-0142' }),
                ],
              }),
              el('div', '', {
                children: [
                  el('p', 'font-heading text-xs font-bold uppercase tracking-widest text-base-content/50', { text: 'Hours' }),
                  el('p', 'mt-1 text-base text-base-content', { text: 'Mon–Sun · 6am – 9pm PT' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
