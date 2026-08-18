---
title: Packages
node: apps
type: reference
status: active
sources:
  - packages/
---

~60 workspace packages, grouped by domain (one line each):

**UI / design:** `@wizeworks/ui` (dashboard components) · `@sparx/site-ui` (site components, `--st-*`) · `@wizeworks/site-themes` (tenant theme presets + compiler) · `@wizeworks/surface-compile` (per-tenant CSS compile). → [[design]], [[components]].

**Builder / CMS:** `@wizeworks/builder-schemas` (BuilderNode schemas + the [[builder-catalog]]) · `@wizeworks/builder-render` (node→element map) · `@wizeworks/builder` · `@wizeworks/sitebuilder(-schemas)` · `@wizeworks/section-template-react` · `@wizeworks/cms-editor(-schemas)` · `@wizeworks/blueprints`.

**Commerce / inventory:** `@wizeworks/commerce(-schemas)` · `@wizeworks/inventory` · `@wizeworks/dropship` · `@wizeworks/channels`.

**Payments / billing / providers:** `@wizeworks/payments` (multi-gateway) · `@wizeworks/billing` (platform subscription) · `@wizeworks/integration-framework` · `provider-{avalara,taxjar,shippo,easypost,paypal(stub)}`. → [[stripe]].

**CRM / automation / scheduling:** `@wizeworks/crm(-schemas)` · `@wizeworks/automation(-schemas,-actions)` · `@wizeworks/scheduling(-schemas)` · `@wizeworks/attribution` · `@wizeworks/seo-audit`.

**Email / SMS:** `@wizeworks/email` (React Email + provider) · `@wizeworks/email-platform` · `@wizeworks/email-sends` (worker-safe enqueue) · `@wizeworks/sms`. → [[email-pipeline]].

**Auth / data / infra:** `@wizeworks/auth` (staff) · `@wizeworks/customer-auth` (shopper) · `@wizeworks/db` · `@wizeworks/events` · `@wizeworks/modules` · `@wizeworks/query` (TanStack) · `@wizeworks/api-core` · `@wizeworks/api-client`.

**Domains / legal / search:** `@wizeworks/godaddy` + `@wizeworks/registrar` ([[godaddy]]) · `@wizeworks/legal(-templates,-seed)` · `@wizeworks/search` (Typesense) · `@wizeworks/chat-widget` · `@wizeworks/marketplace-schemas` · `@wizeworks/partner-schemas` · `@wizeworks/site-mcp`.

Related: [[services]], [[architecture]]
