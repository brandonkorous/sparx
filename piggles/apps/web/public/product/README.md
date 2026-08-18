# Product screenshots

Photographs of the real Piggles workspace, shown in the hero carousel on the
fifteen app pages and (later) in the documentation pages.

**Nothing here is decided at the call site.** The registry
[content/shots.ts](../../content/shots.ts) is the single source of truth: it
lists which surfaces exist per app, carries their label/alt/caption, and
`shotSrc()` is the ONLY place a path is constructed. A page asks the registry
what exists; it never spells a filename.

## The workspace: Wildroot Flowers, and it is not a choice

The home page's film runs a Thursday through a window titled "Wildroot Flowers",
and `/how-it-works` types the same name into the depicted signup. A visitor who
watches that and then clicks into Stock has to land in the same shop — a capture
from any other tenant introduces a second, unexplained business halfway down the
funnel.

It is a real tenant, seeded through the real provisioning path (modules →
activation → the `florist` industry starter → the `florist` sample pack):

```
pnpm --filter @wizeworks/api-rest seed:demo --only wildroot-flowers
```

Ten products, twelve stock lines across a shop cooler and a dry store, seven
bookings, six deals, three articles, two trade accounts. Spec: `wildroot-flowers`
in [demo-tenants.ts](../../../../../wizeworks/services/api-rest/src/lib/demo-tenants.ts),
carrying `platformBrand: 'piggles'` — which is what puts it in the Piggles
console rather than sparx's.

The tenant has its own owner and no other account is a member of it:

```
owner@wildroot-flowers.demo.sparx.test / demo-password-2026
```

> **Local prerequisite.** `piggles/apps/account/.env` and
> `piggles/apps/workbench/.env` must carry the SAME `BETTER_AUTH_SECRET`. On
> localhost both apps share one cookie jar (cookies ignore port), so a mismatch
> makes `/auth/callback` overwrite the account app's session with one it cannot
> verify — the `/handoff` 303 → 307 → `/sign-in` loop. Invisible in production,
> where the two are separate registrable domains.

## Capture spec

**Canvas and resolution are independent.** Canvas decides LAYOUT — how wide the
table runs, how much desk the dock has. `deviceScaleFactor` decides SHARPNESS.
Choose the canvas for what the picture should show, never to control file size:
a large canvas producing a small displayed image is the goal, because the hero
renders it at ~600px and the lightbox serves all of it.

|         | Canvas     | Scale | File        | Shape |
| ------- | ---------- | ----- | ----------- | ----- |
| Desktop | 1440 × 900 | 2×    | 2880 × 1800 | 16:10 |
| Mobile  | 396 × 836  | 3×    | 1188 × 2508 | 9:19  |

These live in `SHOT_SIZE` in [content/shots.ts](../../content/shots.ts), and both
the script and the page read them from there — the script divides by its scale
factor to get a canvas, the page declares them on its `<Image>`.

1440 keeps the dock comfortable for two windows while staying a screen a small
business actually has. Do NOT capture at an ultrawide: the first Stock shot was
taken at 2558px and the empty gap down the Item column is the console stretched
across a monitor no florist owns.

**Mobile is 9:19 because the FRAME is, not because a phone is.** silica's
`.mockup-phone-display` is `aspect-ratio: 9 / 19` with `overflow: hidden` — a
fixed box, 240 × 507 as rendered. Captured at a real handset's shape (iPhone 14
is 390 × 844, or 9:19.5) the picture is proportionally taller than that box and
cannot sit flush in it, which shows on the page as a band of dead frame under the
screen. The frame belongs to the design system and does not move; resizing it to
fit a screenshot would be the tail wagging the dog, so the picture matches the
frame. If a mobile shot ever looks short again, measure `.mockup-phone-display`
first.

Other rules:

1. **Real data or no shot.** An empty list photographed honestly is still a
   picture of nothing. `AppFigure` falls back to the six `does[]` titles when an
   app has no registry entry, and that is a finished state — not a placeholder.
2. **Show the dock.** Two or three windows with their tabs, arranged like a real
   Thursday. Keeping things open together is the product's central claim; a tidy
   capture of one isolated pane throws that argument away. Crop to a single
   surface only when the page is about that surface specifically.
3. **Vary what is open per app.** Fifteen captures inheriting the same tabs makes
   fifteen near-identical pictures. Bookings wants the workshop open; Invoices
   wants an order and a customer alongside it.
4. **Light theme.** The marketing site is light by default and the figure sits in
   a `base-100` panel. A dark capture reads as a different product.
5. **No real personal data.** Everything in Wildroot is invented sample data on
   `@sample.example`. Never photograph a tenant with real customers in it.

