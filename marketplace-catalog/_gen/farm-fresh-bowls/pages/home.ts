// Farm Fresh Bowls generator — the Home page tree. The biggest page: hero · quote ·
// two editorial split bands · values · menu showcase · how-it-works · locations ·
// testimonials · catering/gifts · order band. The emit splits these direct children
// into per-section files (parts/pages/home/NN-*.ts) so no single shipped file is a wall.

import { node, type BuilderNode } from '../_kit';
import {
  locationCard,
  menuGroup,
  splitBand,
  stepCard,
  testimonialCard,
  valueCard,
} from '../sections';
import { ACAI, SALADS, SMOOTHIES } from '../menu-data';

export function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // Hero — a full-width section (cream) WRAPPING a contained berry "hero card":
      // the bold strawberry color sits in a rounded ~half-width block centered on the
      // page (50vh tall) instead of a full-bleed band, so there's no full-width color
      // backdrop. No remote image, so it never waits on / breaks from a photo load.
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
            // ~half width, 50vh, rounded berry card centered in the section.
            cls: 'w-full max-w-2xl rounded-box shadow-lg',
            box: {
              surface: 'accent',
              height: 'md',
              padding: 'xl',
              align: 'center',
              contentWidth: 'full',
            },
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
                  // On the berry card: a mango (secondary) primary CTA pops, and a
                  // frosted-light "See the Menu" reads as the ghost button in the mockup.
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
              node('Badge', { props: { label: '🥗 Our Menu' } }),
              node('Heading', { box: { align: 'center' }, props: { level: 'h2', text: 'Made fresh, built for you' } }),
              node('Text', {
                box: { align: 'center' },
                props: {
                  variant: 'body',
                  text: 'Every bowl is blended to order with seasonal produce. Pick a signature combination, or build your own at the counter.',
                },
              }),
            ],
          }),
          menuGroup('Açaí & Smoothie Bowls', ACAI, 3),
          menuGroup('Cold-Pressed Smoothies', SMOOTHIES, 4),
          menuGroup('Salads & Grain Bowls', SALADS, 3),
          node('Button', { props: { label: 'Order the full menu', style: 'accent', href: '/menu' } }),
        ],
      }),
      // How it works (dark band)
      node('Section', {
        box: { name: 'How it works', surface: 'inverse', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'lg', alignItems: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, props: { level: 'h2', text: 'Fresh in three simple steps' } }),
          node('Section', {
            box: { padding: 'none', contentWidth: 'full' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              stepCard('1 · We source', 'Produce is picked from partner farms the morning it’s served — nothing sits in storage.'),
              stepCard('2 · We blend', 'Every bowl is built to order and portioned for balanced macros by our in-house team.'),
              stepCard('3 · We deliver', 'Grab it at the counter or get free local delivery — always in compostable packaging.'),
            ],
          }),
        ],
      }),
      // Locations teaser
      node('Section', {
        box: { name: 'Locations', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'lg', alignItems: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, props: { level: 'h2', text: 'Two neighborhoods, one fresh standard' } }),
          node('Section', {
            box: { padding: 'none', contentWidth: 'full' },
            layout: { direction: 'grid', columns: 2, gap: 'lg' },
            children: [
              locationCard('Riverside Market', '214 Orchard Lane, Riverside, CA 92501', 'Mon–Fri · 7am–7pm · Sat–Sun · 8am–5pm'),
              locationCard('Downtown Commons', '88 Maple Street, Suite B, Riverside, CA 92507', 'Mon–Fri · 6:30am–8pm · Sat–Sun · 8am–6pm'),
            ],
          }),
        ],
      }),
      // Testimonials
      node('Section', {
        box: { name: 'Testimonials', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'lg', alignItems: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, props: { level: 'h2', text: 'Loved by the neighborhood' } }),
          node('Section', {
            box: { padding: 'none', contentWidth: 'full' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              testimonialCard('“The Midnight Açaí is my morning ritual now. You can actually taste how fresh everything is.”', 'Maya R. · Riverside'),
              testimonialCard('“Finally a place where I trust every ingredient. The team knows their farmers by name.”', 'Daniel K. · Downtown'),
              testimonialCard('“Balanced, filling, and genuinely delicious. Gets me through marathon training weeks.”', 'Priya S. · Riverside'),
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
            box: { surface: 'brand', padding: 'xl' },
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
            box: { surface: 'secondary', padding: 'xl' },
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
          node('Heading', { box: { align: 'center' }, props: { level: 'h2', text: 'Ready to eat fresh?' } }),
          node('Text', {
            box: { align: 'center' },
            props: {
              variant: 'body',
              text: 'Order online for pickup or free local delivery — or join our list for seasonal menus, new flavors, and the occasional treat.',
            },
          }),
          node('Button', { props: { label: 'Start an order', style: 'glass', href: '/menu' } }),
          node('Signup', { props: { cta: 'Sign up' } }),
        ],
      }),
    ],
  });
}
