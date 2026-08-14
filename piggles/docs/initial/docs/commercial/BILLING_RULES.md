# Billing Rules

## Base subscription

- SKU: `piggles_base_monthly`
- target: $49/month
- all normal Piggles apps included

## Trial

Recommended initial posture: 14 days, no card required unless unit economics dictate otherwise.

## Capacity warnings

Warn at 80%, 95%, and 100%.

At threshold:

- explain exactly what capacity is constrained;
- provide a grace path where safe;
- offer one clear expansion action.

## Overage posture

**Nothing a business already has ever degrades, and no limit ever stops work in
progress.** Piggles is the software someone runs their business on; a capacity cap that
takes their site offline, hides their contacts, or blocks a save is an outage they did
not cause and cannot explain to their own customers.

Three states, not two:

| State           | Behaviour                                                                      |
| --------------- | ------------------------------------------------------------------------------ |
| Approaching 80% | Quiet, non-blocking notice. Expansion available, never demanded.               |
| At 100%         | **The action in flight still completes.** The inline expansion prompt appears. |
| Past grace      | New additions of that one kind pause. Everything existing keeps working.       |

"Past grace" is never retroactive. Exceeding storage does not unpublish a site.
Exceeding contacts does not hide contacts. Exceeding email does not drop queued
transactional mail — order confirmations and password resets are never capacity-gated,
because they are the customer's customers' experience, not the customer's marketing.

Meters behave differently by type and should not be treated uniformly:

- **Stocks** (storage, contacts) — existing content is untouchable; only new additions
  pause.
- **Flows** (email sends) — the only meter with real marginal cost, and the only one
  with abuse exposure. See the ceiling below.
- **Discrete units** (seats, sites, locations) — expansion is explicit and obvious by
  nature; instant and prorated.

## Expansion must feel like it just happens

One tap, in place, at the moment of friction. Not a trip to Settings, not a trip to
another domain, not a quote.

Requirements:

- The price is **on the button** — "Add 10 GB — $5/mo", never "Upgrade".
- Card already on file from signup, so the tap is the whole transaction.
- Takes effect immediately; the blocked action then completes on its own.
- **Reversible without talking to anyone** — removing a block before the next cycle is
  self-serve. One-tap purchase is only honest if it is also one-tap undo.

Easy must not mean accidental. The audience is non-technical owners, and a bill they
did not expect costs more trust than a limit ever did.

### Auto-expansion ceiling

A one-tap purchase path plus a compromised account is automated spend. Every meter
carries a per-cycle ceiling beyond which expansion stops being one tap and requires
genuine re-confirmation. Email needs this most: a hijacked account must not be able to
buy its way to a large send volume without a human decision.

## System accounts

**Accounts flagged `system` are never metered, never warned, and never blocked.**
WizeWorks-internal tenants — staff, demo, sales, seed and support — must not hit a
capacity wall while someone is mid-demo or mid-investigation.

This is an explicit, auditable flag on the account, not something inferred from an email
domain, a plan value, or a name pattern — inference is how a real customer eventually
gets free capacity by accident. It is never settable from a tenant-facing surface.

## Users

Suggested starting allowance: 3 included. Additional users are capacity expansion.

## Billing ownership

Get Piggles owns plan selection, payment setup, capacity upgrades, and payment recovery.
My Piggles may link into billing but must not duplicate billing logic.

**This does not mean capacity expansion redirects.** The affordance lives where the
friction is; the logic stays single-owner. My Piggles renders the inline prompt and calls
the account service's endpoint — it never reimplements pricing, proration or payment, and
it never bounces the user to another domain to finish. A redirect out of the console
mid-task is exactly the friction this posture exists to remove.

### Where the line falls

| Get Piggles owns                                     | My Piggles may                                       |
| ---------------------------------------------------- | ---------------------------------------------------- |
| The subscription itself                              | Show **one** meter's state, at the point of friction |
| Payment methods — add, change, remove                | Render the one-tap expansion for **that one** meter  |
| Invoices, receipts, billing history                  | Show approaching-limit notices                       |
| The full capacity dashboard — every meter, all usage | Deep-link to Get Piggles for anything broader        |
| **Reducing** or removing purchased capacity          |                                                      |
| Payment recovery and dunning                         |                                                      |
| Tax details, billing address, cancellation           |                                                      |

My Piggles must **not** show a plan comparison or picker, collect or change a payment
method, list invoices, carry a general "Billing" section, or compute price, proration or
tax.

### The rule that keeps it honest

**The console never knows a price.** A single narrow endpoint owned by the account
service returns both the priced option and executes it; My Piggles renders the label it
is handed and nothing else. A hardcoded or computed price in console code means billing
logic has leaked, however thin it looks — that is the testable version of this boundary,
and the thing to check in review.

### Two edge cases that will otherwise surface late

**No card on file.** The trial is 14 days with no card required, so one-tap expansion has
nothing to charge. This is the single case that legitimately hands off to Get Piggles —
the prompt becomes "Add a payment method to continue", deep-linked, rather than a tap
that silently fails.

**Deep links must land scoped.** "Manage capacity" from a storage prompt goes to Get
Piggles' capacity view _for storage_, not to billing home. Cross-domain, that is a target
parameter carried through the session handoff — landing the user at a generic billing
page and making them find their way back is the same friction wearing a different hat.
