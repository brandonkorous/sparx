# WizeWorks — corporate legal & compliance

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-07-28

> **What this directory is.** WizeWorks' own internal policies as a company — how we behave when
> someone outside asks us for data, who we hand data to in order to run the service, and what we
> promise about handling it. It is deliberately separate from the rest of [docs/](../../), which
> describes the sparx product, and from the tenant-facing legal documents at
> [sparx/apps/web/app/legal/](../../../apps/web/app/legal/), which are contracts with customers.
>
> **These are adopted policies, not aspirations.** Everything written here is something we commit
> to doing. If a policy stops matching reality, change the policy or change the practice — do not
> let the two drift, because the whole value of this directory is being able to answer "yes, and
> here it is" truthfully.
>
> **This is not legal advice and was not written by a lawyer.** It is a baseline for a small
> company that had nothing written down, which is materially better than nothing and materially
> worse than counsel-reviewed policy. Anything that ends up in a regulatory filing, a customer
> contract, or a platform attestation should be reviewed by an attorney first.

## Why this exists

Written 2026-07-28. Meta's App Review asks, as part of its Tech Provider data-handling
questionnaire, which policies a company has for handling requests from public authorities for
users' personal data. The honest answer was "none of them" — not because we would behave badly,
but because nothing had been written down. These policies are what we would actually do, recorded
so the answer is "yes" and so there is something to fall back on when it is asked again.

Expect it to be asked again. Meta is the first, not the last: platform reviews, enterprise
security questionnaires, insurance applications and any future SOC 2 work ask overlapping
versions of the same questions.

## Contents

| Document                                                   | Covers                                                                                                                                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [government-data-requests.md](government-data-requests.md) | What we do when a court, regulator or law-enforcement agency demands customer data. Legality review, challenging unlawful demands, data minimization, and the request log.                               |
| [subprocessors.md](subprocessors.md)                       | The third parties that process customer data on our behalf, and the whose-credential test for deciding. Mirrored publicly at [/legal/subprocessors](../../../apps/web/app/legal/subprocessors/page.tsx). |

## Open items

Recorded so they are not forgotten rather than quietly assumed:

- **No attorney has reviewed this directory, or the customer-facing legal pages.** Highest-value
  next step, and cheap at this stage. It matters more now than it did at v1.0: the 2026-07-28 audit
  put real obligations in front of customers (SMS consent rules, a public-authority commitment,
  domain-registration terms), and those are the paragraphs most worth an hour of counsel.
- **The request log does not exist yet** — [government-data-requests.md](government-data-requests.md)
  §6 specifies it, but no entries and no file have been created, because no request has arrived.
  Create it on the first request, not before.
- **No subprocessor-change notification route exists.** Both the DPA and the published page now
  promise account owners are notified _before_ a new subprocessor takes effect. Nothing sends that
  notice today — it would be a manual send. Wire it, or keep it manual deliberately and remember it
  on the next vendor.

### Closed by the 2026-07-28 legal-page audit

- ~~The DPA has no public-authority section.~~ Added as DPA §9, mirroring
  [government-data-requests.md](government-data-requests.md) §3–6, and summarized on the security
  page. The internal policy and the customer-facing commitment now say the same thing.
- ~~The public subprocessor list is not published.~~ Published at
  [/legal/subprocessors](../../../apps/web/app/legal/subprocessors/page.tsx) and linked from the
  footer, the DPA, the privacy policy and the security page. **Change it and
  [subprocessors.md](subprocessors.md) in the same commit** — a public list that drifts is worse
  than none.
- ~~Confirm the SOC 2 claim.~~ Resolved by removing it. The security page had asserted "sparx is
  undergoing a SOC 2 Type II examination"; nothing evidenced an engagement, so the page now says
  plainly that we build to the controls but hold no report, and states what we will publish when
  that changes (auditor, period, report under NDA). The footer link lost its "& SOC 2" suffix for
  the same reason. **If an auditor has in fact been engaged, this is the sentence to correct** —
  understating is safe, but it is still not accurate.
