---
title: Rejected & deferred services
node: integrations
type: decision
status: active
sources:
  - CLAUDE.md
  - docs/03-infrastructure-deployment.md
---

Recording the **non-choices** matters as much as the adoptions — it stops "why don't we just use X?" churn.

- **Email:** SendGrid / Postmark / SES — **rejected.** (Current = Mailgun; Postal decommissioned.)
- **Auth:** Auth0 / Clerk / any SaaS — **rejected** (self-hosted Better Auth). See [[better-auth]].
- **Cache:** Memorystore — **deferred to Phase 2** (Redis pod now). Trigger in [[phased-infra]].
- **Search:** Elasticsearch — **deferred to Phase 3** (Typesense chosen). See [[phased-infra]].
- **Agent tooling, NOT platform integrations:** Adobe, Gmail, and the GoDaddy/Stripe MCP *skills* are tools available to the agent — they are not wired into the product.

Related: [[phased-infra]], [[better-auth]], [[mailgun]]
