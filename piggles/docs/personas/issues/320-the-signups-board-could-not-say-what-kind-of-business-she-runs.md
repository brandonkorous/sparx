# 320 — The signups board could not say what kind of business she runs

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · the run-wide **Growth board** record
**Surface:** WizeWorks' own CRM — the tenant-signups board
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** the mirror re-run against her real tenant row — the trade reached the board

## What happened

Taking the run-wide growth-board record — _did this signup produce one contact,
one deal, the brand tag and the story fields?_ — the first three are there and
the fourth is empty.

Devi's signup did land. Under the `wizeworks` tenant:

```
contact  960fe725-4a76-452e-bd37-bed28acae2b4  p03.devi@piggles.test
         tags {tenant-signup, brand-piggles, channel-marketing-site}
deal     d708cb12-b4fd-4aea-8887-585b2b615c95  "Juniper Row (juniper-row)"
         source signup · trialing · acquisitionSource "pricing-hero"
```

The deal's metadata carries her modules, her trial dates, how she arrived, and
her Piggles rail answer. Then:

```
"storyIndustry":       null
"storyAudience":       null
"storyText":           null
"storyComposedAt":     null
"storyImpliedModules": []
```

**She answered the industry question.** It is on her own tenant row, in the same
JSON blob the board already reads, one key away:

```
tenants.settings.industry              "apparel"
tenants.settings.onboarding.story      (absent)
```

Every Piggles tenant in the database is the same. Five of the eight have a trade
recorded and not one has a story:

| Tenant             | `settings.industry` | `settings.onboarding.story` |
| ------------------ | ------------------- | --------------------------- |
| juniper-row        | `apparel`           | absent                      |
| halo-and-hem       | `salon`             | absent                      |
| wildroot-flowers   | `florist`           | `null`                      |
| quiet-haven-3783   | `food`              | absent                      |
| marrow-review      | —                   | absent                      |
| noble-comet-3713   | —                   | absent                      |
| sleek-orchard-5021 | —                   | absent                      |
| sunny-summit-1198  | —                   | absent                      |

**And it is not a Piggles problem.** Every sparx tenant carrying an industry has
the same empty story — `demo-pantry` (`food`), `demo-salon` (`salon`),
`demo-supply` (`wholesale`), `demo-studio` (`professional`), `demo-apparel`
(`apparel`), `demo-notes` (`electronics`), and `wizeworks` itself
(`professional`). Seven for seven.

## What should have happened

The board knows what kind of business signed up, because the business said so.

## How to reproduce

Every time, for every tenant that has ever signed up.

1. Sign a tenant up and answer the trade question during onboarding.
2. Read its deal in the `wizeworks` tenant's `tenant-signups` pipeline.
3. `metadata.storyIndustry` is `null`, while `tenants.settings.industry` on the
   tenant that just signed up holds the answer.

## Why it matters

**The board's own code says what the field is for**, in
[mirror.ts](../../../../wizeworks/packages/platform-crm/src/mirror.ts):

> the signups board could show when tenants arrived but never what kind of
> business arrived. Retention does not look the same across a bakery, a
> consultancy and a wholesaler, and these are the fields that tell them apart.

That is the stated purpose, and it is unmet for every row on the board. Counting
arrivals still works; segmenting them by kind does not, which is the half that
was worth building.

**It bites hardest on the question the second brand exists to answer.** The
`brand-piggles` tag lands, so "how many Piggles signups" is answerable. "What
kind of businesses is Piggles attracting, and are they different from sparx's"
is not — and that comparison is the reason for running two brands at all.

**Nothing looks wrong.** An empty story column renders identically for a tenant
that skipped onboarding and one that answered it in full, so the board reports a
gap in the data where there is a gap in the reader
([[feedback_absent_behaves_like_fine]]).

Filed `minor`, plainly: no owner is blocked, no money is wrong, and nothing on
Devi's screen is false. It is WizeWorks' own instrument reading zero.

## Where it lives

[wizeworks/packages/platform-crm/src/mirror.ts](../../../../wizeworks/packages/platform-crm/src/mirror.ts)
— `readStory()` looks in exactly one place:

```ts
const story = (settings as { onboarding?: { story?: unknown } } | null)?.onboarding?.story;
```

