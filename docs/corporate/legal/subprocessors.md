# Subprocessors

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-07-28
Applies to: WizeWorks LLC and the sparx platform

> Adopted 2026-07-28. Not reviewed by counsel — see [README](README.md).
>
> **This list already had to exist.** The customer DPA
> ([apps/web/app/legal/dpa/page.tsx](../../../apps/web/app/legal/dpa/page.tsx) §6) states: "We
> maintain a current subprocessor list and will give notice of material changes so you can object
> on reasonable grounds."
>
> **v1.1 (same day):** the legal-page audit walked the actual integration surface rather than
> recalling it, and found **two subprocessors missing from v1.0** — Twilio and GoDaddy. Both are
> platform-credential integrations (`TWILIO_ACCOUNT_SID`, `GODADDY_API_KEY_PROD` are read from our
> own environment), which is exactly the test for "ours". Recorded here because it is the failure
> mode this document exists to prevent, and it happened on day one: a list written from memory
> misses vendors that a `process.env` grep does not.
>
> The list is now **published** at [/legal/subprocessors](../../../apps/web/app/legal/subprocessors/page.tsx),
> so the DPA promise is kept in both halves. This file and that page must be changed together.

## What a subprocessor is here

A third party that **processes customer personal data on our behalf** in order to deliver sparx.
Vendors that never touch customer data — an IDE, a CI runner, an accounting package — are not
subprocessors and are deliberately not listed.

The test for whether a vendor belongs here is **whose credential the call uses**. If sparx
authenticates with a key from our own environment or Secret Manager, the vendor is ours and goes in
the table. If the call carries a key the tenant pasted in, it belongs in "deliberately not on this
list" — the tenant elected it, on their own account, under terms they agreed.

Derived from what the code actually integrates with, as of 2026-07-28.

| Subprocessor              | What it does for us                                                                                                                                                  | Customer personal data it handles                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Google Cloud Platform** | All hosting and storage: GKE compute, Cloud SQL (Postgres), Cloud Storage (media), Pub/Sub, Secret Manager, Cloud Run.                                               | Everything. Every tenant record and every uploaded file lives here. This is the primary subprocessor.          |
| **Cloudflare**            | DNS, CDN and TLS termination in front of the sites and the media origin.                                                                                             | Traffic metadata and cached public assets in transit.                                                          |
| **Mailgun**               | Delivery of outbound email on `sparx.email` — transactional and tenant marketing sends.                                                                              | Recipient email addresses and message content.                                                                 |
| **Twilio**                | Outbound SMS — booking confirmations and reminders. `TWILIO_ACCOUNT_SID` is a platform credential; with none set the provider registry falls back to a console stub. | Recipient phone numbers and message content.                                                                   |
| **Stripe**                | Payment processing, subscription billing, and marketplace/partner payouts.                                                                                           | Payer name, billing contact, payment metadata. Card numbers go to Stripe directly and never reach our systems. |
| **GoDaddy**               | Domain registration, transfer and DNS when a tenant buys a domain through sparx (`packages/godaddy`, `domain-worker`).                                               | Registrant contact details — name, postal address, email, phone — as ICANN requires be recorded.               |
| **PostHog**               | Product analytics in the marketing site and the workbench.                                                                                                           | Staff-user usage events and identifiers. Not shopper data; consent-gated, never loaded on a tenant site.       |

## Deliberately not on this list

- **Typesense** — the search index is **self-hosted** on our own GKE cluster
  ([k8s/typesense/statefulset.yaml](../../../k8s/typesense/statefulset.yaml)), not a vendor
  service. The data stays inside GCP and is covered by that entry.
- **Better Auth** — self-hosted software, not a service. No data leaves our infrastructure.
- **AI providers** — sparx runs no AI on a platform credential
  ([services/api-rest/src/lib/ai/llm-router.ts](../../../services/api-rest/src/lib/ai/llm-router.ts)
  builds a router per-request from the tenant's own decrypted key). Every AI feature is either the
  tenant's own provider key or an MCP client the tenant brings. Where a tenant configures their
  own key, that provider is **the tenant's** subprocessor, not ours.
- **Shipping, tax and non-Stripe payment gateways** — EasyPost, Shippo, Avalara, TaxJar, PayPal and
  the rest are configured per-tenant through the integration framework, which captures an
  `apiKeyRef` the tenant supplies and encrypts it. We hold no account with any of them, so they
  fail the whose-credential test above. Note this is a judgment call and not a comfortable one:
  the data still flows through our infrastructure, and a cautious counsel may want them disclosed
  anyway. The published page resolves it by naming the category and telling tenants to account for
  these in **their own** privacy notice, which is the honest middle.
- **Meta, Google Business Profile, LinkedIn, Pinterest, TikTok, YouTube and similar** — when a
  tenant connects their own social or commerce account, we are sending their content to a platform
  **at their instruction and on their existing relationship with it**. Those platforms are not
  processing data on our behalf. Conversely, platform data those APIs return to us is subject to
  their terms as well as this policy.

## Keeping it current

Adding a vendor that touches customer personal data is a change to this list and, under the DPA, a
change customers may object to. Update this file **in the same change that introduces the vendor** —
a subprocessor list that is discovered to be stale is worse than one that never claimed to be
current, because the DPA promises it is maintained.
