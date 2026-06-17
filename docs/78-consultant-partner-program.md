# sparx Platform — Consultant & Partner Program Spec

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-17

---

## 1. Overview

The sparx Consultant role allows non-WizeWorks individuals — web designers, digital agencies, ecommerce consultants, marketing firms — to access and manage multiple tenant accounts from a single login. A consultant is not a WizeWorks employee and not the tenant. They are a trusted third party granted access by the tenant.

This is distinct from:

- **Staff members** — employed by the tenant, access to one tenant
- **WizeWorks support staff** — internal, access via admin.wize.works
- **Tenant owners** — the account holder and billing owner

---

## 2. How It Works

A consultant is a sparx user who belongs to multiple tenant organizations simultaneously, with different roles in each. The tenant invites them. The tenant controls their permissions. The tenant can revoke access at any time.

### Consultant Login Experience

```
Consultant logs into app.sparx.works
  → Instead of a single dashboard, sees:

  Your client accounts

  ● Gillett Diesel Service      Admin      [Enter →]
  ● Acme Parts Co               Editor     [Enter →]
  ● Pacific Forge Logistics     Builder    [Enter →]
  ● [+ Accept pending invite]

  → Clicks into any account
  → Operates entirely within that tenant's context
  → Has only the permissions that tenant granted
  → Top bar shows: "Gillett Diesel  ▾" (tenant switcher)
```

### Tenant Inviting a Consultant

```
Dashboard → Settings → Team → [Invite member]
  Email: consultant@example.com
  Role:  Admin / Editor / Builder / Support / Viewer

  → Consultant receives email invitation
  → Accepts → immediately appears in their client accounts list
  → Tenant can change role or revoke at any time
```

---

## 3. Consultant Permission Roles

The same roles available to staff members are assignable to consultants. Tenants choose the right level of access per consultant.

| Role          | What they can do                                                                         |
| ------------- | ---------------------------------------------------------------------------------------- |
| **Admin**     | Everything except billing and owner settings. Full operational control.                  |
| **Editor**    | Products, content, orders, customers. No team management.                                |
| **Builder**   | Site builder only. Theme, pages, sections. No commerce or CRM access.                    |
| **Marketing** | Email module, CMS, analytics. No orders or customer PII.                                 |
| **Support**   | Orders and customers only. Can process refunds if enabled. Read-only on everything else. |
| **Viewer**    | Read-only across all sections the tenant has active.                                     |

**Owner** is never assignable — only the tenant who created the account holds owner status. Billing, account deletion, and ownership transfer are owner-only actions.

---

## 4. Consultant Plan Pricing

```
Free:           Manage up to 3 client accounts
                Standard multi-tenant dashboard
                No additional cost beyond normal sparx login

Consultant:     $49/mo
                Unlimited client accounts
                Client reporting dashboard
                White-label reports (consultant's logo)
                Priority support channel (direct Slack)
                Early feature access
                Listed in sparx Partner Directory (optional)
```

The free tier exists to let consultants get started without commitment. The $49/mo upgrade is triggered naturally when they hit their 4th client — the dashboard prompts them at that point.

---

## 5. Data Model

```sql
-- Consultants are regular Better Auth users
-- Multi-tenancy is handled via organization memberships
-- A consultant user has memberships in multiple tenant organizations

-- Existing table (Better Auth organizations)
-- Each tenant = one organization
-- Consultant = user with memberships in multiple organizations

-- No schema changes required for the core model
-- Only additions needed:

ALTER TABLE organization_members
  ADD COLUMN member_type VARCHAR(20) DEFAULT 'staff';
  -- 'staff' | 'consultant' | 'owner'
  -- Allows filtering consultant vs internal staff in team views

CREATE TABLE consultant_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  display_name    VARCHAR(255),
  company         VARCHAR(255),
  website         VARCHAR(255),
  bio             TEXT,
  specialties     TEXT[],
  -- ['ecommerce', 'b2b', 'dropship', 'seo', 'email', 'design']
  location        VARCHAR(255),
  plan            VARCHAR(20) DEFAULT 'free',
  -- 'free' | 'consultant'
  plan_started_at TIMESTAMPTZ,
  stripe_subscription_id VARCHAR(255),
  directory_listed BOOLEAN DEFAULT false,
  -- opt-in to appear in public partner directory
  certified        BOOLEAN DEFAULT false,
  -- future: passed certification assessment
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. Multi-Tenant Dashboard Shell

When a consultant logs in, the dashboard shell adapts:

```typescript
// apps/dashboard/app/(dashboard)/layout.tsx

const session = await getSession()
const organizations = await getUserOrganizations(session.userId)

