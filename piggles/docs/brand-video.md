# Piggles brand video

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-23

Where the Piggles social video work stands, how it got there, and what has to
happen next. Written to be picked up cold.

## Where the work lives, and the risk that carries

Everything is in **`videos/piggles-logo-reveal/`** at the repo root. It sits
outside `piggles/` on purpose: it is a marketing asset, not product code, so it
is bound by neither the two-app boundary nor `piggles/` RULE #0.5, and no app
imports it.

**`videos/` is gitignored** (repo-root `.gitignore`, added 2026-08-23) because
the renders are megabytes each and multiply with every ratio. That decision was
made deliberately, and it has a consequence worth stating plainly: **the
generators are not in version control either.** Roughly 900 lines of real work
(`lib/lockup.mjs`, `build-compositions.mjs`, `build-hook.mjs`, the render
scripts, the project README) would be lost to a `git clean -xdf` or a fresh
clone. The renders genuinely are disposable; the source is not.

Two ways to close that, both open:

1. Narrow the ignore to `videos/*/renders/`, `videos/*/snapshots/` and
   `videos/*/assets/`, which keeps ~20KB of source in git.
2. Leave as is and treat this document as the recovery plan.

## What exists today

Two pieces, sharing one animated lockup.

| Piece      | Length | What it is                                                             |
| ---------- | ------ | ---------------------------------------------------------------------- |
| The closer | 5.5s   | The lockup alone. Ends a video, or stands as a post.                   |
| The hook   | 22s    | A story-led scroll-stopper with sound. Ends by playing the closer.     |

Sixteen rendered files, four aspect ratios each:

- `renders/<ratio>/` holds the closer: an MP4 on the off-white plate plus a
  **transparent WebM** (VP9, `ALPHA_MODE=1` verified on all four). The
  transparent one is the useful one: drop it over the last 5.5s of any clip and
  the footage shows through behind the lockup.
- `renders/hook-named/<ratio>/` and `renders/hook-plain/<ratio>/` hold the hook,
  MP4 only. It plays on a full-bleed field, so an alpha channel would reveal
  nothing.

Ratios are `1x1-square`, `4x5-portrait`, `9x16-vertical`, `16x9-landscape`. Each
is composed for its own frame rather than letterboxed: the lockup grows with the
horizontal room, type scales with the frame, and the vertical cuts sit slightly
high so a platform's bottom UI never lands on the URL pill.

## Picking it up

Node, ffmpeg and ffprobe are the only prerequisites. The HyperFrames CLI runs
through `npx` at a version pinned in `package.json`.

```bash
cd videos/piggles-logo-reveal
npm run marks         # re-extract mark geometry from @piggles/brand
npm run build         # regenerate the closer
npm run build:hook    # regenerate the hook
npm run check         # lint, runtime, layout, motion, contrast
npm run render:all    # closer, every ratio, both backgrounds
npm run render:hook   # hook, both word lists, every ratio
```

Everything under `compositions/` and the root `index.html` is **generated**.
Edit the builders, never the HTML.

## How it got here

### The closer took three attempts, and the first two were wrong

**Attempt one** had the two openings in the P blinking. They are **nostrils**,
holes in the snout plate, not eyes, and a vertical squeeze on two holes reads
unmistakably as eyes closing. It misdescribed the logo.

**Attempt two** replaced the blink with a nostril flare on a double sniff. Still
wrong for the same underlying reason: the holes were being animated at all.

**Attempt three**, which shipped, makes the mark **rigid**. No path inside it
carries an id or a class, so no timeline can target the nostrils even by
accident. The gesture belongs to the whole head, which leans off the foot of the
P's stem and **shoves the wordmark out from behind itself**. The letters start
stacked behind the mark, hidden by a clip edge in the gap between the two inks,
and spill out left to right while the lockup recoils left. The dot over the "i"
lands last and bounces, because it is the only spot of brand color in the
wordmark.

The lesson generalized: the correction was not "animate the nostrils more
subtly", it was "remove the ability to animate them".

### The hook's first cut was a list, not a hook

The first version showed ten product names and struck them out. It was rejected,
correctly: the beats could be shuffled in any order without losing anything,
which is the tell that nothing is happening. It was a feature inventory wearing
motion.

The rebuild is a story whose beats do not move:

