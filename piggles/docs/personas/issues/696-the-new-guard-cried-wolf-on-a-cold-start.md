# 696 — The new guard cried wolf on a cold start

**Status:** open — upstream, an ask for silicaui
**Severity:** minor (dev-only), but see "Why it is worth a file"
**Found by:** P03 · Juniper Row · act 243, on the first loads after the 0.56.0 install
**Surface:** mypiggles console, dev only
**Filed:** 2026-09-19
**Confirmed by:** measured in the live page — sentinel present, page styled, error fired anyway
**Blocked on:** silicaui (not in this repo)

## What happened

silicaui 0.56.0 ships a new dev-only check, `lib/assert-plugin.ts`. It exists for
a good reason: forgetting the one `@plugin` line is completely silent, and the
page renders as unstyled text with a clean 200.

Right after the install it printed this on the console, five times:

> `[silicaui] The @wizeworks/silicaui CSS plugin is not loaded, so every Silica
class on this page resolves to nothing.`

The plugin was loaded. The page was fully styled the whole time.

## The measurement

Run in the live page while the error sat in the console:

```
--sui-plugin (the sentinel it reads)   "1"     present
.btn.btn-primary background            rgb(255, 111, 134)   Piggles pink
.btn.btn-primary radius                12px
rules mentioning .btn                  10
@plugin '@wizeworks/silicaui'          globals.css:156, imported by app/layout.tsx
```

Re-running the check's own logic a minute later passes. Nothing changed but time.

## Why

```ts
if (document.readyState === 'complete') report();
else window.addEventListener('load', report, { once: true });
```

`load` is the right signal when CSS is a `<link>` in the head of a built page. It
is not a guarantee in a Next dev server: on a **cold compile** the shell is served
before the route's CSS chunk is ready, and on a client-side navigation
`readyState` is already `complete`, so `report()` runs straight away against a
document whose new stylesheet has not been attached.

Reproduction is narrow and specific: **five times across the first cold compiles
after a dev restart; not once on a warm load, and not on the sparx console at
all.** Which is the worst shape for a false alarm — it fires exactly when a
developer has just changed something and is most willing to believe it.

## Why it is worth a file

The check's own header says it:

> "The read is DEFERRED to the `load` event when the document is still parsing.
> Reading `--sui-plugin` before the stylesheet has been applied would report a
> correctly-wired app as broken, **and a false alarm here is worse than silence —
> it would teach people to ignore the message that matters.**"

That is exactly what happened, in the same release that wrote it down. It is also
the lesson issue [685](685-the-plural-helper-stopped-at-the-noun.md) turned on:
a guard that cries wolf gets switched off, so its false-positive rate is part of
its design and not a detail.

## Ask for silicaui

Do not read the sentinel off a clock. Watch for it:

1. Poll a couple of animation frames, or observe `document.styleSheets` /
   `<link>` insertions, and only report once the document has been quiet for a
   frame or two with no sentinel.
2. Or let the check be explicitly opt-in past first paint, so a dev server that
   streams CSS from JavaScript cannot trip it.
3. Whatever the mechanism: **it must not be able to fire while the sentinel is
   about to arrive.** A check that is right eventually and wrong at the moment it
   speaks is worse than no check.

Nothing in this repo needs changing; `globals.css` is correct in both consoles.
