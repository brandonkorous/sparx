// Farm Fresh generator — assembles the full blueprint manifest from the section
// modules. This is the ONE place the tree builders are invoked, so it owns the shared
// node-id ordering: ids advance in `node()` call order (CLAUDE.md), and that order is
// fixed by the property order below — `layout.tree` first, then `pages` (Home, Menu, Our
// Story, Locations, Catering, Contact, Journal, Product, Blog Post), then `emails`
// (Welcome). Reorder a property and every downstream id shifts, so KEEP this order
// stable across edits.
//
// `brand`, `theme`, `assets`, `content`, `commerce` are pure data imported above — they
// contain no node() calls, so no ids are minted until `layout.tree` evaluates.

import { brand, theme } from './theme';
import { assets, commerce } from './commerce';
import { brandAssets } from './logo';
import { content, blogImageAssets } from './cms';
import { layoutTree } from './layout';
import { homeTree } from './pages/home';
import { menuTree } from './pages/menu';
import { storyTree } from './pages/story';
import { locationsTree } from './pages/locations';
import { cateringTree } from './pages/catering';
import { contactTree } from './pages/contact';
import { journalTree } from './pages/journal';
import { productTemplate, postTemplate } from './pages/templates';
import { welcomeEmail } from './email';

export const manifest = {
    key: 'farm-fresh',
    version: '1.0.17',
    name: 'Farm Fresh',
    summary:
        'A warm, organic storefront for a fresh-food brand — açaí bowls, smoothies and salads with a full menu, a brand story, locations, catering, and a welcome email. A ready-to-edit retail starter.',
    vertical: 'retail',
    requiresModules: ['builder', 'commerce', 'cms', 'email'],

    brand,

    theme,

    // Product imagery, blog covers, and the brand logo/favicon (all self-contained SVG
    // data URIs).
    assets: [...assets, ...blogImageAssets, ...brandAssets],

    content,

    commerce,

    layout: { name: 'Farm Fresh layout', tree: layoutTree(), makeActive: true },

    pages: [
        {
            name: 'Home',
            kind: 'singleton' as const,
            tree: homeTree(),
            seoTitle: 'Farm Fresh — Here to deliver health',
            seoDescription: 'Balanced, nutritious bowls made with local ingredients — açaí bowls, smoothies and salads.',
        },
        {
            name: 'Menu',
            kind: 'singleton' as const,
            slug: 'menu',
            tree: menuTree(),
            seoTitle: 'Menu — Farm Fresh',
            seoDescription: 'Order açaí bowls, cold-pressed smoothies, and grain bowls for pickup or free local delivery.',
        },
        {
            name: 'Our Story',
            kind: 'singleton' as const,
            slug: 'story',
            tree: storyTree(),
            seoTitle: 'Our Story — Farm Fresh',
            seoDescription:
                'How Farm Fresh started — one counter, a blender, and three farms we could drive to. The people and produce behind every bowl.',
        },
        {
            name: 'Locations',
            kind: 'singleton' as const,
            slug: 'locations',
            tree: locationsTree(),
            seoTitle: 'Locations — Farm Fresh',
            seoDescription:
                'Find Farm Fresh in Riverside — two neighborhood counters with pickup and free local delivery. Addresses, hours, and directions.',
        },
        {
            name: 'Catering',
            kind: 'singleton' as const,
            slug: 'catering',
            tree: cateringTree(),
            seoTitle: 'Catering & Events — Farm Fresh',
            seoDescription:
                'Bowl bars, smoothie stations and grain platters for offices, weddings and team workouts — built fresh and delivered on time.',
        },
        {
            name: 'Contact',
            kind: 'singleton' as const,
            slug: 'contact',
            tree: contactTree(),
            seoTitle: 'Contact — Farm Fresh',
            seoDescription:
                'Get in touch with Farm Fresh — email, call, catering requests, store hours, and directions to both Riverside counters.',
        },
        {
            name: 'Journal',
            kind: 'singleton' as const,
            slug: 'journal',
            tree: journalTree(),
            seoTitle: 'The Journal — Farm Fresh',
            seoDescription:
                'Notes from the counter — how we source within 60 miles, what’s in season, and the people behind the bowls.',
        },
        {
            name: 'Product',
            kind: 'collection' as const,
            recordType: 'commerce.product',
            isDefault: true,
            tree: productTemplate(),
        },
        {
            name: 'Blog Post',
            kind: 'collection' as const,
            recordType: 'cms.blog_post',
            isDefault: true,
            tree: postTemplate(),
        },
    ],

    emails: [
        {
            name: 'Welcome',
            subject: 'Welcome to Farm Fresh',
            preheader: 'Fresh menus, new flavors, and the occasional treat.',
            tree: welcomeEmail(),
        },
    ],
};
