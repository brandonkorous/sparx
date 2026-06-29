// Farm Fresh generator — the Home page tree. The biggest page: hero · quote ·
// two editorial split bands · values · menu showcase · how-it-works · locations ·
// testimonials · catering/gifts · order band. The emit splits these direct children
// into per-section files (parts/pages/home/NN-*.ts) so no single shipped file is a wall.
// Class strings track docs/mockups/examples/farmfreshbowls.html.

import { node, type BuilderNode } from '../_kit';
import {
  boundProductGrid,
  locationCard,
  splitBand,
  stepCard,
  testimonialCard,
  valueCard,
} from '../sections';

/** A small uppercase pill label (the mockup `.pill`). `cls` carries the per-context
 *  fill/foreground (sage on light, fern on the dark band). */
const pill = (text: string, cls: string): BuilderNode =>
  node('Text', {
    cls: `inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide ${cls}`,
    props: { variant: 'body', text },
  });

/** A decorative menu "tab" chip (visual only — every group renders below). */
const menuTab = (text: string, selected: boolean): BuilderNode =>
  node('Text', {
    cls: `rounded-full px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide ${
      selected ? 'bg-primary text-primary-content' : 'text-base-content/50'
    }`,
    props: { variant: 'body', text },
  });

export function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // Hero — a full-width cream section WRAPPING a contained berry "hero card": the
      // bold strawberry color sits in a rounded ~half-width block centered on the page.
      // Sizes to its content (no viewport min-height).
      node('Section', {
        box: {
          name: 'Hero',
          padding: 'xl',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
        },
        layout: { direction: 'stack', gap: 'none', alignItems: 'center', justify: 'center' },
        children: [
          node('Section', {
            // The berry hero card sizes to its CONTENT (w-fit, no max-width) so it
            // hugs the heading/buttons instead of stretching to a fixed 2xl column —
            // it renders tighter and reads as a centered block, not a wide band.
            cls: 'w-fit rounded-box shadow-lg',
            box: { surface: 'accent', padding: 'xl', align: 'center', contentWidth: 'full' },
            layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
            children: [
              node('Heading', { box: { align: 'center' }, props: { level: 'h2', text: '🍓' } }),
              node('Heading', {
                box: { align: 'center' },
                props: { level: 'h1', size: 'display', text: 'Here to deliver health' },
              }),
              node('Text', {
                box: { align: 'center' },
                props: {
                  variant: 'body',
                  text: 'Balanced, nutritious bowls made with local ingredients — without any chemicals or preservatives.',
                },
              }),
              node('Stack', {
                box: { padding: 'none' },
                layout: { direction: 'row', gap: 'sm', justify: 'center' },
                children: [
                  node('Button', { props: { label: 'Order Online', style: 'secondary', href: '/menu' } }),
                  node('Button', { props: { label: 'See the Menu', style: 'glass', href: '/menu' } }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Quote
      node('Section', {
        box: { name: 'Quote', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'none', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', {
            box: { align: 'center' },
            cls: 'text-2xl @3xl:text-3xl text-primary',
            props: {
              level: 'h2',
              text: '“Healthy bowls from healthy people, to make people healthy and happy.”',
            },
          }),
        ],
      }),
      // We really do care (text + photo) — berry head over a sage band.
      splitBand({
        name: 'We really do care',
        surface: 'subtle',
        heading: 'We Really Do Care',
        accent: 'accent',
        paragraphs: [
          'We care about your health. To make the most of your life, it’s important to take good care of it — because feeling good is where everything starts.',
          'So let us support you, and contribute to your healthy lifestyle with food that loves you back.',
        ],
        seed: 'care',
        cta: { label: 'Explore the Bowls', href: '/menu' },
      }),
      // We love for you to (photo + text) — leaf head on cream.
      splitBand({
        name: 'We love for you to',
        heading: 'We Love For You To',
        accent: 'primary',
        paragraphs: [
          '…experience the flavors of food the way it’s meant to taste — local, wholesome ingredients with nothing artificial.',
          'We balance the nutrients you need and serve the right portion size, every single time.',
        ],
        seed: 'love',
        photoFirst: true,
      }),
      // Values strip
      node('Section', {
        box: { name: 'Values', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: 4, gap: 'lg' },
        children: [
          valueCard('🌾', 'Locally Sourced', 'From farms within 60 miles'),
          valueCard('🚫', 'No Preservatives', 'Nothing artificial, ever'),
          valueCard('⚖️', 'Balanced Macros', 'Portioned by nutritionists'),
          valueCard('♻️', 'Eco Packaging', '100% compostable bowls'),
        ],
      }),
      // Menu showcase
      node('Section', {
        box: { name: 'Menu', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'lg', alignItems: 'center' },
        children: [
          node('Stack', {
            box: { padding: 'none', align: 'center' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'center' },
            children: [
              pill('🥗 Our Menu', 'bg-base-200 text-[#3E5C2A]'),
              node('Heading', {
                box: { align: 'center' },
                cls: 'text-4xl @3xl:text-5xl',
                props: { level: 'h2', text: 'Made fresh, built for you' },
              }),
              node('Text', {
                box: { align: 'center' },
                cls: 'max-w-xl',
                props: {
                  variant: 'body',
                  text: 'Every bowl is blended to order with seasonal produce. Pick a signature combination, or build your own at the counter.',
                },
              }),
              // Decorative tabs (visual only — all three groups render below).
              node('Stack', {
                box: { padding: 'none', align: 'center' },
                layout: { direction: 'row', gap: 'sm', justify: 'center', wrap: true },
                children: [
                  menuTab('Açaí Bowls', true),
                  menuTab('Smoothies', false),
                  menuTab('Salads & Grains', false),
                ],
              }),
            ],
          }),
          // Live product teaser — a handful of real, shoppable items (photo + title link
          // to the PDP, Add sells the scoped product). Bound to the live catalog, so it
          // fills with the tenant's products and is empty until any exist; the full grid
          // lives on the Menu page.
          boundProductGrid(3, 6),
          node('Button', { props: { label: 'See the full menu', style: 'accent', href: '/menu' } }),
        ],
      }),
      // How it works (moss band). Surface 'none' + explicit moss bg/light text: a
      // surface 'inverse' would force bg-neutral (ink) and beat the cls moss color.
      node('Section', {
        cls: 'bg-[#3E5C2A] text-[#FBF8F1]',
        box: { name: 'How it works', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'lg', alignItems: 'center' },
        children: [
          pill('How it works', 'bg-[#7FA85B]/30 text-white'),
          node('Heading', { box: { align: 'center' }, cls: 'text-4xl @3xl:text-5xl text-white', props: { level: 'h2', text: 'Fresh in three simple steps' } }),
          node('Section', {
            box: { padding: 'none', contentWidth: 'full' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              stepCard('🧺', '1 · We source', 'Produce is picked from partner farms the morning it’s served — nothing sits in storage.'),
              stepCard('🥄', '2 · We blend', 'Every bowl is built to order and portioned for balanced macros by our in-house team.'),
              stepCard('🚲', '3 · We deliver', 'Grab it at the counter or get free local delivery — always in compostable packaging.'),
            ],
          }),
        ],
      }),
      // Locations teaser
      node('Section', {
        box: { name: 'Locations', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'lg', alignItems: 'center' },
        children: [
          pill('📍 Find Us', 'bg-base-200 text-[#3E5C2A]'),
          node('Heading', { box: { align: 'center' }, cls: 'text-4xl @3xl:text-5xl', props: { level: 'h2', text: 'Two neighborhoods, one fresh standard' } }),
          node('Section', {
            box: { padding: 'none', contentWidth: 'full' },
            layout: { direction: 'grid', columns: 2, gap: 'lg' },
            children: [
              locationCard('Riverside Market', '214 Orchard Lane, Riverside, CA 92501', 'Mon–Fri · 7am–7pm · Sat–Sun · 8am–5pm', 'green'),
              locationCard('Downtown Commons', '88 Maple Street, Suite B, Riverside, CA 92507', 'Mon–Fri · 6:30am–8pm · Sat–Sun · 8am–6pm', 'acai'),
            ],
          }),
        ],
      }),
      // Testimonials
      node('Section', {
        box: { name: 'Testimonials', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'lg', alignItems: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, cls: 'text-3xl @3xl:text-4xl text-accent', props: { level: 'h2', text: 'Loved by the neighborhood' } }),
          node('Section', {
            box: { padding: 'none', contentWidth: 'full' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              testimonialCard('“The Midnight Açaí is my morning ritual now. You can actually taste how fresh everything is.”', 'Maya R.', 'Riverside', '🙂'),
              testimonialCard('“Finally a place where I trust every ingredient. The team knows their farmers by name.”', 'Daniel K.', 'Downtown', '😊'),
              testimonialCard('“Balanced, filling, and genuinely delicious. Gets me through marathon training weeks.”', 'Priya S.', 'Riverside', '😄'),
            ],
          }),
        ],
      }),
      // Catering + gift cards
      node('Section', {
        box: { name: 'Catering & gifts', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: 2, gap: 'lg' },
        children: [
          node('Card', {
            cls: 'p-9 st-hover--lift',
            box: { surface: 'brand', padding: 'none' },
            layout: { direction: 'stack', gap: 'md', alignItems: 'start', justify: 'between' },
            children: [
              node('Heading', { props: { level: 'h3', text: '🥗 Catering & Events' } }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Bowl bars, smoothie stations and grain platters for offices, weddings and team workouts. Built fresh, delivered on time.',
                },
              }),
              node('Button', { props: { label: 'Plan an event', style: 'accent', href: '/catering' } }),
            ],
          }),
          node('Card', {
            cls: 'p-9 st-hover--lift',
            box: { surface: 'secondary', padding: 'none' },
            layout: { direction: 'stack', gap: 'md', alignItems: 'start', justify: 'between' },
            children: [
              node('Heading', { props: { level: 'h3', text: '🎁 Gift Cards' } }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Give the gift of good food. Digital gift cards arrive instantly and never expire — redeemable at both locations and online.',
                },
              }),
              node('Button', { props: { label: 'Buy a gift card', style: 'primary', href: '/catering' } }),
            ],
          }),
        ],
      }),
      // Order / signup band — berry (accent), matching the mockup's bold order band.
      node('Section', {
        box: { name: 'Order', surface: 'accent', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, cls: 'text-4xl @3xl:text-5xl', props: { level: 'h2', text: 'Ready to eat fresh?' } }),
          node('Text', {
            box: { align: 'center' },
            cls: 'max-w-lg',
            props: {
              variant: 'body',
              text: 'Order online for pickup or free local delivery — or join our list for seasonal menus, new flavors, and the occasional treat.',
            },
          }),
          node('Button', { props: { label: 'Start an order', style: 'glass', href: '/menu' } }),
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
