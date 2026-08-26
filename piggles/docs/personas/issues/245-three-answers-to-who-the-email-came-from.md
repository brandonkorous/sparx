# 245 — Three parts of the platform each had their own answer to "who is this from"

**Status:** fixed and confirmed (one part left open, and it is not code)
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 10 — sending the autumn drop announcement
**Surface:** mypiggles › Messages › Broadcasts, and the send pipeline behind it
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 10 — the composer and the queued payload now read the same line

## What happened

Devi's newsletter went to 23 people. The console told her it came from:

```
noreply@piggles.email
```

The payload the send actually queued said:

```
"from": "Piggles <noreply@sparx.email>"
```

And what the dispatch tick handed the mail provider was neither:

```
sparx <noreply@sparx.email>
```

## What should have happened

One answer. Preferably the one on the screen.

## Why it matters

The sender name is the single thing a recipient reads before deciding whether to
open an email. Twenty-three of Devi's customers were told a drop announcement
from a clothing label they had bought from was sent by **sparx** — a company
none of them, and not Devi either, has ever heard of. It is not a Piggles
product; it is the other brand this platform serves.

And the screen she checked before pressing Send named a third thing, so there
was no way for her to catch it.

## Where it lives

Three implementations of one fact.

**1. The console invented its own.**
[broadcasts-data.ts](../../../apps/workbench/surfaces/email/broadcasts-data.ts)

```ts
if (!settings?.fromAddress)
  return productCopy('email.sender.fallbackAddress', 'noreply@sparx.email');
```

`email.sender.fallbackAddress` is `noreply@piggles.email` in the Piggles copy
table — a domain the platform is not authorized to send from and has never sent
from. The client also dropped the sender NAME entirely, so the one part a
recipient reads was the one part the screen did not show.

**2. The correct implementation was overwritten by a copy of itself.**

`buildTenantFrom` in
[platform-sender.ts](../../../../wizeworks/packages/email-platform/src/services/platform-sender.ts)
resolves the platform name from `Tenant.platformBrand`, and its header comment
describes fixing precisely this leak. It works. It is also pointless, because
api-rest kept a second `buildFrom` in
[tenant-email.ts](../../../../wizeworks/services/api-rest/src/lib/tenant-email.ts)
with the platform name hardcoded — and that one runs at **dispatch**:

```ts
const from = buildFrom(identity.fromName, identity.fromAddress);
const common = { to, from, ... };
...
data = { ...raw, ...common };   // ← `common` spread LAST, over the stamped value
```

Every scheduled send — which is every broadcast — had its correct `from`
replaced on the way out. The fix had shipped and never once applied.

**3. The address could not have moved even if it were configured.**

`platformFrom` returns a brand's own `<BRAND>_EMAIL_FROM` verbatim when it has
one, so the machinery for a second sending domain was already there. But
[mailgun.ts](../../../../wizeworks/packages/email/src/providers/mailgun.ts)
posted every message to one path segment:

```ts
const domain = config.defaultDomain;
```

A message posted to `/v3/a.example/messages` carrying `From: someone@b.example`
is signed with a.example's DKIM key and fails alignment for b.example. So
setting the second brand's address without fixing this would have been _worse_
than the leak: instead of the wrong name, spam folders. The provider's own
comment admitted the gap — "when tenant domains land, the caller passes
`senderDomain` to override the default" — and nothing ever did.

## The fix

**One answer, resolved once, by the layer that knows.** `settingsService.get`
now returns `resolvedFrom`: the literal `From` header a send will carry, built
by `buildTenantFrom`. The console prints that string and derives nothing.

**api-rest's `buildFrom` delegates** to `buildTenantFrom` instead of repeating
it. There is now one implementation, and `platform-sender.ts` carries a note
saying what the second one cost.

**Mailgun routes by the message's own `From`** when that domain is one the
account is authorized for (`SPARX_MAILGUN_DOMAINS`), so DKIM signs with the key
that matches the address. A `From` on anything else — a tenant's own domain we
cannot send for — falls back to the default exactly as before. Nine tests,
including the one proving a single-domain account behaves identically; the
routing test was proven red before it was proven green.

## What it looked like once fixed

The composer, the summary of the sent broadcast, and the queued payload now all
read:

```
Piggles <noreply@sparx.email>
```

## What this does not fix

**The address is still the other brand's**, because that is configuration and
infrastructure, not code. `piggles.email` is registered but is not a verified
Mailgun sending domain and has no DNS. Both switches are written into
[app-env-configmap.env](../../../../k8s/azure/infra/app-env-configmap.env) with
the ordering warning on them:

```
SPARX_MAILGUN_DOMAINS=sparx.email,piggles.email
PIGGLES_EMAIL_FROM=Piggles <noreply@piggles.email>
```

Setting the second before the first verifies is the spam-folder outcome above.
Brandon has this.

**And the sender still names the PLATFORM, not the shop.** Devi's customers will
read "Piggles" where they expect "Juniper Row". That is deliberate and it is
somebody's decision to make: `platform-sender.ts` flags it as an open product
question and warns against smuggling it in behind a leak fix —

> Fixing "names the wrong company" and changing "names the platform instead of
> the shop" are two different changes, and bundling the second into the first is
> how a product decision gets made by nobody.

Recorded here rather than done.

## Housekeeping done alongside

Two docs asserted the address "cannot move until Piggles has DNS of its own" —
[packages/email/CLAUDE.md](../../../../wizeworks/packages/email/CLAUDE.md) and
`platform-sender.ts`. Both described the configuration and read as a limit of
the code. Corrected in the same session, per the rule about stale capability
claims.

`broadcast-detail.tsx` was 985 lines and this touched it, so under RULE #0.5 it
split by responsibility into ten files, all under the cap.

## Related

[246](246-delivered-nothing-a-minute-after-twenty-three-emails-went-out.md),
[247](247-the-newsletter-picker-offered-to-send-a-payment-failure.md),
[248](248-nothing-could-be-previewed-from-the-surface-that-sends.md) and
[249](249-the-email-she-had-just-designed-was-not-in-the-list.md) are the rest of
the same afternoon.

## Rating effect

`Messages › Broadcasts` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
