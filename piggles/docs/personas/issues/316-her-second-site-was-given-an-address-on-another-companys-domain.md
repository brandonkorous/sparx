# 316 — Her second site was given an address on another company's domain

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · confirming [313]
**Surface:** mypiggles › Settings › Sites › New site
**Filed:** 2026-08-28
**Fixed:** 2026-08-28 (the zone lookup) · 2026-08-29 (the second gate)
**Confirmed by:** driven as Devi on 2026-08-29 — twice, and the first drive found the second gate

## What happened

Devi added a second site to Juniper Row. The form told her, in as many words:

> Type a short version of the name. Your site will sit under `juniper-row.piggles.site`

She typed `archive` and pressed **Create site**. The site opened, and the address at the
top of it read:

    archive.juniper-row.sparx.zone

Not the address she was promised, and not her platform's domain at all. Her first site
is on `juniper-row.piggles.site`; her second is on a domain belonging to the other
product, named after something she has never heard of and cannot be told about.

## What should have happened

Every site a business owns sits under the same domain that business already has. The
form said which one, and the site should have got it.

## How to reproduce

Every time, on the local stack.

1. As any Piggles tenant, open **Settings › Sites** and add a second site.
2. Read the address on the site that opens.
3. `<handle>.<business>.sparx.zone`, while the form promised `piggles.site`.

Or off the database:

```sql
select d.host, p.slug, t.platform_brand
  from domains d join properties p on p.id = d.property_id
                 join tenants t on t.id = p.tenant_id
 where t.name = 'Juniper Row';
-- juniper-row.piggles.site        | primary | piggles
-- archive.juniper-row.sparx.zone  | archive | piggles   ← the second site
```

## Why it matters

**A customer would be handed it.** The address is what she puts on a card, in an email
signature, in an ad. It is also what a visitor sees in the bar. The one thing
`wizeworks/CLAUDE.md` RULE #0 is written to prevent is a person meeting the wrong brand,
and this is that, on the most public string the product produces.

**The screen contradicts itself two panes apart.** The create form composes the address
from the tenant's existing host and gets it right; the site pane shows the row the server
actually minted and gets it wrong. Whichever she believes, one of them lied to her.

**And it compounds.** The zone for a new site is read off the tenant's existing subdomain
rows, so once one wrong row exists it is the answer for every site added afterwards. One
misconfigured moment becomes permanent.

## Where it lives

`tenantZone` in
[wizeworks/services/api-rest/src/lib/domain.ts](../../../../wizeworks/services/api-rest/src/lib/domain.ts)
answers "which zone does this tenant live in" by walking the tenant's subdomain rows and
returning the first whose zone is in `OWNED_ZONES`. `OWNED_ZONES` comes from
`SPARX_ZONE_DOMAINS`.

Production sets it: `SPARX_ZONE_DOMAINS=sparx.zone,piggles.site`
([k8s/azure/infra/app-env-configmap.env](../../../../k8s/azure/infra/app-env-configmap.env)).
**The local stack sets neither variable**, so the list is `['sparx.zone']`, every
`piggles.site` row goes unrecognised, and the loop falls through to `SPARX_ZONE`.

So this is a configuration gap — and the reason it is filed as major rather than shrugged
off is the DIRECTION it fails in. A missing entry does not produce an error, or an empty
address, or anything anyone would notice. It produces a working address on the other
brand's domain, which is [[feedback_absent_behaves_like_fine]] exactly: absence rendering
as a confident wrong answer. The caller's own comment in
[properties.ts](../../../../wizeworks/services/api-rest/src/routes/v1/properties.ts)
already describes this outcome as the thing it is written to prevent, and it happened
anyway, because the prevention was one env var away from doing nothing.

**And it is TWO functions, not one** — which is only obvious once you follow the value
rather than stopping at the first thing that looks wrong. `properties.ts` composes
`mintZoneHost(tenant.slug, slug, false, await tenantZone(auth.tenantId))`, and
`mintZoneHost` re-checked the answer against `OWNED_ZONES` before using it. Two
independent membership tests on the same list, either of which is enough to produce the
bug. See "the second gate" below.

## The fix

**1. The zone is read off the HOST when the list does not recognise it.** Every
`type: 'subdomain'` row is a host the platform minted itself, so its last two labels ARE
the zone. That is reading back what provisioning wrote rather than trusting anything a
tenant typed, and it is the one answer that cannot be wrong — the tenant is already being
served there. A short `SPARX_ZONE_DOMAINS` can no longer cross a brand boundary; at worst
it now costs a lookup.

