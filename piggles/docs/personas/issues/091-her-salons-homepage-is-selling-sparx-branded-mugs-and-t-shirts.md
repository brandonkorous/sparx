# 091 — Her salon's homepage is selling sparx-branded mugs and t-shirts

**Status:** open (cause fixed; the confirmation needs a deploy)
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** the published site — `/` · mypiggles › Sell › Products
**Filed:** 2026-08-21
**Fixed:** 2026-08-21 — for businesses created from here on
**Confirmed by:** — (see "Why this is not confirmed yet")
**Blocked on:** pipeline — the new setting has to reach a running deployment before a fresh sign-up can prove it

## What happened

Nia published her booking page, then opened her own website the way a client
would. This is the homepage of a two-chair hair salon, live, on the public
internet:

> **Your work, beautifully online.**
> Publish your pages, tell your story, and sell when you are ready — all from one
> place. This is your homepage; edit every word to make it yours.
>
> **Browse the shop** · Learn more
>
> **Shop our products**
> **sparx Insulated Bottle** $32.00 · **sparx Ripstop Cap** $26.00 ·
> **sparx Canvas Tote** $22.00 · **sparx Enamel Mug** $18.00 ·
> **sparx Everyday Tee** $28.00 · **sparx Field Notebook** $14.00
>
> **Featured**
> _(the same six again)_

Six products, another company's name on every one, with prices, twice on the
page, above the fold, under her business's name and her business's logo.

Nothing about hair. No **Book** button anywhere in the body. No hours. The only
words about her trade are the ones telling her to replace them.

Read back from her account, all six of her products are that merchandise:

| Title                  | Handle                   | Status     |
| ---------------------- | ------------------------ | ---------- |
| sparx Canvas Tote      | `sparx-canvas-tote`      | **active** |
| sparx Enamel Mug       | `sparx-enamel-mug`       | **active** |
| sparx Everyday Tee     | `sparx-everyday-tee`     | **active** |
| sparx Field Notebook   | `sparx-field-notebook`   | **active** |
| sparx Insulated Bottle | `sparx-insulated-bottle` | **active** |
| sparx Ripstop Cap      | `sparx-ripstop-cap`      | **active** |

`active`, so they publish. This is not draft data sitting in a list she has not
opened; it is her shop.

**And it is not just her.** Four of the six Piggles businesses in the pool carry
the same six:

| Business          | sparx-branded products | total |
| ----------------- | ---------------------- | ----- |
| Halo & Hem        | **6**                  | 6     |
| Wildroot Flowers  | **6**                  | 16    |
| Marta's workspace | **6**                  | 6     |
| E2E's workspace   | **6**                  | 7     |

## What should have happened

**Piggles already has the right answer and does not use it.** There are two
starter blueprints in the catalogue, and their demo products differ by exactly
one word:

| Blueprint         | Its demo products                                                      |
| ----------------- | ---------------------------------------------------------------------- |
| `sparx` 1.4.0     | sparx Canvas Tote, sparx Enamel Mug, sparx Everyday Tee, …             |
| `piggles-starter` | **Rowan** Canvas Tote, **Rowan** Enamel Mug, **Rowan** Everyday Tee, … |

`piggles-starter` was written for this — an invented demo business, no product's
name on it. Nia should have got Rowan. She got sparx.

## Why it matters

This is the sparx-product leak that piggles/CLAUDE.md is about, and it is the
worst instance found so far, because every other one has been inside the console
where only the owner sees it. This one is **on the customer's side of the
glass**, with prices on it, on a page she has been told is hers.

Three separate harms, in order:

1. **Another company's brand is on her storefront.** A client who lands on Halo
   & Hem is offered a sparx Enamel Mug. Nia cannot explain that, and nobody in
   the product told her it was there.
2. **She never asked to sell anything.** She deliberately did not tick "I sell
   things" during onboarding, which P02 exists partly to test. Her account
   answered by publishing a shop.
3. **Her booking page is excellent and invisible.** `/book` renders her ten real
   services with her prices and live availability — and the homepage, which is
   what anyone actually lands on, does not link to it once.

## Where it lives

[wizeworks/services/api-rest/src/lib/golden-blueprint-provisioning.ts](../../../../wizeworks/services/api-rest/src/lib/golden-blueprint-provisioning.ts):

```ts
/** The platform's default site. … */
const GOLDEN_BLUEPRINT_KEY = 'sparx';
```