## Naming

```
public/product/<app>/<surface>-<viewport>-<theme>.png
public/product/stock/levels-desktop-light.png
public/product/stock/counts-mobile-dark.png
```

A **directory per app** — fifteen apps at eight files each is 120 images and a
flat folder of that is unusable. `<surface>` is a NAME, not a number:
`stock-1.png` tells a docs author nothing, and the point of the registry is that
a docs page can ask for `counts` and get it. Theme and viewport live in the
filename so one surface's four files sort together.

**Never replace an image in place.** Next serves optimised images with a long
`max-age`, so overwriting a path keeps rendering the old picture — in the
browser, and on a live site in the CDN and in every returning visitor's cache,
with nothing to invalidate it. Re-shooting means a new `surface` slug (or a dated
suffix) and an edit in the registry. [../photos/README.md](../photos/README.md)
records the same rule after it bit twice.

## How they are rendered

[hero/shot.tsx](../../components/marketing/hero/shot.tsx), and every choice in it
was argued:

- **Slides are SURFACES, not renderings.** Stock is stock levels, a count in
  progress, batches with dates. Three screens is worth flipping through; the same
  table in four skins is not. How many slides varies by app.
- **Theme is SERVED, not slid.** Both files ship and CSS picks
  (`.shot-light`/`.shot-dark` in globals.css). A theme is a preference the page
  already knows; making somebody click to the dark version of a screen they are
  already viewing in dark mode is the site asking them to do its job.
- **The phone IS a slide**, because it is a claim rather than a preference —
  `/who-its-for` says a market stall needs "everything to work on a phone,
  standing up, with one hand."
- **Frames:** `MockupBrowser` on desktop (the capture already has the console's
  chrome, so the frame only adds the address bar), `MockupPhone` on mobile (a
  bare screen, so the frame is doing real work).
- **The zoom badge is always visible.** `cursor-zoom-in` is invisible until hover
  and absent entirely on touch — exactly where the image is smallest.
- **No autoplay**, and carousel controls only when there is more than one slide.

## Taking them

[capture-shots.mjs](../../scripts/capture-shots.mjs), driven by the registry — the
file that renders the heroes is the file that shoots them, so there is no second
list to fall out of step with.

```
npm i -g playwright                                 # once. Global, see below.
node scripts/capture-shots.mjs sign-in              # once. A person types the password.
node scripts/capture-shots.mjs                      # everything the plan knows
node scripts/capture-shots.mjs stock                # one app
node scripts/capture-shots.mjs stock:levels         # one surface
node scripts/capture-shots.mjs stock --out ../tmp   # somewhere to look before committing
```

The Piggles dev stack has to be up; the script checks first and says so, rather
than timing out on a selector five minutes later. `PIGGLES_CONSOLE_ORIGIN` aims
it somewhere other than `localhost:3022`.

**Playwright is global, not a dependency.** In `package.json` it would put a
~400MB browser download into every install and every CI run to serve a script
that runs no part of a build.

**The session is saved, never typed.** `sign-in` opens a window and waits; the
password goes in by hand. The result lands in `scripts/piggles-auth.json`, which
the root `.gitignore`'s `*-auth.json` already covers — it is a live session token
and must never be committed.

**Arrangements are composed through the launcher, not a URL.** A workbench address
names ONE destination, and the multi-pane form it used to accept is legacy the app
is retiring: `decodeDescriptor` survives to read old links and its encoder was
deleted on purpose, so writing one here would drag the format back. Instead the
script does what a person does — ⌘K, pick the screen, and the modifier says where
it lands (`↵` a tab, `⇧↵` alongside, `⌥↵` its own window). Tabs, splits and
floating windows all fall out of that one contract, and the script can only ever
build an arrangement somebody could build by hand.

Two rules above are now enforced rather than remembered. Every entry in
[shot-plan.mjs](../../scripts/shot-plan.mjs) names a `ready` string that appears
only once real Wildroot rows have rendered — "real data or no shot", checked. And
the runner **refuses to overwrite** an existing file; `--force` is for a surface
that has never shipped.

Mobile captures skip composition. A phone runs the stack host, which has no split
and no windows, so one surface is the honest picture of what a phone shows.

## Still to do

- Stock has `levels` only, and desktop only. `counts`, `batches` and `locations`
  are planned and unshot; every surface still needs its mobile pair.
- The other fourteen apps — none are in the plan yet.
- `wildroot-flowers` in [demo-tenants.ts](../../../../../wizeworks/services/api-rest/src/lib/demo-tenants.ts)
  carries eight modules under a comment saying it carries every one, and
  `inventory` is not among them. Whether Stock photographs full or empty turns on
  that.
