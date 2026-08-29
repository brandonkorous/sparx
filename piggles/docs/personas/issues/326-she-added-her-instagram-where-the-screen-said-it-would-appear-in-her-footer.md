# 326 — She added her Instagram where the screen said it would appear in her footer, and it did not

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — the footer must carry socials
**Surface:** mypiggles › My Site › Site identity → the published site's footer
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** the marks drawn in her published footer, on the site itself

## What happened

Juniper Row's footer had no social links, which RULE #8 requires, so Devi went
and added them. **Site identity** has a section for exactly this, and it makes a
promise twice:

> **Social links**
> Shown in this site's footer. Each site keeps its own set.
>
> _No links yet. Add one and it appears in your footer._

She added two — Instagram `https://instagram.com/juniperrow` and Pinterest
`https://pinterest.com/juniperrow` — pressed **Save**, and got _Saved just now_.

Her footer is unchanged. No Instagram, no Pinterest, nothing where they would go.

The save was not the problem. `properties.settings` now holds exactly what she
typed:

```json
"socials": [
  { "url": "https://instagram.com/juniperrow", "platform": "instagram" },
  { "url": "https://pinterest.com/juniperrow", "platform": "pinterest" }
]
```

## What should have happened

The links appear in the footer. That is not an inference — it is what the screen
says will happen, in two separate sentences, one of which is the empty state
whose whole job is to tell her what adding one will do.

## How to reproduce

Every time, on any site.

1. **My Site › Site identity**, scroll to **Social links**.
2. **Add link**, choose a platform, paste a URL. Save.
3. Open the published site and look at the footer. Nothing is there.
4. The value is in `properties.settings.socials`, so nothing was lost — it is
   simply never drawn.

## Why it matters

**A screen that promises an outcome and does not produce it is worse than one
that never offered.** She has no way to tell whether she typed the URL wrong,
whether it needs publishing, or whether the feature is broken — so the reasonable
next move is to try all three and then give up on it.

**It is the shape this project keeps finding** —
[[feedback_fetched_but_never_rendered]]. The value is already in the page's hand:
[silica-data.ts:571](../../../../wizeworks/apps/site/lib/silica-data.ts) puts it
on the resolver root under `site.social` on **every** render, and the comment
above `buildSilicaHost` says it does so "always, since the frame binds `site.*`
regardless of what the tree walk detects". The data is fetched, filtered for
empty URLs, and handed over. Nothing asks for it.

**For this business it is not decoration.** Devi is leaving a marketplace that
owned her customer list, and Instagram is where a small-batch clothing maker's
audience actually is. The footer is the one place on every page that could hand a
visitor a way to follow her instead of buying once and vanishing.

## Where it lives

**The frame's footer has no node bound to `site.social`.** Her stored footer
carries the slot and it is empty:

```json
{ "tag": "ul", "class": "mt-2 flex items-center gap-5", "children": [] }
```

It is empty on purpose, and the reason is sound —
[site-chrome.ts](../../../../wizeworks/packages/silica-catalog/src/site-chrome.ts),
`siteFooter`:

