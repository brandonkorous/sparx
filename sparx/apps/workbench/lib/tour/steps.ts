// The first-run product-tour catalog — WHAT we walk a new owner through.
//
// This file is intentionally just DATA + copy, decoupled from the tour runtime
// (use-tour.ts). A step names a stable `data-tour` anchor, the concept
// it teaches, and the words a non-technical owner reads. Keeping the content here
// means the curriculum can be edited, reordered, and reviewed without touching any
// runtime code.
//
// Full curriculum, principles, theming and persistence: docs/132-workbench-product-tour.md.
//
// Voice rules that bind this copy (house rules, not preferences):
//   • Written for non-technical business owners — no app jargon ("pane", "module",
//     "surface"). Say screen, tool, business.
//   • Full sentences a person is meant to READ; no eyebrow/kicker labels (the
//     progress dot carries "where am I"), no faded text.
//   • Each step earns its place — orientation, not a feature dump.

import type { TourModule, TourStep } from './types';

export { tourSelector } from './types';

/**
 * Phase 1 — the always-shown core-shell orientation, minus the closing card.
 * Every anchor here is always-present chrome (toolbar / rail / dock), so no step
 * needs a tool opened first.
 */
const CORE_STEPS: TourStep[] = [
  {
    id: 'welcome',
    // Centered, no target — the opening card. Sparky greets beside the text.
    title: 'Welcome to your workbench',
    body: "This is where you run your business — your site, your customers, your sales, all in one place. Here's a one-minute tour of how to get around. You can leave any time and pick it back up later.",
    art: 'mascot',
    phase: 1,
  },
  {
    id: 'workspace',
    anchor: 'workspace',
    side: 'bottom',
    align: 'start',
    title: 'This is your business',
    body: 'Your business name sits up here, so you always know where you are.',
    phase: 1,
  },
  {
    id: 'site-switcher',
    anchor: 'site-switcher',
    side: 'bottom',
    align: 'start',
    // The single most important mental model: a site IS the business a customer
    // deals with, and switching one swaps the whole identity.
    title: 'Run more than one business?',
    body: 'Each business you run gets its own site — its own name, look, and customers. Switch between them here, and everything on screen follows. Your work stays saved separately for each one, so they never mix.',
    phase: 1,
  },
  {
    id: 'search',
    anchor: 'search',
    side: 'bottom',
    align: 'center',
    title: 'Find anything, fast',
    body: "Looking for a product, a customer, an order, or any screen? Click here — or press Ctrl-K (⌘K on a Mac) — and start typing. It's the quickest way around.",
    phase: 1,
  },
  {
    id: 'module-rail',
    anchor: 'module-rail',
    side: 'right',
    align: 'start',
    title: 'Your tools live on this rail',
    body: "Everything sparx can do — your website, sales, customers, email — is a tool on this rail. You'll only see the ones you've turned on. Click any to open it.",
    phase: 1,
  },
  {
    id: 'dock',
    anchor: 'dock',
    side: 'left',
    align: 'center',
    title: 'Your work opens here',
    body: "Screens open in this space and stack side by side, so you can keep an eye on more than one thing. They stay exactly as you left them for each business — and if you have unsaved changes, we'll always ask before anything is lost.",
    phase: 1,
  },
  {
    id: 'favorite-star',
    anchor: 'favorite-star',
    side: 'bottom',
    align: 'end',
    title: 'Keep your favorites close',
    body: 'Tap the star on any screen to pin it to the top of search, so the things you do every day are always one click away.',
    phase: 1,
  },
];

/** The warm close — always last, after any per-module steps. Two steps: the
 *  feedback button (its own toolbar control) then the account menu (the finale,
 *  where replaying the tour lives). */
const CLOSING_STEPS: TourStep[] = [
  {
    id: 'feedback',
    anchor: 'feedback',
    side: 'bottom',
    align: 'end',
    title: 'Tell us anything',
    body: "Have an idea, a question, or something that isn't working? Send it here — a real person reads every message, and it goes straight to the team building sparx.",
    phase: 1,
  },
  {
    id: 'account-menu',
    anchor: 'account-menu',
    side: 'bottom',
    align: 'end',
    title: "We're right here",
    body: "This is your account — your details, sign out, and a shortcut to replay this tour any time. That's the whole tour. Enjoy your workbench!",
    phase: 1,
  },
];

/**
 * Phase 2 — one "first move" per module, in a sensible starting order. Each
 * highlights the module's own rail icon (in the module's hue) and names the very
 * first thing to do. A step is only shown when its rail icon is actually present
 * (see buildTourSteps) — the rail already renders only enabled, visible modules,
 * so its presence IS the enablement gate. No dock is opened; the rail teaches
 * where the tool lives, the copy names the first action.
 */
interface ModuleStepDef {
  slug: TourModule;
  title: string;
  body: string;
}

const MODULE_STEP_DEFS: ModuleStepDef[] = [
  {
    slug: 'builder',
    title: 'Build your website',
    body: "Design your pages and publish your site — drag, drop, done, no code. This is where you'll shape how your business looks online.",
  },
  {
    slug: 'commerce',
    title: 'Sell your products',
    body: 'Your products, orders, and sales all live here. Your first move: add a product, so you have something to sell.',
  },
  {
    slug: 'crm',
    title: 'Know your customers',
    body: 'Everyone who buys from or contacts you shows up here, with their whole history in one place. Add a customer, or let them arrive as they come.',
  },
  {
    slug: 'cms',
    title: 'Publish your content',
    body: 'Write posts, pages, and articles — anything you want the world to read. Your first move: write your first post.',
  },
  {
    slug: 'email',
    title: 'Email your customers',
    body: 'Send a newsletter or a quick update, then see who opened it. Your first move: send your first message.',
  },
  {
    slug: 'scheduling',
    title: 'Take bookings',
    body: 'Let customers book your time online. Set up your services and hours here, and appointments land straight on your calendar.',
  },
  {
    slug: 'b2b',
    title: 'Sell wholesale',
    body: 'Sell to other businesses with their own accounts and pricing. Set up your wholesale customers and price lists here.',
  },
];

/** A module step is present only when its rail icon is on screen. */
function moduleStepIfPresent(def: ModuleStepDef): TourStep | null {
  if (typeof document === 'undefined') return null;
  if (!document.querySelector(`[data-tour="module-${def.slug}"]`)) return null;
  return {
    id: `module-${def.slug}`,
    anchor: `module-${def.slug}`,
    side: 'right',
    align: 'center',
    module: def.slug,
    title: def.title,
    body: def.body,
    phase: 2,
  };
}

/**
 * The full ordered tour for THIS tenant: core shell orientation → one step per
 * enabled module → the warm close. Recomputed each launch, so enabling a module
 * (or a replay after enabling one) picks up its step with no other change.
 */
export function buildTourSteps(): TourStep[] {
  const moduleSteps = MODULE_STEP_DEFS.map(moduleStepIfPresent).filter(
    (s): s is TourStep => s !== null
  );
  return [...CORE_STEPS, ...moduleSteps, ...CLOSING_STEPS];
}
