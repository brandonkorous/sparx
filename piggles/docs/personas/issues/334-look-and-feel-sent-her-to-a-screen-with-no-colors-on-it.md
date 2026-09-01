# 334 — Look & feel sent her to a screen with no colors on it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · chasing a stale business name on her primary site
**Surface:** mypiggles › My Site › Look & feel (before a look is picked)
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** reopened Look & feel as Devi — it now says where her colors actually come from

## What happened

Devi has picked no look for her main site, so **Look & feel** is an empty state
carrying one sentence and one button:

> Your site is using the colors from your business details. Pick a look to change
> how it feels.
>
> \[ Choose a look ]

Her site is amber, `#c77618`, on every button and link. So a reader who wants a
different amber goes where the sentence points.

**Business details has no colors on it.** Opened as her, it is five panels:
Business (name, type, company number), Address, Contact, Tax, Defaults (currency
and time zone). There is no color, no logo, no font, and nothing that could make
a site amber.

## What should have happened

The one sentence on an empty screen says something true about where the thing it
is describing comes from.

## Why it matters

**It is the only sentence on the screen.** An empty state has one job, and this
one is where a person lands when they want to change how their site looks. Being
sent to the wrong screen is the entire failure — she arrives at address and tax
fields, finds nothing to change, and has to work out on her own that the sentence
was wrong rather than that she missed something.

**It is false, not merely vague.** `#c77618` lives in her site's own brand
(`Property.brand_override.colorPrimary`); Business details is `tenant_businesses`,
which has no color column of any kind. The two records have nothing to do with
each other.

## Where it lives

[theme-pane.tsx](../../../../piggles/apps/workbench/surfaces/studio/theme-pane.tsx),
the `!state.store` branch — the empty state shown when no look is open, which for
this pane means none is applied (`openId = selectedId ?? appliedId`).

## The fix

> You have not picked a look yet, so your site is wearing its own colors. Pick one
> to change how it feels.

It now names her state rather than a screen: the site is wearing its own colors,
and the way to change that is the button directly underneath. Nothing sends her
anywhere, because there is nowhere else to go — the colors a site wears before a
look is picked are not editable field by field, and offering a look is the real
answer.

## Found on the way, and NOT a defect

The thread that started this was a note that her primary site's
`brand_override.businessName` reads **"Saffron & Sage Catering"** — the sample
name from the `sparx-catering-events` blueprint, on a clothing maker who never
installed it. The note said it "feeds OG images and documents". **It feeds
neither, and I checked all three consumers rather than repeating the claim:**

| Where                     | Reads                                                              | Renders         |
| ------------------------- | ------------------------------------------------------------------ | --------------- |
| OG / social cards         | `Property.name`                                                    | **Juniper Row** |
| Invoices, packing slips   | `Property.name` → `tenantBusiness.businessName` → `Tenant.name`    | **Juniper Row** |
| Email wordmark and footer | `Property.name` (its own comment: "NEVER the tenant's legal name") | **Juniper Row** |

The field is inert. `site-identity-data.ts` reads it, never offers it for
editing, and carries it through every save, which is why it has survived — but
nothing downstream asks it for anything. Recorded here so the next person does
not chase it a third time.

Its provenance stayed unexplained and is not worth more time: her three blueprint
installs (`sparx` 1.4.0, `sparx-retail-apparel-minimal` 1.4.2 and 1.5.0) recorded
brand baselines of "Alder & Ash", "Kestrel" and "Kestrel", and the catering
blueprint was never installed on this tenant.

## Rating effect

Against `My Site › Look & feel`. The pane was never scored before a look was
picked, which is the state most tenants meet it in.
