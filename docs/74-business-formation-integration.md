# sparx Platform — Business Formation Integration Spec

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-05-31

---

## 1. Overview

sparx integrates with business formation APIs to allow merchants to form an LLC or corporation during onboarding — without leaving the platform. The formation service handles state filing, EIN acquisition, registered agent, and ongoing compliance. sparx provides the UX, collects payment, and surfaces formation status in the merchant dashboard.

**Primary integration:** FileForms (API-first, no volume minimum, white-label, all 50 states)  
**Secondary:** doola MCP (agentic onboarding flow, not white-label)  
**Build timeline:** Month 4+

---

## 2. Why It Belongs in sparx

A merchant launching a store on sparx may not yet have a legal business entity. Formation during onboarding:

- Removes a barrier to launching ("I need to set up my LLC first")
- Captures the EIN which pre-fills Stripe Connect onboarding
- Creates a natural upsell: Form LLC → connect payments → go live
- Differentiates sparx from every other commerce platform

The compliance overhead is zero for sparx — the formation service handles all state filings, registered agent, and compliance. sparx provides the UI and earns a margin.

---

## 3. Integration Decision — FileForms Primary

**FileForms** is the primary integration:

- REST API, Bearer auth — trivial to wrap in a typed Fastify service
- No volume minimum — works from day one, zero commitment
- Full white-label — merchant never sees FileForms
- All 50 states: LLC, C-Corp, S-Corp
- Full lifecycle: formation + EIN + registered agent + annual reports + foreign qualification
- Status webhooks (Pending → Filed → Completed)
- SOC 2 Type I certified

**doola MCP** as optional secondary:

- doola has a live MCP server at mcp.doola.com
- Works with Claude, ChatGPT, Replit, Lovable
- Conversational LLC formation without leaving Claude
- NOT white-label (ends on doola-branded checkout)
- White-label requires $25K/mo minimum — hard blocker for early stage
- Treat as a marketing/funnel feature, not core infrastructure

**Pre-build diligence required:**
Before building, request from FileForms:

- Full endpoint reference
- Webhook payload + signature spec
- Rate limits and SLA
- Sandbox/test credentials
- Confirmed wholesale per-filing rate

Go/no-go threshold: if test credential + sandbox formation + webhook round-trip can't be completed within 3 weeks of inquiry, fall back to MyCompanyWorks EntityMachine (has a real sandbox + webhooks).

---

## 4. Onboarding Flow Integration

Formation appears as an optional step in onboarding, before payments:

```
Onboarding Step 1: Business info
  Business name entered

  "Do you have a legal business entity?"
  [Yes, I'm incorporated]  [No, help me form one]

  → "No, help me form one":

  What type of business?
  [LLC]  [S-Corp]  [C-Corp]  [Not sure — recommend for me]

  Which state?
  [dropdown — defaults to merchant's state from IP]

  Business owner name, address, email, phone

  [Optional: WHOIS privacy +$7.99/yr]

  Total: $[wholesale + sparx markup]
  [Form my LLC — $[price]]

  → Stripe charge
  → FileForms API call
  → Formation status shown in dashboard
  → EIN received → pre-fills Stripe Connect
```

---

## 5. FormationProvider Interface

All formation logic behind a provider interface — FileForms can be swapped for EntityMachine or CorpNet without changing the rest of the codebase:

```typescript
// packages/formation/src/types.ts
interface FormationProvider {
  createFormation(params: FormationParams): Promise<Formation>;
  getStatus(formationId: string): Promise<FormationStatus>;
  orderEIN(formationId: string): Promise<EINOrder>;
  orderRegisteredAgent(formationId: string, state: string): Promise<RAOrder>;
  fileAnnualReport(entityId: string, year: number): Promise<FilingOrder>;
  getDocuments(formationId: string): Promise<Document[]>;
}

interface FormationParams {
  tenantId: string;
  entityType: 'LLC' | 'S_CORP' | 'C_CORP';
  state: string; // 2-letter state code
  entityName: string;
  members: Member[];
  registrant: ContactInfo;
  whoisPrivacy: boolean;
  addOns: ('EIN' | 'registered_agent' | 'operating_agreement')[];
}
```

---

## 6. FileForms API Integration