```ts
// Socials are a tenant setting, not something a starter can invent. Emptied
// rather than left as the block's X/GitHub/LinkedIn placeholders, which would
// publish three dead `#` links on day one.
social1: null,
social2: null,
social3: null,
```

Emptying the placeholders was right. What is missing is the other half: nothing
was put in their place that can fill itself later. The footer's legal column
already solves this exact problem one slot down, and says why:

```ts
// The third column is where legal lives — a host core, so it is the tenant's
// real published set or nothing at all.
link9: hostCore(HOST_KEYS.siteLegalLinks),
```

Socials are the same kind of thing as legal links and as `site.account-link`
([291](291-her-shops-header-said-sign-in-while-she-was-signed-in.md)): a tenant
setting that changes **after** the tree is published, so a static tree gets it
wrong in both directions — three dead links on day one, or an empty slot forever
after she fills it in.

## The fix

A **host core**, `site.social-links`, for the reason the file already gives about
legal links and about the account link: a tenant setting that changes after
publish cannot be a stamped node.

**1. The core.** `HOST_KEYS.siteSocialLinks` +
[host-nodes.ts](../../../../wizeworks/packages/silica-catalog/src/host-nodes.ts)
registry entry. Unpinned, like the legal links — a business that does not use
social media must be able to delete the row rather than carry an empty strip.

**2. The renderer.**
[silica-host-cores.tsx](../../../../wizeworks/apps/site/components/silica-host-cores.tsx)
mounts `<SocialLinks items={ctx.site.socials} />`. **Nothing new was written to
draw them:** `SocialLinks` already exists in `@wizeworks/builder-render` — marks
for Instagram, Facebook, X, TikTok, YouTube, LinkedIn, Pinterest and Threads in
`currentColor` inside real silica `btn btn-ghost btn-circle` classes, an alias
table, a text fallback for an unknown platform, and it renders nothing when the
list is empty. It was built for the legacy builder's `SocialLinks` leaf and the
silica frame simply never reached for it. `ctx.site.socials` is already on
`ResolvedSite`, so nothing had to be threaded either.

**3. The seed.** `siteFooter` puts the core in the `social1` slot instead of
`null`. It costs a brand-new site nothing — the core renders nothing until she
lists an account — which is what makes it safe to ship in every footer up front.

**4. The repair for sites already published.**
[upgrade-frame.ts](../../../../wizeworks/packages/silica-catalog/src/upgrade-frame.ts)
gains a fourth rule: put the core in the empty `<ul>` the seed left beside the
brand mark. It clears that file's stated bar — "a heal earns its place only when
the stale shape is already BROKEN on published sites" — because seeding the core
fixes the next tenant and leaves every existing one exactly as broken. It takes
the empty row's POSITION so the marks land where the footer already reserved
space, and **declines entirely** when the author deleted the row rather than
guessing a new home.

**5. The owner-facing report.** `live-chrome-gap.ts` gains a line, so a frame
missing the core says what it costs her in her terms rather than naming a node.

Six tests in
[upgrade-frame.test.ts](../../../../wizeworks/packages/silica-catalog/src/upgrade-frame.test.ts),
and the fixture is **Juniper Row's actual footer read off `builder_layouts`** —
`div > [header, main, footer]`, brand core + blurb + empty `<ul>` — rather than a
shape the code would find convenient. That distinction is what issue 296 cost a
whole repair, and the test file already carries the comment saying so.

## Confirmed by

**Partly, and the rest is stated rather than assumed (CLAUDE.md RULE #4).**

**What is confirmed, against the real system.** Running `upgradeFrameChrome` on
Devi's actual stored frame produces `site.social-links` in it. Her draft row now
carries the core and her published row does not —

```
draft: true | published: false
```

— which is not a shortfall but the documented safety property of this file: the
heal runs on the DRAFT at studio load and never on the published tree, "so
nothing changes for visitors until the tenant publishes themselves". Her two
links are in `properties.settings.socials`, and `ResolvedSite.socials` is the
list the core reads.

**And the footer on screen, which is what actually closes this.** Reaching it
needed the editor, and the button that opens the editor was itself broken — see
[327](327-ten-buttons-in-the-console-did-nothing-at-all-and-said-nothing-either.md),
which was found while trying to publish this fix. With that repaired, **Design the
header & footer** opens the layout pane, the Publish pane says in her words that

> The social accounts you listed in Site identity are not shown anywhere on your site.

and **Publish everything** puts it live. Her footer now draws the Instagram and
Pinterest marks under her address, as real links:

```
https://instagram.com/juniperrow   btn btn-ghost btn-sm btn-circle   aria-label="instagram"
https://pinterest.com/juniperrow   btn btn-ghost btn-sm btn-circle   aria-label="pinterest"
```

The warning disappeared from the Publish pane in the same step, which is
`liveChromeGaps` reporting from what is LIVE rather than from a stored flag.

## Rating effect

To be recorded against `My Site › Site identity` — the pane took the input
correctly and saved it, and now keeps the promise it made about it.
