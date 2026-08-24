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

## Why this is not confirmed yet

Two reasons, and both are honest rather than convenient:

1. **It only affects tenants created from now on.** Nia's account was provisioned
   before the fix, so nothing about her changes. Proving it needs a brand-new
   sign-up, the way [010](010-her-bakerys-web-address-is-quiet-haven-3783.md) was
   proved with "The Marrow Review".
2. **A fresh sign-up in dev would still get sparx**, because the fallback is
   `sparx` and the dev stack does not read the configmap the setting was added to.
   Making it read one needs the dev server restarted, which is not mine to do
   (personas CLAUDE.md).

So the confirmation to run once this deploys is: sign up a new Piggles business,
and check its products are **Rowan**, not sparx. Until somebody does that, this
issue stays open — a fix confirmed against the value it wrote is not confirmed
([089](089-her-salons-web-address-is-swift-horizon-4860-and-it-goes-nowhere.md)
is the lesson).

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

This is exactly what reason 2 above predicts — the dev stack falls back to
`sparx` because it never reads the setting — so it is confirmation that the
issue is still live in dev, NOT evidence that the fix is wrong. Two of three
personas run since have been born selling another company's merchandise, which
is the argument for setting `PIGGLES_GOLDEN_BLUEPRINT` in the dev stack rather
than waiting for prod: every remaining persona will hit it otherwise.

Devi deleted all six, as Nia did.

## What Nia did instead

Deleted the six, because she does not sell mugs, and built the homepage her salon
actually needs. Her four real shelf products go in during act 8. Recorded in
act 5.

## Rating effect

The published homepage is scored in [rating.md](../rating.md) with this as its
gap.
