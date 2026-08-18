// The tier-2 deep tours — one short, opt-in walk per module, offered on first
// open and replayable forever after (docs/132 §7). Where the welcome tour SHOWS
// AROUND ("your tools live on this rail"), these teach ONE tool: what it's for
// and the very first move, pointing at the real control that does it.
//
// This file is DATA + copy only, like steps.ts. A tour is a list of TourSteps in
// the module's hue. The first step is centered (no anchor) — a warm "here's what
// this is"; the rest spotlight a real button. When a button lives on a different
// surface than the one open when the tour starts (Selling's "Add a product" is on
// Products, not the Orders landing), the step carries `open`, and the runtime
// focuses that surface and waits for the button before pointing at it.
//
// Voice rules are the same house rules steps.ts obeys: written for a non-technical
// owner, full readable sentences, no jargon, no eyebrow labels.
//
// NOT here: email. Its surfaces are still stubs (nothing real to point at), so it
// has no tour until it's built — TOURABLE_MODULES is the source of truth for which
// modules offer one, and email is deliberately absent.

import type { TourModule, TourStep } from './types';

export { moduleLabel } from '../surfaces/nav';

/** A module's deep tour: its hue-carrying steps, in order. */
export interface ModuleTour {
  module: TourModule;
  steps: TourStep[];
}

/**
 * Every module that ships a deep tour today, in the order a new owner most likely
 * meets them. Email is intentionally omitted — its surfaces are placeholders, so
 * there is no real control to anchor a step to yet. A module having a tour here is
 * what makes its first-open offer appear; add email the day its screens land.
 */
const MODULE_TOURS: ModuleTour[] = [
  {
    module: 'builder',
    steps: [
      {
        id: 'builder-intro',
        module: 'builder',
        title: 'Build your website',
        body: 'This is your site editor. You add pieces to the page — a heading, an image, a row of products — and arrange them by dragging. No code, and nothing you do here goes live until you say so.',
        phase: 2,
      },
      {
        id: 'builder-preview',
        anchor: 'builder-preview',
        module: 'builder',
        side: 'bottom',
        align: 'end',
        // Also carried so a REPLAY works when the editor is closed — the controller
        // re-focuses an already-open surface, so this is a no-op when offered.
        open: { surface: 'builder.studio' },
        title: 'See it the way visitors will',
        body: 'Preview opens your page exactly as a customer would see it, on a real screen size, before anyone else can. It costs nothing to look as often as you like.',
        phase: 2,
      },
      {
        id: 'builder-save',
        anchor: 'builder-save',
        module: 'builder',
        side: 'bottom',
        align: 'end',
        open: { surface: 'builder.studio' },
        title: 'Save, then publish when it’s ready',
        body: 'Save keeps your changes without showing them to the world. When the page is how you want it, publishing is what makes it live. Until then, only you can see it.',
        phase: 2,
      },
    ],
  },
  {
    module: 'commerce',
    steps: [
      {
        id: 'commerce-intro',
        module: 'commerce',
        title: 'Sell your products',
        body: 'Selling keeps your products, your orders, and your sales in one place. Orders arrive here on their own as customers buy — so your first move is simply giving them something to buy.',
        phase: 2,
      },
      {
        id: 'commerce-add-product',
        anchor: 'commerce-add-product',
        module: 'commerce',
        side: 'bottom',
        align: 'end',
        // Lives on Products, not the Orders landing — open it first.
        open: { surface: 'commerce.products.list' },
        title: 'Add your first product',
        body: 'This is your product list. Add a product — its name, a photo, and a price — and it can be on your website within a minute, ready to sell.',
        phase: 2,
      },
    ],
  },
  {
    module: 'crm',
    steps: [
      {
        id: 'crm-intro',
        module: 'crm',
        title: 'Know your customers',
        body: 'Everyone who buys from you or gets in touch shows up here, with their whole history — every order, message, and note — in one place.',
        phase: 2,
      },
      {
        id: 'crm-add-customer',
        anchor: 'crm-add-customer',
        module: 'crm',
        side: 'bottom',
        align: 'end',
        open: { surface: 'crm.customers.list' },
        title: 'Add someone, or let them arrive',
        body: 'You can add a customer yourself here — handy for someone you already know. Or do nothing: people are added automatically the first time they buy or reach out.',
        phase: 2,
      },
    ],
  },
  {
    module: 'cms',
    steps: [
      {
        id: 'cms-intro',
        module: 'cms',
        title: 'Publish your content',
        body: 'Content is where you write anything you want the world to read — posts, pages, articles, news. Everything you publish is listed here, ready to edit any time.',
        phase: 2,
      },
      {
        id: 'cms-new',
        anchor: 'cms-new',
        module: 'cms',
        side: 'bottom',
        align: 'end',
        open: { surface: 'cms.content.list' },
        title: 'Write your first post',
        body: 'Start something new here. Give it a title, write your words, and publish when you’re happy — or save it and come back to finish later.',
        phase: 2,
      },
    ],
  },
  {
    module: 'scheduling',
    steps: [
      {
        id: 'scheduling-intro',
        module: 'scheduling',
        title: 'Take bookings',
        body: 'Scheduling lets customers book your time online. Every appointment shows up on this calendar the moment it’s made, so your day is always in one view.',
        phase: 2,
      },
      {
        id: 'scheduling-take-booking',
        anchor: 'scheduling-take-booking',
        module: 'scheduling',
        side: 'bottom',
        align: 'end',
        // The create control lives on Bookings, not the Calendar landing.
        open: { surface: 'scheduling.bookings.list' },
        title: 'Add a booking yourself',
        body: 'This is the full list of your bookings. Take a booking to add one by hand — for a phone or walk-in customer — and it lands on your calendar too. Customers can book themselves online once your site is live.',
        phase: 2,
      },
    ],
  },
  {
    module: 'b2b',
    steps: [
      {
        id: 'b2b-intro',
        module: 'b2b',
        title: 'Sell wholesale',
        body: 'Wholesale is for selling to other businesses rather than the public — each gets its own account, its own login, and prices you set just for them.',
        phase: 2,
      },
      {
        id: 'b2b-add-account',
        anchor: 'b2b-add-account',
        module: 'b2b',
        side: 'bottom',
        align: 'end',
        open: { surface: 'b2b.accounts.list' },
        title: 'Set up a trade account',
        body: 'Add your first business customer here. Once their account is approved, they can sign in and shop at the wholesale prices you’ve given them.',
        phase: 2,
      },
    ],
  },
];

/** The modules that offer a deep tour, in first-meet order. */
export const TOURABLE_MODULES: TourModule[] = MODULE_TOURS.map((tour) => tour.module);

const BY_MODULE = new Map<TourModule, ModuleTour>(MODULE_TOURS.map((tour) => [tour.module, tour]));

/** The deep tour for a module, or null if it doesn't have one (e.g. email). */
export function getModuleTour(module: TourModule): ModuleTour | null {
  return BY_MODULE.get(module) ?? null;
}

/** Whether a module string is one we offer a deep tour for. Narrows the wider
 *  WorkbenchModule union (which includes untourable modules) down to TourModule. */
export function isTourableModule(module: string): module is TourModule {
  return BY_MODULE.has(module as TourModule);
}
