---
title: Packages
node: apps
type: reference
status: active
sources:
  - packages/
---

~60 workspace packages, grouped by domain (one line each):

**UI / design:** `@sparx/ui` (dashboard components) · `@sparx/site-ui` (site components, `--st-*`) · `@sparx/site-themes` (tenant theme presets + compiler) · `@sparx/surface-compile` (per-tenant CSS compile). → [[design]], [[components]].

**Builder / CMS:** `@sparx/builder-schemas` (BuilderNode schemas + the [[builder-catalog]]) · `@sparx/builder-render` (node→element map) · `@sparx/builder` · `@sparx/sitebuilder(-schemas)` · `@sparx/section-template-react` · `@sparx/cms-editor(-schemas)` · `@sparx/blueprints`.

**Commerce / inventory:** `@sparx/commerce(-schemas)` · `@sparx/inventory` · `@sparx/dropship` · `@sparx/channels`.

**Payments / billing / providers:** `@sparx/payments` (multi-gateway) · `@sparx/billing` (platform subscription) · `@sparx/integration-framework` · `provider-{avalara,taxjar,shippo,easypost,paypal(stub)}`. → [[stripe]].

**CRM / automation / scheduling:** `@sparx/crm(-schemas)` · `@sparx/automation(-schemas,-actions)` · `@sparx/scheduling(-schemas)` · `@sparx/attribution` · `@sparx/seo-audit`.

**Email / SMS:** `@sparx/email` (React Email + provider) · `@sparx/email-platform` · `@sparx/email-sends` (worker-safe enqueue) · `@sparx/sms`. → [[email-pipeline]].

**Auth / data / infra:** `@sparx/auth` (staff) · `@sparx/customer-auth` (shopper) · `@sparx/db` · `@sparx/events` · `@sparx/modules` · `@sparx/query` (TanStack) · `@sparx/api-core` · `@sparx/api-client`.

**Domains / legal / search:** `@sparx/godaddy` + `@sparx/registrar` ([[godaddy]]) · `@sparx/legal(-templates,-seed)` · `@sparx/search` (Typesense) · `@sparx/chat-widget` · `@sparx/marketplace-schemas` · `@sparx/partner-schemas` · `@sparx/site-mcp`.

Related: [[services]], [[architecture]]
