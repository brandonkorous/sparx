# sparx Platform — WizeWorks Admin Portal Spec

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-05-31

---

## 1. Overview

`admin.wize.works` is the unified WizeWorks operations portal. It provides internal staff with oversight, management, and support tooling across all WizeWorks products — sparx, kanNINJA, HelpNinja, and future products.

**Domain:** admin.wize.works  
**Auth:** Better Auth, WizeWorks staff only. Completely separate from sparx merchant auth.  
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
- Impersonate merchant (staff sees their dashboard, audit-logged)
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
- View any merchant's Typesense index stats
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

## 4. The Impersonation Tool

Most important support feature. Staff can view any merchant's dashboard as if they were that merchant:

```
Tenant: Gillett Diesel Service
[Impersonate →]

→ Opens merchant dashboard in new tab
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

- [ ] apps/admin created in monorepo
- [ ] Better Auth WizeWorks organization setup
- [ ] Staff role definitions (super_admin, sparx_admin, billing_admin, support, developer)
- [ ] Tenant list + search
- [ ] Tenant detail page
- [ ] Impersonation flow with audit logging
- [ ] Suspend/unsuspend tenant
- [ ] Platform metrics dashboard
- [ ] Module adoption rates
- [ ] Domain management view
- [ ] Billing operations (failed payments, refunds, coupons)
- [ ] Cross-product financial dashboard
- [ ] VPN/IP allowlist configuration in GKE ingress
- [ ] Audit log viewer (every staff action)
- [ ] Alert: tenant storage > 90% of limit
- [ ] Alert: tenant failed payment > 7 days
      EOF