**2. The PRIMARY site's subdomain is consulted first.** That row is the one provisioning
minted at signup, so it is the tenant's zone by definition. Any other row is one some
later code path chose, and reading those back in creation order is what let a single
wrong host become the answer for every site added after it — which is the state Juniper
Row was already in by the time this was found.

**3. Resolved per row, not in two passes.** A pass that tried `zoneOf` across every row
first would step over the primary site's unrecognised zone and settle on a later row's
recognised one, which is the same bug wearing the fix's clothes.

### And the second gate, which the first attempt did not touch

Points 1 to 3 changed nothing, and only re-driving it showed why. Devi added a site with
that fix in place and got `press.juniper-row.sparx.zone` — the same wrong answer as
before.

**There were TWO gates, not one.** The host is
`mintZoneHost(tenantSlug, siteSlug, false, await tenantZone(tenantId))`, and
`mintZoneHost` opened with:

```ts
const zone = zoneDomain && OWNED_ZONES.includes(zoneDomain) ? zoneDomain : SPARX_ZONE;
```

So `tenantZone` read `piggles.site` correctly, handed it over, and `mintZoneHost` threw
it away — for the identical reason: `OWNED_ZONES` had never been told about it. Fixing
the source of the answer while leaving the check that discards it fixed nothing at all.
`cnameTargetFor` carried the same line, which is why the CNAME a Piggles customer was
told to point their domain at was `customers.sparx.zone`.

**Both now go through `zoneToUse`, which validates the SHAPE and not the membership.**
That is the honest guard. `SPARX_ZONE_DOMAINS` is an environment variable and can be
short of a zone the deployment is genuinely serving — signup does not consult it at all,
which is exactly how `juniper-row.piggles.site` came to exist on a stack that had never
heard of `piggles.site`. What makes taking the zone as given safe is where it comes from:
every caller that names one passes `tenantZone`, which reads it off a host the platform
minted itself.

**And it is now tested as a PAIR.** `wizeworks/services/api-rest/src/lib/domain.test.ts`
composes `mintZoneHost(…, await tenantZone(id))` in every case, because a unit test of
either half alone would have been green while the pair was broken. Ten tests; three go
red if the membership check comes back.

## What this does NOT fix

The three rows already written. `archive.`, `trade.` and `press.juniper-row.sparx.zone`
still exist and still resolve; the fix only governs what is minted next. Whether existing
rows should be rewritten is a separate question with a redirect problem attached (an
address that has been given out has to keep working), and it is not this issue's to
answer.

**Connecting a custom domain is still gated on `OWNED_ZONES` alone.** `isZoneHost` is
asked about a host a tenant typed, so there is no minted row to read a zone back from,
and the env var really is the only thing that knows. On a stack whose list is short, a
tenant could "connect" another tenant's `piggles.site` host as though it were their own
domain. Production sets both zones, so this is a local-configuration exposure rather than
a live one, and the remedy is the env var rather than a code change.

The dev stack also still has no `SPARX_ZONE_DOMAINS`, so it remains the one environment
where the brand boundary cannot be exercised as configured. The fix means it no longer
has to be.

## Confirmed by

Driven as Devi on 2026-08-29, and the drive is the reason this issue has a second half.

**The first attempt, driven:** added **Juniper Row Press**. The form promised
`press.juniper-row.piggles.site`; the site that opened read
`press.juniper-row.sparx.zone`. Unchanged. That is what turned up the second gate above,
and nothing but driving it would have — the fix was correct, the test of it would have
been green, and the address was still wrong.

**After `mintZoneHost` and `cnameTargetFor` were fixed too:** added **Juniper Row
Journal**. The form promised `journal.juniper-row.piggles.site`; the site pane's header
read `journal.juniper-row.piggles.site`. Same string, her own brand, matching her first
site.

**From the database**, no `piggles` tenant has a `sparx.zone` row minted after the fix —
the three that remain are all timestamped before it:

```
juniper-row.piggles.site          primary  2026-08-23 10:15
archive.juniper-row.sparx.zone    archive  2026-08-29 02:59   ← before
trade.juniper-row.sparx.zone      trade    2026-08-29 03:56   ← before
press.juniper-row.sparx.zone      press    2026-08-29 04:24   ← before (the failed re-drive)
journal.juniper-row.piggles.site  journal  2026-08-29 04:33   ← after
```

**The CNAME too.** Connecting `journal.juniperrow.test` to a Juniper Row site now shows
Value `customers.piggles.site`. Before the second half of the fix it would have read
`customers.sparx.zone` — the single most consequential wrong string in the product,
because it is the one an owner pastes into a registrar and never looks at again.
