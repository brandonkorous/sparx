// Forge home · 01 Hero — a left-aligned band: an eyebrow status line, a big display
// headline led by the acid slash (with "Engineered" stepped back in muted), a subhead +
// two CTAs, and the recreated case-study SHOWCASE panel (a cream project slab beside a
// black visual with a glowing acid ring + mesh dots) — all real elements, no image.
// Tracks docs/mockups/examples/500designs.html.

import { arrowRight, btn, slash } from '../../media';
import { band, eyebrow } from '../../sections';
import { el, type BuilderNode } from '../../_kit';

/** The headline: slash · "Impactful brands & websites." · muted "Engineered" · "growth." */
const headline = (): BuilderNode =>
  el(
    'h1',
    'font-heading max-w-4xl text-[2.6rem] font-medium leading-[1.02] tracking-tight text-[#ECE7DD] @2xl:text-6xl @4xl:text-[5rem]',
    {
      children: [
        slash('mr-3'),
        el('span', '', { text: 'Impactful brands & websites. ' }),
        el('span', 'text-base-content/55', { text: 'Engineered' }),
        el('span', '', { text: ' growth.' }),
      ],
    }
  );

// ── The case-study showcase panel ───────────────────────────────────────────────────
const tag = (t: string): BuilderNode =>
  el('span', 'rounded-full bg-[#15120D]/5 px-3 py-1 text-xs font-medium text-[#15120D]/70', { text: t });

const slab = (): BuilderNode =>
  el('div', 'flex flex-col justify-between gap-10 bg-[#ECE7DD] p-9 @sm:p-12', {
    children: [
      el('div', '', {
        children: [
          el('p', 'font-heading text-sm font-medium text-[#15120D]/50', { text: 'Voltaic Energy — Brand & Web' }),
          el('h2', 'font-heading mt-4 text-4xl font-bold leading-[1.04] tracking-tight text-[#15120D] @sm:text-5xl', {
            text: 'Fusion energy made faster and simpler',
          }),
          el('p', 'mt-5 max-w-md text-base leading-relaxed text-[#15120D]/60', {
            text: 'A full rebrand and product site for a clean-energy startup reinventing the world’s power supply — abundant, affordable, and beautifully explained.',
          }),
        ],
      }),
      el('div', 'flex flex-wrap gap-2', {
        children: [tag('Identity'), tag('Web Design'), tag('Motion'), tag('Webflow')],
      }),
    ],
  });

const meshDot = (cls: string): BuilderNode => el('span', `h-2 w-2 rounded-sm ${cls}`, {});

const visual = (): BuilderNode =>
  el('div', 'relative min-h-[320px] overflow-hidden bg-black', {
    children: [
      // The glowing acid ring (a thick acid border + a soft acid bloom).
      el('div', 'absolute inset-0 flex items-center justify-center', {
        children: [
          el('div', 'h-52 w-52 rounded-full border-[16px] border-[#C6F24E]/90 shadow-[0_0_90px_-10px_#C6F24E]', {}),
        ],
      }),
      // Floating mesh grid in the corner.
      el('div', 'absolute left-8 top-8 grid grid-cols-4 gap-2 opacity-60', {
        children: [
          meshDot('bg-white/40'),
          meshDot('bg-white/20'),
          meshDot('bg-white/30'),
          meshDot('bg-white/10'),
          meshDot('bg-white/20'),
          meshDot('bg-white/30'),
          meshDot('bg-white/10'),
          meshDot('bg-white/25'),
        ],
      }),
    ],
  });

const showcase = (): BuilderNode =>
  el('div', 'mt-6 w-full overflow-hidden rounded-[1.75rem] border border-white/5 bg-[#0B0A07] shadow-2xl', {
    children: [el('div', 'grid items-stretch @3xl:grid-cols-[1.15fr_1fr]', { children: [slab(), visual()] })],
  });

export function hero(): BuilderNode {
  return band({
    name: 'Hero',
    gap: 'lg',
    children: [
      el('div', 'flex w-full flex-col gap-7', {
        children: [
          eyebrow('Brand · Web · Growth — an independent studio since 2014'),
          headline(),
          el('div', 'mt-1 flex w-full flex-col gap-8 @3xl:flex-row @3xl:items-end @3xl:justify-between', {
            children: [
              el('p', 'max-w-xl text-lg leading-relaxed text-base-content/80', {
                text: 'An award-winning partner for brand, web, and growth — trusted by ambitious startups and category leaders to unlock their next era of growth.',
              }),
              el('div', 'flex flex-wrap items-center gap-3', {
                children: [
                  btn('Start a project', '/contact', { variant: 'primary', icon: arrowRight() }),
                  btn('View our work', '/work', { variant: 'outline' }),
                ],
              }),
            ],
          }),
        ],
      }),
      showcase(),
    ],
  });
}
