// Tempo home · 01 Hero — a full-bleed CAROUSEL (docs/98 Pillar 5): auto-advancing campaign
// slides, each a team-color gradient band with a floating sport glyph and an overlaid
// white copy card (kicker · big uppercase headline · sub · two CTAs), plus prev/next
// arrows and dots. The runtime carousel behavior advances `[data-sx-slide]` children and
// pauses on hover. Tracks docs/mockups/examples/adidas.html (the World Cup hero).

import { GRAD, arrowRight, btn } from '../../media';
import { behave, el, part, type BuilderNode } from '../../_kit';

const slide = (opts: {
  gradientCls: string;
  glyph: string;
  kicker: string;
  title: string;
  sub: string;
}): BuilderNode =>
  part(
    el('div', `relative flex w-full shrink-0 items-end overflow-hidden ${opts.gradientCls}`, {
      name: 'Slide',
      children: [
        el('span', 'pointer-events-none absolute right-4 top-10 text-[8rem] leading-none opacity-90 drop-shadow-2xl @2xl:right-24 @2xl:text-[15rem]', {
          text: opts.glyph,
        }),
        el('div', 'relative m-4 min-h-[400px] w-full max-w-md self-end @2xl:m-12 @2xl:min-h-[520px]', {
          children: [
            el('div', 'absolute bottom-0 left-0 max-w-md bg-base-100 p-6 @2xl:p-8', {
              children: [
                el('p', 'font-heading text-xs font-bold uppercase tracking-[0.2em] text-base-content/50', { text: opts.kicker }),
                el('h2', 'mt-2 font-heading text-2xl font-black uppercase leading-[0.95] tracking-tightest text-base-content @2xl:text-4xl', {
                  text: opts.title,
                }),
                el('p', 'mt-2 max-w-xs text-sm text-base-content/80', { text: opts.sub }),
                el('div', 'mt-5 flex flex-wrap gap-3', {
                  children: [
                    btn('Shop Now', '/shop', { icon: arrowRight() }),
                    btn('Find Your Team', '/shop', { tone: 'outlineInk' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    'slide'
  );

// Prev/next live inside one full-bleed flex row (`inset-0 … items-center justify-between`)
// — a robust vertical centering that avoids the fractional `top-1/2` / `-translate-y-1/2`
// utilities surface-compile drops (which left the arrows stranded at the hero's bottom).
// The row is click-through (`pointer-events-none`); the buttons re-enable pointer events.
const arrowBtn = (role: 'prev' | 'next', glyph: string, label: string): BuilderNode =>
  part(
    el(
      'button',
      'pointer-events-auto grid h-10 w-10 place-items-center bg-base-100/80 text-xl leading-none text-base-content shadow-md backdrop-blur transition hover:bg-base-100',
      { attrs: { type: 'button', ariaLabel: label }, text: glyph }
    ),
    role
  );

const arrows = (): BuilderNode =>
  el('div', 'pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-4', {
    name: 'Controls',
    children: [arrowBtn('prev', '‹', 'Previous slide'), arrowBtn('next', '›', 'Next slide')],
  });

// A dot carries a TRANSPARENT, clipped bullet so the `<button>` is never EMPTY — an empty
// raw button renders a literal `<button>` placeholder. `ariaLabel` keeps it accessible.
const dot = (n: number): BuilderNode =>
  part(
    el(
      'button',
      'h-2.5 w-2.5 overflow-hidden rounded-full bg-base-100/60 leading-none text-transparent transition-all duration-300 data-[active=true]:w-6 data-[active=true]:bg-base-100',
      { attrs: { type: 'button', ariaLabel: `Go to slide ${n}` }, text: '•' }
    ),
    'dot'
  );

export function hero(): BuilderNode {
  return behave(
    el('section', 'relative w-full overflow-hidden bg-[#0a0d2b]', {
      name: 'Hero',
      attrs: { ariaLabel: 'Featured campaigns' },
      children: [
        part(
          el('div', 'flex transition-transform duration-700 ease-out', {
            name: 'Slides',
            children: [
              slide({
                gradientCls: GRAD.fire,
                glyph: '⚽',
                kicker: 'The Cup Collection',
                title: 'Your colors. Your game.',
                sub: 'Gear up in the new national kits — engineered for match day, styled for the streets.',
              }),
              slide({
                gradientCls: GRAD.blueDeep,
                glyph: '👟',
                kicker: 'Running',
                title: 'Built for the long run.',
                sub: 'The new Glide Boost — energy-return cushioning from the first step to the finish line.',
              }),
              slide({
                gradientCls: GRAD.pitch,
                glyph: '🥇',
                kicker: 'New Season',
                title: 'New season. New kit.',
                sub: 'Fresh drops across Originals, Running and Soccer — the styles climbing the charts.',
              }),
            ],
          }),
          'track'
        ),
        arrows(),
        el('div', 'absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2', {
          name: 'Dots',
          children: [dot(1), dot(2), dot(3)],
        }),
      ],
    }),
    { type: 'carousel', autoplay: true, interval: 6 }
  );
}
