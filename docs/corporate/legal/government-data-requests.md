# Policy — requests from public authorities for personal data

Version: 1.0
Author: Brandon Korous
Last Updated: 2026-07-28
Applies to: WizeWorks LLC and the sparx platform
Owner: Brandon Korous (as the sole officer, this is the same person as the reviewer — see §7)

> Adopted 2026-07-28. Not reviewed by counsel — see [README](README.md).

## 1. Scope

This policy governs what WizeWorks does when a **public authority** — a court, a law-enforcement
agency, a regulator, a tax authority, or any government body, domestic or foreign — asks us to
hand over personal data we hold.

It covers personal data belonging to:

- **Our tenants** — the businesses that pay for sparx, and their staff users.
- **Their customers** — the shoppers, contacts and subscribers whose records live in a tenant's
  account. We are a **processor** for this data; the tenant is the controller.
- **Platform data received from third-party APIs** — for example data obtained from Meta under
  granted permissions, which carries its own contractual restrictions.

It does not cover ordinary civil discovery in litigation WizeWorks is party to, or data-subject
access requests from individuals, which follow the privacy policy.

## 2. The rule

**We do not hand over personal data because someone with a badge or a letterhead asked.** Every
request is reviewed for legal validity first, disclosure is limited to what the instrument
actually compels, and the whole exchange is written down.

Nothing in this policy requires us to obstruct a lawful order. It requires us to establish that
an order is lawful before we treat it as one.

## 3. Review of legality — required, before anything is disclosed

Every request is reviewed before any data leaves our systems. No exceptions for urgency;
"emergency" requests get the emergency path in §5, which is still a review.

The reviewer confirms, in this order:

1. **It is a real legal instrument.** A subpoena, warrant, court order, or statutory demand —
   identified by issuing body, case or reference number, and signature. An email from an
   investigator asking us to "just pull the records" is not a legal instrument and is refused in
   writing.
2. **It reaches us.** The instrument is directed at WizeWorks LLC, in a jurisdiction that has
   authority over us. A demand addressed to a tenant is the tenant's to answer, not ours.
3. **It actually compels what it appears to.** A subpoena for business records does not compel
   message content; a warrant for one account does not reach the whole database. What the
   instrument compels is decided by reading it, not by what the requester says over the phone.
4. **We hold the data at all.** Much of what is asked for may not exist, may sit in a tenant's own
   connected third-party account, or may have been deleted under retention rules.
5. **Disclosure is not independently prohibited.** Platform data from third-party APIs, and data
   subject to a customer DPA or foreign transfer restrictions, may carry conflicting obligations
   that have to be reconciled before responding.

**If any of the five is unclear, we obtain outside legal advice before responding.** The cost of
an hour of counsel is not a reason to skip this step.

## 4. Challenging unlawful or overbroad requests

Where review concludes a request is unlawful, defective, or broader than the law allows, **we
object rather than comply**. In practice that means one or more of:

- Writing to the issuing body identifying the defect and declining until it is cured.
- Negotiating scope down to what is actually relevant — the usual and most productive outcome for
  an overbroad request.
- Moving to quash or modify, with counsel, where the issuing body will not narrow it.
- Refusing outright where the request has no legal basis at all.

**We tell the affected tenant that a request has arrived and give them the opportunity to object
themselves**, unless we are legally barred from doing so by a non-disclosure order or statute.
Where a gag is time-limited, we notify when it lapses. For data where a tenant is the controller
and we are the processor, this is not a courtesy — it is their decision to contest, not ours.

## 5. Data minimization — disclose the minimum the instrument compels

We disclose **the narrowest set of records that satisfies the instrument, and nothing else.**

- Scoped to the named accounts, identifiers and date range in the request. Never "the account and
  everything attached to it" because that is easier to export.
- Records are produced individually rather than by handing over a database export, a full account
  dump, or credentials.
- Fields outside the request are removed before production. Where a record cannot be separated
  cleanly, the surrounding data is redacted.
- **Other tenants' data is never included.** sparx is multi-tenant and isolated at the database
  level by row-level security; a production must not defeat that isolation.
- Where an aggregate or a confirmation answers the question, we offer it instead of raw records.

Emergency requests (an imminent threat to life) may be answered before full review where the law
permits, but still under minimization — the minimum needed to address the emergency, followed by
the full review and log entry after the fact.

## 6. Documentation — every request is logged

Every request is recorded, **including the ones we refuse**, in a request log held with the
company's legal records and retained for at least seven years.

Each entry records:

| Field                     | Detail                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| Date received, and how    | Post, email, in person; who took receipt.                                       |
| Requesting authority      | Body, jurisdiction, named officer, case/reference number.                       |
| Instrument                | Type (subpoena, warrant, order) and a copy of the document itself.              |
| Data sought               | As written in the instrument.                                                   |
| Affected tenants/subjects | Who the data belongs to.                                                        |
| Legality review           | Who reviewed, when, the conclusion, and the reasoning — including counsel used. |
| Tenant notification       | Whether the tenant was told, when; or the legal basis for not telling them.     |
| Outcome                   | What was disclosed, narrowed, or refused — and the exact records produced.      |
| Objection                 | Any challenge made, and its result.                                             |

The log is the point of the whole policy. It is what makes it possible to answer, years later,
what was handed over and why — to a regulator, a customer, an auditor, or a court.

## 7. Who does this

WizeWorks is currently a single-officer company. Brandon Korous receives, reviews and decides on
requests, and engages outside counsel where §3 requires it.

**This concentration is a known weakness, recorded rather than papered over:** there is no second
reviewer, and no separation between the person deciding and the person producing the data. The
mitigations are that outside counsel is engaged whenever legality is unclear, and that the log
makes every decision reviewable after the fact. When WizeWorks has a second officer or employee,
review and production should be split between two people.

## 8. Mapping to Meta's App Review questionnaire

Meta's data-handling section asks which policies are in place regarding requests from public
authorities. With this policy adopted, the accurate answers are:

| Meta's option                                                             | Answer | Where                                            |
| ------------------------------------------------------------------------- | ------ | ------------------------------------------------ |
| Required review of the legality of these requests                         | Yes    | §3 — mandatory pre-disclosure review, five tests |
| Provisions for challenging these requests if considered unlawful          | Yes    | §4 — object, narrow, move to quash, or refuse    |
| Data minimization — ability to disclose the minimum information necessary | Yes    | §5 — scoped production, redaction, no dumps      |
| Documentation of requests, responses, legal reasoning and actors involved | Yes    | §6 — the request log and its required fields     |

Answer truthfully against this document, and only for as long as it is genuinely being followed.
If the policy lapses in practice, the answer goes back to "none of the above" — a false
attestation to a platform is a far worse problem than an incomplete compliance program.
