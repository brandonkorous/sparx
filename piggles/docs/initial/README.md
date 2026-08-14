# Piggles Implementation Pack

**Purpose:** Drop-in product, architecture, UX, brand, commercial, and rollout guidance for Claude Code and human contributors.

**Status:** Initial implementation handoff  
**Primary brand:** Piggles  
**Tagline:** Business software for people who have a business to run.

## What Piggles is

Piggles is a full-power business platform with an MDI workbench. It is **not** a stripped-down clone of Sparx. The same class of serious capabilities can exist underneath Piggles, but Piggles presents them with human terminology, opinionated defaults, progressive disclosure, simpler commercial packaging, and a warmer, memorable brand.

## UI implementation

Piggles uses **SilicaUI** as its canonical component and theme system, with first-class `light` and `dark` themes. Brand/UI implementation must follow SilicaUI semantic tokens rather than a separate ad-hoc palette. See `docs/brand/SILICAUI_THEME.md`.

## Product architecture in one sentence

**Meet Piggles** explains it, **Get Piggles** creates and onboards the customer, and **My Piggles** is where the work happens.

## Canonical domains

- `meetpiggles.com` — public marketing/content/SEO
- `getpiggles.com` — authentication, signup, onboarding, provisioning, billing, invite acceptance
- `mypiggles.com` — authenticated MDI workbench
- `api.mypiggles.com` — API surface
- `mcp.mypiggles.com` — MCP surface
- `status.meetpiggles.com` — public status
- separate tenant-site registrable domain preferred; `piggles.site` is the preferred pattern if available

## Pricing direction

**Piggles: $49/month**

- All normal Piggles apps/capabilities are included.
- Users enable apps for their workspace; enabling an app does not change price.
- Price grows through **capacity/usage**, not module unlocks.
- Suggested starting included team size: 3 users.

## Important implementation principle

Do **not** create duplicate domain logic for Sparx and Piggles if the capability can be shared. Prefer shared services and shared business logic with product-specific shells, terminology, navigation, defaults, branding, and entitlements.

See `INDEX.md` and `00_START_HERE.md`.
