# CLAUDE.md — Piggles Project Instructions

You are working on Piggles, a full-power small-business platform with an MDI workbench.

## Non-negotiable rules

1. Piggles is not "Sparx Lite".
2. Keep the MDI/workbench interaction model unless a task explicitly says otherwise.
3. Simplify through terminology, hierarchy, defaults, onboarding, progressive disclosure, and intent-based actions — not by arbitrarily removing capability.
4. Avoid module-based pricing in Piggles.
5. All normal Piggles apps are included in the base subscription. Capacity/usage limits protect economics.
6. Do not make users understand CMS, CRM, headless, MDI, RBAC, collections, price books, or GraphQL unless in an explicitly advanced/developer context.
7. Piggles should feel playful and approachable, but never childish or joke-heavy.
8. Do not rename every feature into a pig pun.
9. Product language should be direct and human.
10. Reuse shared platform services instead of forking business logic wherever feasible.

## Canonical journey

- `meetpiggles.com` — discover and understand
- `getpiggles.com` — authenticate, sign up, onboard, provision
- `mypiggles.com` — operate the business

## Canonical brand

- Name: Piggles
- Tagline: "Business software for people who have a business to run."
- Mark: rounded pig-shaped P with pig snout inside
- Primary display typography: very round, thick, friendly
- Primary accent: pink/coral
- Neutral: deep navy/charcoal
- Character: capable, friendly, mildly mischievous, never silly during serious work

## UI framework — SilicaUI

Piggles uses **SilicaUI** (`@wizeworks/silicaui` and `@wizeworks/silicaui-react`) as the implementation design system.

Non-negotiable:

- Prefer SilicaUI components over bespoke replacements when an appropriate SilicaUI primitive/component exists.
- Use SilicaUI semantic color tokens, not arbitrary hard-coded Piggles colors inside components.
- Theme Piggles through `base-100`, `base-200`, `base-300`, `base-content`, `primary`, `secondary`, `accent`, `success`, `info`, `warning`, `error`, and each named color's matching `-content` token.
- `primary` is Piggles pink.
- Most MDI/workbench surfaces remain neutral base colors; do not flood the app with pink.
- Status colors are semantic, not decorative.
- Additional named colors require a durable semantic reason and a paired `-content` color.
- Piggles ships with first-class `light` and `dark` themes.
- Components must never hard-code separate light/dark colors when a SilicaUI semantic token exists.
- Theme switching must preserve MDI/workspace state.
- See `docs/brand/SILICAUI_THEME.md` and `config/brand.tokens.json`.

## UX defaults

Prefer: Home, My Site, Content, Get Found, Sell, Stock, Customers, Messages, Bookings, Invoices, Money, My Team, Automations, Partners, Connections.

## MDI behavior

The MDI is a differentiator. Preserve multiple simultaneous work surfaces, movable/resizable panels, task continuity, preview + editor combinations, cross-app workflows, and persisted workspaces. Reduce complexity with friendly app names, strong defaults, task-oriented entry points, global intent search, and progressive disclosure.

## Pricing

Base public target:

- $49/month
- all Piggles apps included
- 1 business
- 1 initial location
- 1 primary site
- 3 users included
- capacity limits for storage/email/contacts/etc.

Do not introduce Basic/Pro/Enterprise tiers unless product strategy changes explicitly.
