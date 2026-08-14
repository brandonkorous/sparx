# System Architecture

## Architectural goal

Support Sparx and Piggles as separate product experiences over shared platform capability wherever practical.

```text
                         Shared Platform
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
   Identity/Auth          Domain Services       Infrastructure
        │               site/content/crm/...         │
        │                      │                      │
   ┌────┴────┐            ┌────┴────┐            telemetry
   │         │            │         │
Sparx UI  Piggles UI   Sparx rules Piggles rules
```

## Product surfaces

```text
meetpiggles.com
  └─ public marketing, content, SEO, pricing, docs/help

getpiggles.com
  └─ auth, signup, onboarding, billing entry, provisioning, invites

mypiggles.com
  └─ authenticated MDI workbench
      ├─ Home
      ├─ My Site
      ├─ Sell
      ├─ Customers
      └─ ...
```

## Shared by default

Prefer shared identity, business/tenant core, customers, catalog, orders, inventory, content, scheduling, invoicing, media, email infrastructure, automation engine, APIs, MCP infrastructure, audit/event systems.

Product-specific: branding, navigation, terminology, onboarding, defaults, visible IA, pricing/entitlements, workspace presets, help language, marketing content.

## Auth across separate domains

Do not rely on shared cookies between `getpiggles.com` and `mypiggles.com`.

Recommended:

1. authenticate at Get Piggles;
2. complete onboarding/provisioning;
3. issue a short-lived authorization-code style handoff;
4. My Piggles exchanges/validates it server-side;
5. My Piggles establishes its own secure session.

## App registry

Use a registry-driven app shell so customer-visible app names, icons, enablement, route/window entry points, and capability requirements can be product-specific without duplicating business logic.

## Entitlements

Entitlements should answer:

- is the business subscribed?
- is this app enabled in the workspace?
- is this feature available to this product?
- is a usage/capacity threshold exceeded?
- is the current role allowed?

Do not conflate "app enabled" with "app paid for".

## API and docs

Recommended service hosts:

- `api.mypiggles.com`
- `mcp.mypiggles.com`

Keep public docs on `meetpiggles.com/docs` to consolidate link equity.
