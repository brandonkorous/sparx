# Ad creatives

Social/marketing ad images for sparx, kept in-repo so they're version-controlled
and reproducible. All are **1:1 (1092×1092)** — the shape Facebook, Instagram and
LinkedIn all accept.

Every creative uses only the real brand tokens (`@sparx/brand`): ink navy
`#0c1433`, ember `#e04631`, paper white — plus the real wordmark and mascot
geometry from [`packages/brand/src/marks.ts`](../packages/brand/src/marks.ts). No
invented colors, no gradients, no drop-shadow-as-device.

## Creatives

| File                                 | Style                                                                                                                                                                     | Notes                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `sparx-ad-one-window-mascot-1x1.png` | **Type-led** (monday.com-style). Ink-navy field, headline with the key line in ember, real wordmark, ember "Get started" pill, **sparky mascot poking in** from the edge. | The current lead creative.                                                                                                |
| `sparx-ad-floating-panels-1x1.png`   | **Product showcase.** Light/airy field, two real product windows (calendar + Deals) floating and overlapping, annotation callout cards, ember accent blobs.               | The Deals panel is captured at the old large window size, so its text is soft — recapture at a smaller window to sharpen. |
| `sparx-ad-browser-window-1x1.png`    | **Single hero window.** The workbench in a browser frame (`app.sparx.works`), full calendar with real bookings.                                                           | The plain, legible "what it actually looks like" shot.                                                                    |

## Per-module set (`modules/<ratio>/sparx-ad-module-<slug>-<ratio>.png`)

Thirteen type-led creatives — one per activatable module (the `ALL_MODULES` set in
[`packages/modules/src/index.ts`](../packages/modules/src/index.ts)) — built on the
lead creative's template but **without the mascot**, so the headline carries the
whole frame:

`builder · commerce · cms · crm · email · b2b · invoicing · dropship · inventory ·
chat · ai · scheduling · social`

Each module is rendered in **five aspect ratios**, one folder each — 65 files total.
Every ratio gets a _tuned_ layout (type scales up in the tall formats; the story
format keeps the headline + CTA inside the platform UI safe zones), never a stretch:

| Folder           | Size      | Placement                                       |
| ---------------- | --------- | ----------------------------------------------- |
| `modules/1x1`    | 1080×1080 | Square feed post (IG / FB / LinkedIn)           |
| `modules/4x5`    | 1080×1350 | Portrait feed — the best-performing feed format |
| `modules/9x16`   | 1080×1920 | Stories / Reels / TikTok (UI-safe top + bottom) |
| `modules/16x9`   | 1920×1080 | YouTube, X, display, website hero               |
| `modules/1.91x1` | 1200×628  | FB / LinkedIn **link** ads                      |

Each ad wears **its own module hue** (`--color-module-<slug>`) on the accent
headline line and the CTA pill — the same color that module wears in the sidebar,
its marketing page, and its cards — so the thirteen read as one system. The wordmark
"x" stays Ember on every one (it is the master brand mark, not a module hue). Copy is
a benefit-first rewrite per module for a non-technical owner, not a noun-swap.

**On-navy legibility:** the module tokens are _solid-fill_ hues, so the darker ones
(builder, b2b, chat, invoicing, social) fall below readable contrast on the ink-navy
field. `accentOnNavy()` in the generator lifts each hue toward white — same hue
family — until its relative luminance clears a comfortable margin, then paints both
the accent and the pill with that tint (pill ink stays navy, like the master's ember
pill). Bright hues pass through untouched. b2b's slate stays deliberately quiet —
that muted, professional character is the module's real identity.

## Reproducing

`src/gen-one-window-mascot.mjs` builds the type-led _lead_ creative's HTML from the
brand geometry. Regenerate it by running the generator, serving the resulting
`ad-1x1.html` on `localhost`, and screenshotting the 1200×1200 `.card` (headless
Chrome would not cooperate on Windows during authoring, so these were captured from
a browser at 1092px).

The **per-module set** is fully scripted (run from the `ads/` dir):

```
node src/gen-module-set.mjs   # writes module-set.html — 13 modules × 5 ratios, data-driven
node src/capture.mjs          # Playwright screenshots each card → modules/<ratio>/*.png
```

`gen-module-set.mjs` owns the copy + hue table and the `RATIOS` layout table; each
card carries its own output path in a `data-out` attribute. `capture.mjs` reads that
attribute, creates the ratio folder, and screenshots the card — so naming, foldering,
and the module/ratio lists all live in one place and never drift. `module-set.html`
is a transient build artifact — not committed. Add or drop a ratio by editing the
`RATIOS` array; add a module by editing `MODULES`.

## Truthfulness

None of these claim a customer count or name a company. If we get a real, defensible
number (active tenants, sites published, bookings taken), the type-led creative has
the exact slot for it — swap it into the ember accent line.