| # | Beat            | On screen                                        |
| - | --------------- | ------------------------------------------------ |
| 0 | The curtain     | a full field of brand pink                       |
| 1 | Recognition     | "Do you use any of these?" in dark ink on it     |
| 2 | The proof       | the ten, so the viewer counts their own          |
| 3 | The false fix   | "Tired of connecting the dots between them?"     |
| 4 | The grind       | Copy. Paste. Copy. Paste.                        |
|   |                 | "Ten logins. Ten bills. Ten renewal dates."      |
|   |                 | "And not one of them talks to the others."       |
| 5 | The turn        | "Cancel all ten." and the strikes rip through    |
| 6 | Resolution      | one price, one bill, then the brand closer       |

The argument is
[instead-of.tsx](../apps/web/components/marketing/instead-of.tsx)'s, put in
motion: cancel all ten, keep everything they did.

### Why frame zero is what it is

Short-form research is consistent on three points: the viewer decides inside
roughly 1.3 seconds, frame one has to be a pattern interrupt rather than a
wind-up, and one hook outperforms three stacked. So the frame opens on a full
pink field with the question already on it and no entrance animation. A fade is
a wind-up, and the wind-up is where the scroll happens. At 0.95s the pink lifts
like a curtain with the dark field already underneath it.

### Sound

Every beat is cued from a bundled SFX library vendored into `assets/sfx/`: an
opening hit, a tick per name as the list builds, typing under _Copy. Paste._, a
riser that peaks on the first strike, ten ticks under the rip, a whoosh as the
list falls, a bass impact under the price, a pop as the dot lands.

## Rules that are now load-bearing

Each of these was learned by shipping the fault first.

**No price but ours.** Not one competitor figure appears anywhere, matching
[what-you-pay-rows.ts](../apps/web/components/marketing/what-you-pay-rows.ts).
Their prices are not ours to publish and they change weekly. The argument rides
on the count, ten bills against one, which needs no invented number.

**The pink takes dark ink.** White measures 2.44:1 on it and fails
([DESIGN.md](../DESIGN.md) §2). This governs the URL pill and the question card
on the pink curtain.

**Geometry is never re-drawn.** Every path comes from
[marks.ts](../packages/brand/src/marks.ts) via `npm run marks`, including the
measured lockup offsets. Colors come from
[palette.css](../packages/brand/src/theme/palette.css), both themes.

**`LOCKUP_CSS` is not optional.** An `<svg>` defaults to `overflow: hidden`, and
the mark animates from outside its own viewBox: it drops in from `y:-300`, the
dot from `y:-340`. Without `overflow: visible` the entrance is sliced by a hard
line at the SVG's box edge, which reads as a crop **inside** the frame rather
than at the edge of it. The hook shipped that way once because it had its own
stylesheet and simply forgot the rule. The rule now lives in `lib/lockup.mjs` so
it travels with the markup.

**Sound is audited before it is cued.** Two audio faults got through, and both
were invisible to every check that does not measure the file. A riser cut from
the wrong end of its source came out silent (-91 dB), and a cue that omitted
`data-duration` was dropped from the mix in one position but not another. A
silent mp3 and a missing cue render exactly like correct ones: no warning, no
error, just a beat that never lands. `build-hook.mjs` now fails the build unless
every sound exists, exceeds 50ms, and peaks above -60 dB, and every cue carries
an explicit measured duration. The guard was proven to go red against a
synthesized silent file.

## Open decisions

**1. Named or plain.** Both variants are built and rendered.

| Variant      | The ten rows                                    | Trade                                                                                                            |
| ------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `hook-named` | the competitor names, as `instead-of.tsx` lists them | Instant recognition, and by a distance the more effective cut. But it stretches a naming exception granted for a web page onto a video. |
| `hook-plain` | the same ten as capabilities (`BILL_ROWS` labels) | Keeps the standing no-competitor-names rule intact. Lands slower, because "Selling online" is not a line on a bank statement. |

This is Brandon's call. Nothing is blocked either way.

**2. The gitignore scope**, per the top of this document.

## What is next

**Music bed and voiceover.** This is the biggest remaining lift and the only
thing genuinely blocked. Both come from the HeyGen catalog, which needs one
interactive sign-in:

```bash
heygen auth login --oauth
```

With a voiceover the on-screen cards can shorten and the whole piece tightens
toward roughly 15 seconds. The hook's copy already reads as spoken lines.

**A looping idle mark**, proposed and not built: the same mark, no wordmark
build, a slow four-second breathing lean with a sniff every other cycle. A sting
fires once and is spent. A creature that is quietly alive earns repeat placement,
which makes it the right piece for a marketing hero or the provisioning wait in
the account app.

**In-product placement.** The closer is a social asset first, but two moments
justify it, both places people already wait: provisioning after signup in
`apps/account`, and the go-live success moment in onboarding. Nothing repeated,
and nothing in the nav.
