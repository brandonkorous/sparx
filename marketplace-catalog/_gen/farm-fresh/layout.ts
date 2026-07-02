// Farm Fresh generator — the site layout tree: announcement bar · sticky header
// · Outlet · footer. The Outlet is the only required node; everything else is author-
// composed chrome (CLAUDE.md "site layout is a free canvas").

import { node, type BuilderNode } from './_kit';
import { footerHead } from './sections';

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Menu', href: '/menu' },
  { label: 'Our Story', href: '/story' },
  { label: 'Locations', href: '/locations' },
  { label: 'Catering', href: '/catering' },
  { label: 'Contact', href: '/contact' },
];

export function layoutTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Site layout', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // Announcement bar
      node('Section', {
        box: {
          name: 'Announcement',
          surface: 'inverse',
          padding: 'sm',
          align: 'center',
          backgroundWidth: 'full',
          contentWidth: 'contained',
        },
        layout: { direction: 'row', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Text', {
            props: {
              variant: 'meta',
              text: '🌱  Free local delivery on orders over $35 · Fresh-pressed daily, never frozen',
            },
          }),
        ],
      }),
      // Header — a STICKY app-bar (mockup `#hdr`): a full-bleed cream band pinned to
      // the top on scroll (the announcement above it scrolls away), wrapping a
      // contained logo · nav · order-CTA row that must not stack on narrow widths.
      node('Section', {
        name: 'Header',
        cls: 'sticky top-0 z-30 bg-base-100 border-b border-base-300',
        box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
        layout: { direction: 'stack', gap: 'none' },
        children: [
          node('Section', {
            box: { padding: 'md', backgroundWidth: 'full', contentWidth: 'contained' },
            layout: { direction: 'row', justify: 'between', alignItems: 'center', collapse: false },
            children: [
              node('Wordmark', { bind: 'site.identity' }),
              // NavMenu is a CONTAINER of NavItem children (docs/57 rebuild) — the
              // container-native form the starter + platform emit.
              node('NavMenu', {
                props: { orientation: 'row' },
                children: NAV.map((l) => node('NavItem', { props: { label: l.label, href: l.href } })),
              }),
              node('Button', { props: { label: 'Order Online', style: 'accent', href: '/menu' } }),
            ],
          }),
        ],
      }),
      node('Outlet', { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } }),
      // Footer
      node('Section', {
        box: {
          name: 'Footer',
          surface: 'inverse',
          padding: 'xl',
          backgroundWidth: 'full',
          contentWidth: 'contained',
        },
        layout: { direction: 'stack', gap: 'lg', alignItems: 'start' },
        children: [
          node('Section', {
            box: { padding: 'none', contentWidth: 'full' },
            layout: { direction: 'grid', columns: 4, gap: 'lg' },
            children: [
              node('Stack', {
                box: { padding: 'none' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  node('Wordmark', { bind: 'site.identity' }),
                  node('Text', {
                    props: {
                      variant: 'body',
                      text: 'Balanced, nutritious bowls made with local ingredients — here to deliver health, one bowl at a time.',
                    },
                  }),
                  node('Button', {
                    cls: 'text-sm font-semibold text-[#7FA85B] transition-colors hover:text-white',
                    props: { label: 'Read the Journal →', href: '/journal' },
                  }),
                ],
              }),
              node('Stack', {
                box: { padding: 'none' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  footerHead('Contact'),
                  node('Text', { props: { variant: 'body', text: 'hello@farmfreshbowls.example' } }),
                  node('Text', { props: { variant: 'body', text: '(951) 555-0142' } }),
                  node('Text', {
                    props: { variant: 'body', text: '214 Orchard Lane, Riverside, CA 92501' },
                  }),
                ],
              }),
              node('Stack', {
                box: { padding: 'none' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  footerHead('Hours'),
                  node('Text', { props: { variant: 'body', text: 'Mon–Fri · 7am – 7pm' } }),
                  node('Text', { props: { variant: 'body', text: 'Saturday · 8am – 5pm' } }),
                  node('Text', { props: { variant: 'body', text: 'Sunday · 8am – 5pm' } }),
                ],
              }),
              node('Stack', {
                box: { padding: 'none' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  footerHead('Stay in the loop'),
                  node('Text', {
                    props: { variant: 'body', text: 'Seasonal menus, new flavors, the occasional treat.' },
                  }),
                  node('Signup', { props: { cta: 'Join' } }),
                  // Tenant social links (a SITE setting, set in the dashboard): the
                  // leaf renders nothing until the tenant adds them.
                  node('SocialLinks', { bind: 'site.social' }),
                ],
              }),
            ],
          }),
          // Bottom bar: a full-width, centered copyright line under the columns.
          node('Section', {
            box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full', align: 'center' },
            layout: { direction: 'stack', gap: 'none', alignItems: 'center' },
            children: [
              node('Text', {
                props: {
                  variant: 'meta',
                  text: '© 2026 Farm Fresh. All rights reserved.',
                },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
