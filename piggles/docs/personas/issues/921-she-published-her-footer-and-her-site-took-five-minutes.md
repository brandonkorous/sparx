# 921 — She published her footer, and her site took five minutes to show it

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P03 · Juniper Row · act 325, re-proving [302](302-she-published-and-two-pages-of-her-own-shop-disagreed-about-it.md) on screen
**Surface:** mypiggles › My Site › Header & footer › Publish (also a single page, a layout made live, and Look & feel)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, her live cart and orders pages carrying a footer change 2 seconds after Publish, both directions
**Blocked on:** —

## What happened

Act 325 closed 302 on a journal post, which purged in 9 seconds, and said the
header and footer "ride the same worker and the same route". That part was read
in the code, not driven. So Devi drove it.

She changed one footer sentence, "in runs of six" to "in small runs of six",
saved, and pressed **Publish**. The pane said:

> Published. Your site shows it in a few seconds, a few minutes at most.

A visitor's cart and orders pages, loaded every second, showed the new sentence
**4 minutes 29 seconds** later. The cache had been filled at 11:07:12 and the
change appeared at 11:12:13: the five-minute cache running out, to the second.
Nothing purged it.

## What should have happened

The same as the journal post, and the same as the pane promised: a few seconds.

## How to reproduce (before the fix)

1. Load `/cart?tenant=juniper-row` twice as a visitor, so it is cached.
2. As Devi, open **Header & footer**, change a footer sentence, Save, Publish.
3. Reload the cart page every second. It changes when the cache expires, up to
   five minutes later. Every time.

## Why it matters

The pane says "a few seconds". She publishes, opens her site, sees the old
footer, and publishes again, or decides it did not work. The header and footer
are on every page, so every visitor sees the stale one. The same held for a
single page published from its own pane, a layout made the live one, and the
look her site wears.

## Where it lives

The purge worker, `cache-revalidation-worker`, subscribed to `builder.published`
and `builder.rolled_back` only. api-rest publishes those for the WHOLE-site
Publish. A single document published from its own pane goes through
`@wizeworks/builder`'s services, which publish their own topics
(`builder.layout.published`, `builder.page.published`, `builder.layout.activated`),
and `installBuilderPubSubBridge` puts them on the bus.

Measured on the running broker: `sparx.builder.layout.published` held 2
messages, the last at stream sequence 105308, my publish. The purge consumer's
filter listed 37 subjects, none of them those, and it sat at 105300.

Why nobody saw it: those names were not in the `EventType` union. The worker's
own test called them "four plausible ones nobody emitted", and the roadmap said
the same, so they were cut from the subscription list. They were on the broker
the whole time.

The look had a second hole: `themeService.publish` emitted nothing at all,
under a comment saying a theme publish changes no live site. It does, for a
site already wearing that look: the site reads the theme's published tokens.

## The fix

- `wizeworks/packages/events/src/types.ts`: the five builder topics are
  `EventType` members, with a new `builder.theme.published`.
- `wizeworks/packages/builder/src/events.ts`: `BuilderTopic` gains the theme
  topic, and a compile-time assertion fails the build if a topic is added there
  and not to `EventType`. Proven red by deleting one.
- `wizeworks/packages/builder/src/services/theme-service.ts`: `publish` emits
  `builder.theme.published` after the commit; the comment now says when a
  publish repaints a live site.
- `wizeworks/packages/cache-revalidation-worker/src/index.ts`: subscribes to
  page, layout, layout-activated and theme publishes. Not the email one.
- `terraform/envs/prod/main.tf`: the five topics, so `check:events` holds.
- Tests: the worker test "carries every publish that changes what a visitor
  sees" (red on the old list); `theme-publish-event.test.ts` (red on the old
  service); the old test that called the names fake is rewritten.

The worker widens its broker filter on boot (`consumers.update`), so no cursor
change. Seen in dev: the filter went from 37 subjects to 41 on reload.

## Proof

Her footer, as Devi, with the visitor's cache filled 12 seconds before each
publish so the cache running out cannot explain it:

| Publish                               | Visitor's cart and orders pages show it |
| ------------------------------------- | --------------------------------------- |
| Before the fix, sentence put back     | 4 min 29 s (cache expiry)               |
| After the fix, "in small runs of six" | **2 s**                                 |
| After the fix, put back               | **2 s**                                 |

Her footer is back to her own sentence. The look has no on-screen proof on her
site: she has not picked one, so publishing a look changes nothing she shows.
Its event is covered by the test, and it rides the bridge the footer just proved.

## Rating effect

Not scored. Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
