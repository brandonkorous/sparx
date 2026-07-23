# sparx Platform — WizeWorks Admin Portal Spec

**Version:** 1.2
**Author:** Brandon Korous
**Last Updated:** 2026-07-22

---

> **Reconciled 2026-07-22 (docs-vs-built audit):** This portal is **BUILT** — the sparx operations console ships in `apps/admin` at `app/(console)/sparx/*` (tenants, users, billing, domains, sites, metrics, partners, feedback, support), backed by audited api-rest `/internal/operator/*` endpoints and a separate WizeWorks Better Auth staff instance. It is **no longer a planned/empty placeholder.** One deliberate design change from this spec: the interactive **"Impersonate tenant"** tool (§3, §4) was **replaced by a READ-ONLY account view** (build-plan decision **D7** — no `tenant:impersonate` capability, no impersonation token, no change to the tenant app). Operators understand an account through representation parity (the tenant's own formatters/labels/statuses, rendered read-only), never by assuming a tenant session. Capability model + full decisions live in [docs/apps/admin/build-plan.md](apps/admin/build-plan.md).

## 1. Overview

`admin.wize.works` is the unified WizeWorks operations portal. It provides internal staff with oversight, management, and support tooling across all WizeWorks products — sparx, kanNINJA, HelpNinja, and future products.

**Domain:** admin.wize.works  
**Auth:** Better Auth, WizeWorks staff only. Completely separate from sparx tenant auth.  
**GCP project:** WizeWorks project (NOT SparxWorks project — keep internal ops separate from product infrastructure)

---

## 2. Access Model

WizeWorks staff roles (Better Auth organization = WizeWorks):

| Role          | Access                                      |
| ------------- | ------------------------------------------- |
| super_admin   | Everything across all products              |
| sparx_admin   | sparx product only                          |
| billing_admin | Financial data only, all products           |
| support       | Read-only + impersonation (no billing data) |
| developer     | Logs, infrastructure metrics, API keys      |

Staff never share accounts. Every action is audit-logged with staff member ID, timestamp, and action taken.

---

## 3. Product Sections

### /sparx — sparx Operations

**Tenant Management**

- List all tenants (search by name, domain, email, plan)
- Tenant detail: modules active, MRR, storage used, last login
- Read-only **account view** (representation parity; the tenant's own data as they see it) — **replaces impersonation** (decision D7)
- Suspend/unsuspend tenant
- Manually activate/deactivate modules
- View tenant's full billing history
- Override storage limit (for support cases)
- Trigger full Typesense reindex for tenant
- View tenant's Pub/Sub event history

**Platform Metrics**

- Total tenants (total / active / churned / trial)
- MRR by module (which modules drive most revenue)
- Module adoption rates (% of tenants with each module)
- New tenant signups by day/week/month
- Churn rate and reasons (from exit survey)
- Average setup time (signup → first publish)
- Storage utilization across all tenants
- Email volume (Postal sends across all tenants)

**Domain Management**

- All custom domains across all tenants
- SSL certificate status (active / expiring / failed)
- CNAME verification status
- Force re-verify domain
- GoDaddy purchase history and renewals

**Billing Operations**

- Failed payment queue (auto-retried tenants)
- Manual refund tool
- Coupon creation and management
- Invoice generation for enterprise clients
- Stripe webhook log viewer

**Support Tools**

- Search any order across all tenants by order number
- Search any customer across all tenants by email
- View any tenant's Typesense index stats
- Trigger email re-send for any order confirmation
- View Postal delivery logs for any email

### /kanninja — kanNINJA Operations

- Board count and active users
- MRR
- Support escalations

### /helpninja — HelpNinja Operations

- Ticket volume
- Response time metrics
- MRR

### /billing — Cross-Product Financial

- Total WizeWorks MRR (all products combined)
- Revenue by product
- Revenue by plan tier (sparx)
- Churn and expansion revenue
- Upcoming renewals (next 30 days)
- Failed payments across all products

---

## 4. The Impersonation Tool — SUPERSEDED by the read-only account view (D7)

> **Reconciled 2026-07-22 (docs-vs-built audit):** Interactive impersonation was
> **deliberately not built.** Decision **D7** removed it as the highest-blast-radius
> path in the design: there is no `impersonation_grants` table, no `tenant:impersonate`
> capability, and no change to the tenant app. Instead, operators get a **read-only
> account view** — every tenant surface in `apps/admin` reuses the tenant's own
> formatters/labels/status derivations (or api-rest returns tenant-shaped payloads) so
> the operator reads the data exactly as the tenant sees it, without ever holding a
> tenant session. Cross-tenant reads **and** writes route through audited api-rest
> `/internal/operator/*` calls, and every view logs an action-level audit row. The
> original impersonation design is preserved below for historical context only.

Most important support feature. Staff can view any tenant's dashboard as if they were that tenant:

```
Tenant: Gillett Diesel Service
[Impersonate →]

→ Opens tenant dashboard in new tab
→ Banner at top: "⚠ Viewing as Gillett Diesel (support session)"
→ All actions taken are audit-logged to [staff name]
→ [Exit impersonation] button always visible
→ Session auto-expires after 60 minutes
```

Impersonation is read-only by default. Super admins can enable write access for specific sessions with additional confirmation.

---

## 5. Tech Stack

- **Framework:** Next.js 15 (separate app in monorepo: `apps/admin`)
- **Auth:** Better Auth, WizeWorks organization, staff only
- **Data:** Direct PostgreSQL queries (read replicas for analytics)
- **Deploy:** WizeWorks GKE cluster (not SparxWorks) — separate infra from product
- **Access:** VPN-only or IP allowlist — never publicly accessible

---

## 6. Implementation Checklist

> **Reconciled 2026-07-22 (docs-vs-built audit):** The sparx console is built in
> `apps/admin/app/(console)/sparx/*`. Impersonation was replaced by the read-only
> account view (D7). Cross-product (kanNINJA/HelpNinja) sections remain future scope.

- [x] apps/admin created in monorepo
- [x] Better Auth WizeWorks staff instance setup
- [x] Staff roles as **capability bundles** (not hardcoded role checks) — see build-plan D5
- [x] Tenant list + search
- [x] Tenant detail page
- [x] ~~Impersonation flow~~ → **read-only account view** with action-level audit logging (D7)
- [x] Suspend/unsuspend tenant
- [x] Platform metrics dashboard
- [x] Module adoption rates
- [x] Domain management view
- [x] Billing operations (failed payments, refunds, coupons)
- [ ] Cross-product financial dashboard (kanNINJA / HelpNinja — future)
- [ ] VPN/IP allowlist configuration in GKE ingress
- [x] Audit log viewer (every staff action)
- [ ] Alert: tenant storage > 90% of limit
- [ ] Alert: tenant failed payment > 7 days