A hardcoded literal, applied to **every new tenant of every brand** — the file's
own header says "install the platform's DEFAULT site (the golden `sparx`
blueprint) onto every new tenant's PRIMARY property". It runs on `tenant.created`,
which is sign-up: before onboarding has been answered, so the gate ("this
property carries no install yet") is always open and sparx always wins the race.

Onboarding then installs the pick on top —
[piggles/apps/account/lib/furnish.ts](../../../apps/account/lib/furnish.ts) sends
`sparx-salon-editorial`, which is why her `/book` page is a real salon page. But
the golden install has already published a homepage and created six products, and
nothing takes them away.

Piggles' own `DEFAULT_BLUEPRINT_KEY = 'piggles-starter'` in that same file is
**only the fallback for a tenant who chooses nothing**, so choosing a look is
what left the sparx starter in place.

## The fix

**The golden blueprint is a fact about the BRAND, not a literal.** Every piece
needed was already built:

- `Tenant.platformBrand` records which brand a tenant signed up under.
- `PlatformBrandIdentity` in
  [wizeworks/packages/brand-core](../../../../wizeworks/packages/brand-core/src/index.ts)
  is the registry of exactly these per-brand facts, and already carried
  `zoneDomain`, `billingPlan`, the wordmark and the accent. Its header records why
  it exists, and it is this defect one step earlier: "it guessed: a Piggles
  customer got platform email signed 'sparx Support'".

So `goldenBlueprintKey` joins that identity, and the provisioner asks for it:

```ts
async function goldenBlueprintKeyFor(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { platformBrand: true },
  });
  return platformBrandIdentity(tenant?.platformBrand).goldenBlueprintKey;
}
```

**Brand-blind by construction.** It reads the registry and never reads the
brand's name, so there is no `if (brand === 'piggles')` and a third brand needs
no change here (piggles/CLAUDE.md RULE #0). The literal is gone.

**The fallback is still `sparx`**, which keeps every existing deployment exactly
as it behaves today — and that is also why the setting is not optional in
practice. `PIGGLES_GOLDEN_BLUEPRINT=piggles-starter` is added to both
configmaps, with the same warning the neighbouring `PIGGLES_BILLING_PLAN` carries:
a brand missing it looks completely normal until a customer reads the page.

## The second cause — found 2026-08-24, and it was the live one

The write-up above fixed the PROVISIONER and then explained the remaining
failures as "the dev stack does not read the setting". That explanation was
wrong, and the way it was wrong is the interesting part.

`PIGGLES_GOLDEN_BLUEPRINT=piggles-starter` **is** set in the local
`services/api-rest/.env`. It was set when Devi signed up. She was still born
selling sparx mugs.

Because the console never asked. Piggles' own onboarding carried:

```ts
// piggles/apps/workbench/surfaces/onboarding/wizard/step-blueprint.tsx
/** The platform's default starting point — the golden sparx template. */
export const GOLDEN_BLUEPRINT_KEY = 'sparx';
```

and both entry points defaulted to it — the classic wizard's initial `choice`,
and the story composer's `blueprint?.key ?? GOLDEN_BLUEPRINT_KEY`. So the console
POSTed `/v1/blueprints/sparx/install` by name. `goldenBlueprintKeyFor` was never
consulted, because nothing was left for it to resolve: a caller that names a
blueprint has already answered the question the resolver exists to answer.

This is the shape this run keeps finding — **one outcome, two causes** — and it
is the reason the first fix could be correct and change nothing. Setting the env
var, the remedy this issue prescribed for eight days, would not have fixed it.

It is also a plain piggles RULE #0 violation that survived the tree split: the
file is Piggles' own copy of sparx's, and this constant is one of the things it
"inherited" verbatim, sparx's name and all.

### The fix

**The console stops naming anybody's blueprint.** `GOLDEN_BLUEPRINT_KEY` is
deleted, and the file carries a comment saying why so it is not reintroduced.

**The server answers instead.** `GET /v1/tenant/onboarding` now returns
`goldenKey`, resolved per tenant from its own `platformBrand`:

```ts
return ok({
  ...readOnboarding(row?.settings ?? null),
  goldenKey: platformBrandIdentity(row?.platformBrand).goldenBlueprintKey,
});
```

Both entry points read it. One source of truth — the env var — and the console
holds no brand's name, so a third brand needs no change here either.

**Null means scratch, not sparx.** If the server does not say, nothing is
preselected and the story path commits no blueprint. An empty site is a better
answer than another company's demo business, and that is the whole lesson of this
issue.

## Why this is not confirmed yet

It only affects tenants created from now on, so proving it needs a brand-new
sign-up. That has not been run because `localhost` cookies ignore the port, so
signing up on `:3021` replaces the active persona session on `:3022` — it is
queued for the end of the P03 run rather than dropped.

The confirmation to run: sign up a new Piggles business and check its products
are **Rowan**, not sparx. A fix confirmed against the value it wrote is not
confirmed ([089](089-her-salons-web-address-is-swift-horizon-4860-and-it-goes-nowhere.md)
is the lesson), and this issue has now been wrong once about its own cause.

## Reproduced again — P03, 2026-08-23

Devi Raman's Juniper Row, signed up in dev after the fix landed, was born with
the same six:

```
        title         |        handle        |         created_at
----------------------+----------------------+----------------------------
 sparx Field Notebook | sparx-field-notebook | 2026-08-23 10:43:42.035+00
 sparx Everyday Tee   | sparx-everyday-tee   | 2026-08-23 10:43:42.183+00
 sparx Enamel Mug     | sparx-enamel-mug     | 2026-08-23 10:43:42.273+00
```

At the time this was read as "the dev stack never reads the setting". It does.
The real cause was the console naming `sparx` itself, found on 2026-08-24 and
written up above. Two of three personas were born selling another company's
merchandise, and setting the env var — the fix this section argued for — would
not have stopped the third.

Devi deleted all six, as Nia did.

## What Nia did instead

Deleted the six, because she does not sell mugs, and built the homepage her salon
actually needs. Her four real shelf products go in during act 8. Recorded in
act 5.

## Rating effect

The published homepage is scored in [rating.md](../rating.md) with this as its
gap.
