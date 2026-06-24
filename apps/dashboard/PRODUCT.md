# Product

## Register

product

## Users

Tenant **operators**, across any vertical. sparx is a modular content-and/or-commerce OS, so the
person at the console is just as likely to be a CMS-only publisher, a CRM-only team, or a B2B/wholesale
distributor as a storefront merchant — all are first-class, none is the assumption. They arrive with a
job to run, not a tour to take: publish an article, fulfill a wholesale order, segment a customer list,
wire up an automation, compose a page in the builder. They span technical comfort levels and they live
in this console daily, often with real data volume. The dashboard is the single operator surface over
every module the tenant has activated.

## Product Purpose

The dashboard is the operator console for the sparx platform: one coherent workspace that reconfigures
itself around whichever modules a tenant pays for (commerce, CRM, CMS, B2B, email, builder, dropship,
invoicing, automations, inventory, scheduling, SEO, chat, AI). A disabled module simply isn't there.
Success is an operator getting a real task done quickly and confidently, in a surface that feels like
one product no matter which module they're in — never a bag of bolted-together admin panels. The
platform is API-first; this dashboard is one consumer of those APIs, and it should look and feel like
the reference client.

## Brand Personality

**Confident, modular, modern.** Plain-spoken and precise — it states what it does and gets out of the
way; no hype, no marketing voice inside the tool. "Modular" is literal identity, not a tagline: the
active module orients the operator through a consistent per-module color system (Commerce orange, CMS
teal, CRM cyan, Builder/Storefront indigo, …) carried identically across nav, card stripes, and accents,
so context is always legible without the app feeling like a different product per section. Expressive
where it earns attention (the active module, primary actions, state); restrained everywhere else.
Industry-neutral throughout — copy, defaults, and empty states never assume a vertical.

## Anti-references

- **Generic AI-slop SaaS.** No cream/sand/parchment backgrounds, no tiny uppercase tracked eyebrows over
  every section, no endless identical icon + heading + text card grids, no big-number hero-metric
  template, no gradient text. If the layout could be guessed from the word "dashboard" alone, it's the
  reflex and it gets reworked.
- **Vertical lock-in.** Nothing should read as built for one industry (no diesel/auto-parts or any single
  trade as the running example). A magazine publisher and a parts distributor must feel equally at home.
- **Re-skinned controls.** Feature code never hand-builds a button/input/badge out of utilities; appearance
  lives in `@sparx/ui` variants.

## Design Principles

1. **Content and/or commerce — never commerce-first.** Selling is one capability among many. Every module
   is a peer; the console never treats a store as the center of gravity.
2. **One product, many modules.** The surface reconfigures per active module (color, nav, available
   actions) but the component vocabulary, affordances, and rhythm stay identical screen to screen. Module
   color is the only thing that should change between modules.
3. **Earned confidence over decoration.** Standard affordances executed precisely (Linear/Stripe/Notion as
   the bar). Expressiveness is spent on the active module, primary actions, and state — never on chrome.
4. **Density with hierarchy.** Operators handle real volume; show it, but always grouped and prioritized.
   Never a flat gray wall of ungrouped fields, never an oversimplified toy.
5. **Industry-agnostic by construction.** Copy, defaults, illustrations, and empty states stay
   vertical-neutral so any tenant sees themselves in it.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. Body text ≥4.5:1 against its background, large text ≥3:1, placeholders held to the
same 4.5:1 (no light-gray-for-elegance). Full keyboard operability with a visible focus ring on every
interactive element; semantic z-index layering for overlays. Every animation honors
`prefers-reduced-motion` with a crossfade/instant fallback. Responsive is structural, not fluid type —
the platform's 3-tier collapse (sidebar → compact → stacked) applies to dashboard and builder alike, and
the surface stays usable on mobile. The per-module palette must not encode state by hue alone; pair color
with text/icon so color-blind operators aren't excluded.