if (organizations.length > 1) {
  // Consultant or multi-org user — show tenant picker
  return <ConsultantShell organizations={organizations} />
} else {
  // Standard tenant — single tenant dashboard
  return <TenantShell organization={organizations[0]} />
}
```

The consultant shell adds:

- Tenant switcher in the top navigation bar
- "Client accounts" overview page (default landing)
- Quick stats per client (last order, active modules, issues)
- Pending invitations

---

## 7. Client Reporting Dashboard (Consultant Plan)

Consultants on the paid plan can generate white-labeled reports for their clients:

```
Client Report — Gillett Diesel Service
Generated by: [Consultant's logo]

Period: May 2026

Commerce
  Revenue:     $48,200   ↑ 18.4% vs April
  Orders:      312       ↑ 22 new
  AOV:         $154.49

Email
  Campaigns sent:   4
  Avg open rate:    42.1%
  Revenue from email: $8,200

CRM
  New customers:    34
  Pipeline value:   $92,000
  Deals closed:     12

[Download PDF]   [Email to client]
```

Reports are generated on-demand. The consultant's branding (logo, colors) replaces sparx branding on the report. The tenant never sees who generated it unless the consultant chooses to include their contact info.

---

## 8. Partner Directory (Optional Opt-In)

Consultants on the paid plan can opt into the public partner directory at `sparx.works/partners`:

```
sparx.works/partners

Find a sparx consultant

Specialty: [All ▾]   Location: [All ▾]   [Search]

┌─────────────────────────────────────────────────────┐
│ Apex Digital Agency                                  │
│ Fresno, CA · ecommerce, B2B, email                  │
│ ★★★★★ 12 sparx tenants                             │
│ [View profile]  [Contact]                            │
├─────────────────────────────────────────────────────┤
│ Maria Chen Consulting                                │
│ Remote · design, site builder, CMS                  │
│ ★★★★½ 8 sparx tenants                              │
│ [View profile]  [Contact]                            │
└─────────────────────────────────────────────────────┘
```

Directory listing is opt-in only. Listed consultants must be on the Consultant plan. Tenants can leave reviews for consultants who have worked on their account.

---

## 9. Audit Logging for Consultant Actions

Every consultant action is logged with their identity, not hidden behind the tenant's account:

```sql
-- Existing audit_log table gains consultant context
INSERT INTO audit_log (
  tenant_id,
  actor_id,         -- consultant's user ID
  actor_type,       -- 'consultant' (vs 'tenant' | 'staff' | 'system')
  actor_name,       -- "Maria Chen Consulting"
  action,           -- 'product.updated'
  resource_id,      -- product ID
  diff,             -- what changed
  ip_address,
  created_at
);
```

Tenant can view a complete log of all consultant actions in Settings → Team → Activity log. This is essential for trust — the tenant always knows exactly what a consultant did and when.

---

## 10. Revenue Share (Future — Month 6+)

Optional program for certified consultants who actively refer and onboard tenants:

```
Referral commission:
  20% of referred tenant's plan for first 3 months
  Paid monthly via ACH or Stripe payout
  Tracked via unique referral link: sparx.works/signup?ref=[code]

Managed account bonus (future):
  Certified consultants managing 10+ tenants on Business plan
  get additional 5% recurring commission
  Requires formal certification completion
```

Revenue share is a future addition — not required for the initial consultant role launch.

---

## 11. Certification Program (Future — Month 6+)

A self-paced online certification covering:

- sparx platform fundamentals
- Site builder and theme system
- Commerce module setup and optimization
- B2B/wholesale configuration
- CRM pipeline management
- Email automation best practices
- Migration from Shopify/HubSpot
- Assessment (80% pass rate required)

Certified consultants:

- Get a "sparx Certified" badge on their directory listing
- Are prioritized in search results on the partner directory
- Get access to dedicated partner Slack channel
- Early access to beta features

---

## 12. Implementation Sequence

### Phase 1 — Core consultant role (ship with dashboard)

- [ ] `member_type` column on organization_members
- [ ] `consultant_profiles` table
- [ ] Multi-tenant dashboard shell (tenant picker on login)
- [ ] "Client accounts" overview page
- [ ] Consultant shown distinctly in tenant's team list
- [ ] Audit log: consultant actions attributed by name
- [ ] Free tier: up to 3 client accounts enforced

### Phase 2 — Consultant plan (Month 3–4)

- [ ] Consultant plan ($49/mo) — Stripe subscription
- [ ] Upgrade prompt at 4th client account
- [ ] Unlimited client accounts for paid tier
- [ ] White-label client reporting PDF
- [ ] Priority support channel

### Phase 3 — Partner directory (Month 6+)

- [ ] Partner directory at sparx.works/partners
- [ ] Consultant profile page (opt-in)
- [ ] Tenant reviews of consultants
- [ ] Specialty and location filtering

### Phase 4 — Certification + revenue share (Year 2)

- [ ] Certification course and assessment
- [ ] Referral tracking and commission payouts
- [ ] Managed account recurring commission
      EOF
