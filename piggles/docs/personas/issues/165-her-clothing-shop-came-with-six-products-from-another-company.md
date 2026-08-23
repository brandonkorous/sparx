# 165 — Her clothing shop came with six products from another company

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 1
**Surface:** mypiggles › Sell › Products — and the published site
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** her catalogue, emptied on screen — below (with one half still pending)

## What happened

Act 1 is clearing the decks: Devi's own catalogue is coming and she does not want
two shops in one. She used **Practice data → Remove sample data**, which did
exactly what it promised. Then she looked at what was left:

|                                                                                                                                                                                 |                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| The Everyday Tee · The Oxford Shirt · The Fisherman Knit · The Merino Crew · The Wide-Leg Trouser · The Pleated Trouser · The Overcoat · The Lambswool Scarf · The Leather Tote | the boutique template she chose |
| **sparx Canvas Tote · sparx Enamel Mug · sparx Everyday Tee · sparx Field Notebook · sparx Insulated Bottle · sparx Ripstop Cap**                                               | nobody's idea                   |

Six products in her shop are branded merchandise for a company she has never
heard of, and one of them — an "Everyday Tee" — is the name of a garment she
actually makes.

It is not only hers. Every Piggles business in this database has the same six:
Halo & Hem, and the three demo businesses including `wildroot-flowers`, which is
the example workspace the marketing site shows on its home page.

## What should have happened

A Piggles business gets Piggles' starter, which exists: `piggles-starter` ships
the same six products named for an invented business, and the account app already
treats it as the default. Nothing should ever put another brand's name in a
customer's catalogue.

## How to reproduce

Every Piggles tenant, in this environment.

1. Sign up and finish onboarding.
2. Console → **Sell** → Products, or the published site's shop.
3. Six products beginning "sparx".

Or read it directly:

```sql
select t.slug, p.title from commerce_products p
  join tenants t on t.id = p.tenant_id
 where t.platform_brand = 'piggles' and p.title ilike 'sparx%';
```

## Why it matters

`wizeworks/CLAUDE.md` RULE #0 puts it plainly — **no product names in
user-facing strings** — and a product row in a customer's own shop is as
user-facing as it gets. It reaches her published website, her search results and
her social cards without her doing anything.

Recorded as minor rather than major because of where the cause is, which is worth
being exact about (below). It is real on this screen and it is not shipping to
paying customers.

## Where it lives

[wizeworks/services/api-rest/src/lib/golden-blueprint-provisioning.ts](../../../../wizeworks/services/api-rest/src/lib/golden-blueprint-provisioning.ts)

`goldenBlueprintKeyFor` asks the brand rather than naming one — that is issue
**#091**, already fixed, and the comment above it describes this exact symptom
("a Piggles salon was born with a homepage selling sparx Enamel Mug"). The code
is right.

What is missing is the answer. It resolves
`platformBrandIdentity(brand).goldenBlueprintKey`, which reads
`PIGGLES_GOLDEN_BLUEPRINT` and falls back to `DEFAULT_GOLDEN_BLUEPRINT`, which is
`'sparx'`.

| Where                                                      | Set?                          |
| ---------------------------------------------------------- | ----------------------------- |
| `k8s/azure/infra/app-env-configmap.env` (the live overlay) | **yes** — `piggles-starter`   |
| `wizeworks/services/api-rest/.env`                         | no                            |
| `wizeworks/services/api-rest/.env.example`                 | no                            |
| `k8s/sparx-prod/app-env-configmap.yaml`                    | no — the retired GCP-era file |

So production is right and every developer's machine is wrong, which is the worst
way round for something nobody would think to check.

**The second half is not config.** Nothing stopped it. Furnishing checks
`blueprintVisibleTo(key, brand)` before installing a template, precisely so a
posted form field cannot install the other brand's showcase — and provisioning,
which installs a template into every tenant that has ever existed, does not run
that gate at all. A missing variable therefore renders identically to a correct
one, which is the failure shape this project keeps meeting.

## The fix

Both halves.

**The answer the brand was never given.** `PIGGLES_GOLDEN_BLUEPRINT=piggles-starter`
in [.env](../../../../wizeworks/services/api-rest/.env) and
[.env.example](../../../../wizeworks/services/api-rest/.env.example), matching what
the live overlay already sets. The example matters as much as the working file:
it is what the next environment is built from.

**The gate that was missing.** `installGoldenForTenant` now runs
`blueprintVisibleTo(goldenKey, brand)` before installing — the same check
furnishing already makes before installing a chosen template. It refuses rather
than substituting, logs the key and the brand at `error`, and names the variable
to look at. A refused install leaves the tenant undressed, which onboarding then
fixes with the template the person actually picked; a bare site is recoverable and
the wrong company's shop is what somebody publishes without noticing.

That gate has teeth here because the manifests already declare the answer:
`marketplace-catalog/blueprints/sparx/sparx.json` is `"brands": ["sparx"]` and
`piggles-starter` is `"brands": ["piggles"]`. Provisioning simply never asked.

## Confirmed by

**Her shop, on screen.** Sell → Products, searched `sparx`: six rows, brand
`sparx`, web addresses `/sparx-canvas-tote` and the rest — every one of them a URL
on her published site. Deleted all six as Devi, one at a time (that grind is
[166]), then the nine template products with them. Products now reads **"Nothing
to sell yet"**, which is what act 1 asked for.

**Not yet confirmed, and worth being exact about:** that a NEWLY created tenant is
born clean. That needs a signup, and the persona rules give each business exactly
one account, so it is P04's first screen rather than something to manufacture
here. What IS established is that the gate's inputs are right — the account app's
own picker, which uses the same `blueprintVisibleTo`, correctly never offered Devi
sparx's showcase during onboarding.

## Rating effect

Counted against `Sell › Products` in [rating.md](../rating.md).