`settings.onboarding.story` is what the **console's** story composer writes
(`/get-set-up/describe-your-business`). Piggles has a second onboarding, in the
account app, and that is the one its tenants actually go through — it asks the
trade and the "what do you do" groups and saves them as `settings.industry` plus
`settings.piggles.railGroups`
([onboarding-save.ts](../../../../piggles/apps/account/lib/onboarding-save.ts)).

The rail answer survives, because that file deliberately keeps it — _"The RAW
answer, kept because the WizeWorks board segments on it."_ The trade does not,
because the mirror never looks where the trade is written.

`settings.industry` is stamped by the industry-starter installer for **both**
brands, which is why the sparx tenants show the same hole.

## The fix

**Two changes, and the second was only found by trying to confirm the first.**

**1. Read the trade from where it is recorded.** `readStory()` falls back to
`settings.industry` when the composer's nested copy is absent. One function, and
it is brand-blind by construction — the key it reads is written by the shared
industry-starter installer, so sparx tenants gain the same field on the same
change.

The other four story fields stay `null` when there is no composer story.
`audience`, `text` and `composedAt` are things the shorter onboarding never asks,
and manufacturing a sentence nobody wrote would be worse than an empty column.
`impliedModules` stays empty because that answer already travels, honestly and
separately, as `railGroups`.

**2. The board's facts were frozen at the last rename.** With change 1 in place
the mirror still reported nothing, and this is why — `ensureMirror` rewrote a
deal's metadata inside one condition:

```ts
const title = dealTitle(facts);
if (title !== existing.title) {
  await dealService.update(ctx, existing.id, { title, metadata: dealMetadata(facts) });
}
```

The comment above it is about the TITLE, which changes once, when a placeholder
workspace name becomes the real business name — if it ever changes at all. The
metadata was riding along on that condition.

**So no fact recorded after signup could ever reach the board.** And onboarding
necessarily runs after signup: the tenant row has to exist before there is
anything to onboard. Devi's deal was written at `10:15:19.175`; she chose her
trade at `10:50`. Thirty-five minutes too late, permanently — as it was for every
tenant, for the modules and the subscription facts as well as the trade.

The two conditions are now separate: the title is refreshed when the name
changed, the metadata when the facts changed. Still conditional, so a redelivered
message that changes nothing writes nothing and emits no CRM event — the
comparison is `sameMetadata`, key-order-insensitive because the stored side is
`jsonb` and a naive `JSON.stringify` would report a difference on every call and
quietly turn the guard into "always write".

**3. Nothing renders any of this, and that is left open.** `storyIndustry`,
`storyAudience`, `storyText` and `railGroups` are read by no file in the
repository — the metadata is written and never displayed. There is no signups
board screen; the fields live in `deals.metadata` for whoever writes the query.
Building that surface is larger than the record that found it, so it is not
attempted here.

## Confirmed by

**There is no screen to confirm this on**, per part 3 — the board is a query, not
a page. So it was proved against the real system instead: the real mirror, the
real entry point (`mirrorTenant`, what the worker and the sanctioned backfill
both call), Devi's real tenant row, under RLS as `sparx_app`.

```
outcome  {"status":"mirrored","customerId":"960fe725…","dealId":"d708cb12…",
          "created":false,"stage":"activated"}

deal d708cb12 (Juniper Row (juniper-row)) after:
  platformBrand   piggles
  storyIndustry   apparel        ← was null
  railGroups      ["web","sell","people"]
```

`created: false` matters as much as the value: it updated the deal that already
existed rather than adding a second one, which is what part 2 had to be true for.

**One run in between was made wrong, and it is worth recording.** The first
attempt ran as `sparx_owner`, which carries `BYPASSRLS` — the very thing the
backfill script's header warns against ("it must run as the same role the worker
does, not as the migration owner"). Without RLS, `resolvePlatformTarget`'s
`property.findFirst({ where: { isPrimary: true } })` is unscoped, so it returned
**another tenant's** primary property, and the run wrote a duplicate contact and
deal onto the board carrying Halo & Hem's property id. Re-running as `sparx_app`
resolved correctly and healed the original rows; the two stray rows were then
deleted under RLS, and the board is back to one row for Juniper Row. **No product
defect there** — the guard did exactly what it is for, and the mirror is
idempotent when run as documented.

## Rating effect

No pane moves. Nothing a tenant can open is affected.
