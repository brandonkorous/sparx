// Site — designing what visitors actually see.

import { Component, Globe, Inbox, LayoutTemplate, Mail, Pencil } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { stub } from './stub';

export const BUILDER_SURFACES: SurfaceDefinition[] = [
  stub({
    key: 'builder.studio',
    title: 'Editor',
    module: 'builder',
    icon: Pencil,
    order: 1,
    keywords: ['design', 'edit site', 'studio', 'drag and drop', 'layout'],
    body: 'The visual editor where you build and change your pages by dragging pieces around.',
  }),

  /* ── Design ────────────────────────────────────────────────────────────── */
  stub({
    key: 'builder.site',
    title: 'Pages & layout',
    module: 'builder',
    icon: Globe,
    section: 'Design',
    order: 10,
    keywords: ['navigation', 'header', 'footer', 'menu', 'structure'],
    body: 'The pages your site has, and the header, footer, and menus that wrap around every one of them.',
  }),
  stub({
    key: 'builder.blueprints',
    title: 'Blueprints',
    module: 'builder',
    icon: LayoutTemplate,
    section: 'Design',
    order: 11,
    keywords: ['templates', 'starters', 'themes'],
    body: 'Ready-made site designs you can start from instead of building a page from nothing.',
  }),
  stub({
    key: 'builder.components',
    title: 'Saved pieces',
    module: 'builder',
    icon: Component,
    section: 'Design',
    order: 12,
    keywords: ['components', 'blocks', 'reusable', 'sections'],
    body: 'Parts of a page you built once and want to reuse — change it here and it changes everywhere it appears.',
  }),
  stub({
    key: 'builder.email',
    title: 'Email designs',
    module: 'builder',
    icon: Mail,
    section: 'Design',
    order: 13,
    keywords: ['newsletter', 'template', 'campaign design'],
    body: 'The same editor, pointed at the emails you send instead of the pages you publish.',
  }),

  /* ── Forms ─────────────────────────────────────────────────────────────── */
  stub({
    key: 'builder.forms',
    title: 'Form submissions',
    module: 'builder',
    icon: Inbox,
    section: 'Forms',
    order: 20,
    keywords: ['contact', 'enquiries', 'leads', 'messages'],
    body: 'What people typed into the forms on your site — contact requests, enquiries, sign-ups.',
  }),
];
