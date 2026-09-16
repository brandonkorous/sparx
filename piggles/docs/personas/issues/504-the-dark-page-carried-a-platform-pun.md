# 504 — The page her customers saw carried a platform pun, in faded ink

**Status:** fixed and proven
**Severity:** minor
**Found by:** Devi, looking at what a shopper sees while her site is dark
**Surface:** `wizeworks/apps/site` suspended overlay, and `docs/17`
**Filed:** 2026-09-14

## What a shopper saw

Someone who types juniper-row.piggles.site while the shop is dark got a heading
and a sentence, centered on a pale page, with a small grey bar floating above the
heading:

> **Catching a fresh spark**
> This site is taking a short break and will be back shortly. Thanks for your
> patience — please check back soon.

## Four things wrong with it

**The heading is platform branding.** The spark is the sparx mark —
`Spark`, `Wordmark`, `SparkMascot` in `@sparx/brand`. The file's own comment says,
a dozen lines above the heading:

> No sparx logo either: a platform-branded takeover of a tenant's dark site would
> advertise exactly that. Understated protects the tenant's dignity.

The logo was taken out. The same advertisement was left behind in words. And
`wizeworks/apps/site` serves **every** brand's tenants, so on a Denver clothing
label reached through Piggles it is not even the right platform's joke.

**The heading says nothing.** A shopper who wanted a shirt does not learn from
"Catching a fresh spark" that the shop will be back. It is a pun about a company
they have never heard of, on the page where they needed one fact.

**The only sentence on the page was faded.** `text-neutral-500` on
`bg-neutral-50`. The house rule is that faded ink is for text deliberately not
meant to be read, and this page is two lines long, both of which are the point.

**A decorative bar sat above the heading**, which is the eyebrow slot the house
rules ban outright, doing nothing but being grey.

Plus an em-dash in customer-facing copy.

## What changed

> **Back soon**
> This site is taking a short break. Thanks for your patience, and please check
> again a little later.

Plain, brand-free, works for a bakery or a consultancy or a clothing label, and
says the one thing a visitor came for. Real ink on both lines, with the hierarchy
carried by scale and weight. The decorative bar is gone.

## The doc said to do it

`docs/17-billing-subscriptions.md` specified the overlay as _"a friendly
sparx-flavored message (e.g. "Catching a fresh spark — back in a flash")"_. The
code was faithfully implementing a spec that contradicted the constraint written
two lines below it in the same paragraph.

The doc now says the message is deliberately plain and brand-free, and why, and
records what it used to say. Bumped to 2.8.