```typescript
// packages/formation/src/providers/fileforms.ts

const FILEFORMS_BASE = 'https://api.fileforms.com';

export class FileFormsProvider implements FormationProvider {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: FILEFORMS_BASE,
      headers: {
        Authorization: `Bearer ${process.env.FILEFORMS_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async createFormation(params: FormationParams): Promise<Formation> {
    const response = await this.client.post('/formations', {
      entity_type: params.entityType,
      state: params.state,
      entity_name: params.entityName,
      registered_agent: true,
      white_label: true, // never shows FileForms branding
    });
    return this.mapToFormation(response.data);
  }

  async getStatus(formationId: string): Promise<FormationStatus> {
    const response = await this.client.get(`/formations/${formationId}`);
    return response.data.status; // 'Pending' | 'Filed' | 'Completed'
  }
}
```

---

## 7. Webhook Handling

FileForms sends status updates via webhook:

```typescript
// src/routes/webhooks/fileforms.ts
fastify.post('/webhooks/fileforms', async (req) => {
  // Verify signature (spec to be confirmed with FileForms)
  verifyFileFormsSignature(req);

  const { formation_id, status, documents } = req.body;

  // Update formation record
  await db.businessFormation.update({
    where: { externalId: formation_id },
    data: {
      status,
      documents: documents ?? [],
      completedAt: status === 'Completed' ? new Date() : null,
    },
  });

  // If completed, check if EIN is included and pre-fill Stripe
  if (status === 'Completed') {
    await pubsub.publish('formation.completed', {
      tenantId: formation.tenantId,
      formationId: formation_id,
    });
  }
});
```

Pub/Sub consumer for formation.completed:

- Notifies merchant via email ("Your LLC is formed!")
- If EIN available, pre-fills Stripe Connect business info
- Updates onboarding checklist status

---

## 8. Database Schema

```sql
CREATE TABLE business_formations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  provider            VARCHAR(50) NOT NULL DEFAULT 'fileforms',
  external_id         VARCHAR(255),        -- FileForms formation ID
  entity_type         VARCHAR(20) NOT NULL, -- LLC | S_CORP | C_CORP
  entity_name         VARCHAR(255) NOT NULL,
  state               CHAR(2) NOT NULL,
  status              VARCHAR(30) DEFAULT 'pending',
  -- pending | filed | completed | failed
  stripe_charge_id    VARCHAR(255),
  amount_cents        INTEGER NOT NULL,
  ein                 VARCHAR(20),          -- populated when received
  registered_agent    BOOLEAN DEFAULT true,
  whois_privacy       BOOLEAN DEFAULT false,
  documents           JSONB DEFAULT '[]',   -- filed documents + URLs
  filed_at            TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 9. Dashboard — Formation Status

Merchant dashboard shows formation status in their onboarding checklist and in Settings → Business:

```
Business Entity
  ✅ Acme Parts LLC
     Wyoming · Filed 2026-05-28
     EIN: 87-XXXXXXX
     Registered Agent: FileForms (via sparx)

     Annual Report Due: Jan 1, 2027
     [Set up auto-renewal →]

     Documents:
     - Articles of Organization [Download]
     - Operating Agreement [Download]
     - EIN Confirmation Letter [Download]
```

---

## 10. Revenue Model

```
FileForms wholesale rate: ~$75–$100/filing
sparx merchant price:     $249 (LLC) / $349 (C-Corp)
sparx gross margin:       ~$150–$250 per formation

Recurring:
  Registered agent renewal: $149/yr retail → ~$80/yr wholesale → ~$70/yr margin
  Annual report filing: $149/state retail → ~$60/state wholesale → ~$90/state margin
```

Annual reports and registered agent renewals are auto-charged with merchant consent. Dashboard shows upcoming renewal dates 60 days in advance.

---

## 11. MCP Tool — Conversational Formation

When AI/MCP module is active, expose formation as an MCP tool:

```
Tool: sparx.business.form_entity

User: "I need to form an LLC for my business"

Claude: "I can help with that. A few questions:
  1. What state would you like to form in? (Wyoming and Delaware
     are popular for flexibility)
  2. What's the legal name for your LLC?
  3. Will you be the sole member, or are there other owners?

Once I have those, I'll walk you through the filing.
It typically takes 5–7 business days and runs $249 through sparx."

[After merchant confirms]
→ sparx.business.form_entity({ state, name, members, ... })
→ Stripe charge
→ FileForms API call
→ "Your LLC filing is submitted. You'll receive your
   Articles of Organization within 5–7 business days."
```

---

## 12. Implementation Checklist

- [ ] Request FileForms API docs + sandbox credentials
- [ ] Complete test: sandbox formation + webhook round-trip
- [ ] Go/no-go decision (3 week deadline from inquiry)
- [ ] FormationProvider interface + FileFormsProvider implementation
- [ ] DB schema + migrations
- [ ] Onboarding Step 1 UI — "Do you have an LLC?" branch
- [ ] Formation flow UI — entity type, state, owner info, payment
- [ ] Stripe charge for formation
- [ ] FileForms webhook endpoint + signature verification
- [ ] Pub/Sub consumer — formation.completed
- [ ] Email notification — "Your LLC is formed"
- [ ] EIN → Stripe Connect pre-fill
- [ ] Dashboard Settings → Business — formation status + documents
- [ ] Annual report renewal reminders (60/30/7 days before due)
- [ ] Auto-renewal with merchant consent
- [ ] MCP tool: sparx.business.form_entity
- [ ] Fallback: EntityMachine provider implementation (if FileForms fails diligence)
      EOF
