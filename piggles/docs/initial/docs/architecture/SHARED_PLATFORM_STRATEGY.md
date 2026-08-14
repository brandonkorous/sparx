# Shared Platform Strategy

## Objective

Allow Sparx and Piggles to compete as brands/products without maintaining two independent business platforms.

## Share by default

Share persistence, business rules, background jobs, queues, auth primitives, content engine, commerce engine, customer service, inventory, scheduling, invoicing, media, email delivery, automation runtime, events/webhooks, audit logging, search, API, and MCP.

## Product adapters

Use adapters/configuration for terminology, app names/icons, nav order, workspace presets, onboarding, entitlement plans, support/help copy, UI theming, visible advanced features, and defaults.

## Avoid

- copying whole services into `piggles-*`;
- branching data models solely for branding;
- hard-coding `sparx` into domain business logic;
- scattered product checks in UI code.

## Preferred patterns

- registry-driven apps
- product configuration object
- theme tokens
- capability flags
- centralized entitlement service
- product-neutral API contracts
