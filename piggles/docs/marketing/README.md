# Piggles marketing — the article programme

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-29

The plan for turning meetpiggles.com from a site that says what Piggles has into
one that explains what Piggles does.

- [FEATURES.md](FEATURES.md) — every capability, with a stable id. The denominator.
- [ARTICLES.md](ARTICLES.md) — every page to be built, what goes in it, and the
  screenshots it needs. The plan, and the progress.

This file is the standard both are held to. Read it before writing a page.

## The problem, measured

The fifteen app pages carry **8,744 words between them** — about 580 per app.
Stock fronts roughly 85 screens in 1,301 words. Invoices gets 131.

That is enough to tell somebody an app exists. It is not enough for anybody to
decide anything. Forty-three capabilities are not mentioned at all: a visitor
searching for batch and expiry tracking, bills of materials, supplier
scorecards, response-time policies or two-factor login finds nothing on this
site that says we have them — and we have all of them.

**The failure mode has a name and it is the one to avoid: "we have inventory."**
A page that lists nouns is a page that asks the reader to take a leap of faith.
A page that shows the reorder screen, names the number on it, and explains where
that number came from is a page that answers a question.

## What an article is

One page, at `/apps/<app>/<topic>`, about one coherent capability.

**Length.** 1,200–2,500 words. Below 1,200 the topic was too thin to be its own
page and belongs inside a neighbour. Above 2,500 there are two articles in there.

**Shape.** Not a rigid template — a page that reads as a filled-in form is its
own failure — but every article answers these, in roughly this order:

1. **What this is for.** The job, in the reader's words, before any noun of ours.
2. **The thing itself.** How it actually works, with a real screen alongside.
3. **The parts.** What it is made of, named the way the console names them.
4. **The awkward case.** The situation that makes this hard in real life, and what
   the software does about it. This is the section that separates an article from
   a brochure — every capability has one, and a page without it is not finished.
5. **What it connects to.** The other apps it touches, as real links.
6. **What it does not do.** Stated plainly. A page that claims no limits is not
   believed, and the reader finds the limit later anyway, in a worse mood.

**Voice.** [piggles/CLAUDE.md](../../CLAUDE.md) RULE #3. Playful, never childish;
plain and calm around money, tax and deletion. No acronym a reader has to learn.

**The jargon, once.** Each article may name the industry term for its subject
once, in the `alsoKnownAs` position — the one sanctioned place a technical word
appears, and the reason the satellite domains can rank at all. It does not leak
into the body. This is the rule `content/apps/types.ts` already states; articles
inherit it.

**Accuracy is the hard rule.** Every sentence describes something the platform
implements today. Not planned, not behind a flag. When in doubt, open the
surface named in FEATURES.md and look. A capability we oversell here becomes a
support ticket with our own page attached to it.

## Screenshots

Real captures of the real console, taken with the existing rig — not mockups,
not illustrations.

**The rig already exists and articles use it unchanged:**

- `apps/web/content/shots.ts` — the registry. The only place an image path is
  spelled. A page asks for a surface by name.
- `apps/web/scripts/shot-plan.mjs` — how to get the console into that state.
- `apps/web/scripts/capture-shots.mjs` — the Playwright runner.
- `apps/web/public/product/<app>/<surface>-<viewport>-<theme>.png`

Full contract in [public/product/README.md](../../apps/web/public/product/README.md).
The rules that bite:

- **Real data or no shot.** Every plan entry names a `ready` string that only
  appears once real Wildroot Flowers rows have rendered. An empty list
  photographed honestly is still a picture of nothing.
- **One workspace, throughout.** Wildroot Flowers, seeded through the real
  provisioning path. A capture from a second tenant introduces a second,
  unexplained business halfway down the funnel.
- **Never replace an image in place.** Next serves optimised images with a long
  `max-age`. Re-shooting means a new surface slug and a registry edit.
- **Both themes, both viewports.** The page serves the one matching the reader.
- **Show the dock where the claim is about the dock**; crop to one surface where
  the article is about that surface. An article about picking wants the picking
  screen, not three windows of ambience.

**Per article: 3–6 shots.** Fewer than three and the page is prose with a
decoration on it. More than six and nobody looks at any of them.

**Every shot carries `alt` and `caption`, and they do different jobs.** `alt`
inventories what is in the frame for somebody who cannot see it. `caption` says
whose workspace this is and what to notice. Writing one from the other is the
failure `public/photos/README.md` was written after.

### Capturing

```
npm i -g playwright                              # once, global — not a dependency
node scripts/capture-shots.mjs sign-in           # once, a person types the password
node scripts/capture-shots.mjs stock             # one app
node scripts/capture-shots.mjs stock:levels      # one surface
node scripts/capture-shots.mjs stock --out ../tmp  # look before committing
```

The Piggles dev stack must be up. Arrangements are composed through the launcher
the way a person composes one, never through a multi-pane URL — that format is
being retired and writing one here would drag it back.

**The session file `scripts/piggles-auth.json` is a live token and is never
committed.** The root `.gitignore` covers `*-auth.json`.

## Where articles live

`/apps/<app>/<topic>`.

Nested under the app hub, not in a separate `/docs` tree, for three reasons:

1. **The satellite domains already point at `/apps/<app>`.** pigglescms.com
   exists to catch somebody searching "CMS" and land them on Content. Articles
   nested under that page cluster to it instead of competing with it.
2. **The group hue is already resolved there.** `/apps/[app]/page.tsx` sets
   `data-group`, so an article inherits the colour its app wears in the rail —
   the same colour the reader will see after they sign up.
3. **A separate docs tree reads as documentation for existing customers.** These
   pages are for somebody deciding, and they belong in the part of the site that
   is doing the deciding.

The app page becomes a **hub**: what it does at a glance, then an index of its
articles. `does[]` and `chapters[]` stay — they are the glance — and each chapter
gains links to the articles that go deeper.

Console-wide subjects that belong to no app get `/platform/<topic>`, with a hub
at `/platform`.

## The completeness gate

This is the whole point of the exercise, and it is mechanical:

1. **Every feature id in FEATURES.md is owned by exactly one article.** Zero
   orphans, zero double-owned. An id owned by nothing is a capability nobody can
   read about.
2. **An article is `[x]` only when all of these are true.** Built to production
   quality, not "wired but untested":
   - the prose is written, in voice, within 1,200–2,500 words
   - it has its awkward-case section
   - it has 3–6 real captures, in the registry, both themes, both viewports
   - every `alt` and `caption` written by a person who looked at the image
   - the claims were checked against the surfaces named in FEATURES.md
   - it links to its neighbours and they link back
   - it renders correctly at 390px
3. **FEATURES.md is updated in the same change.** The article's owned ids move to
   `article`. A page that ships without moving its rows leaves the tracker
   lying, which is worse than not having one.

`scripts/check-feature-coverage.mjs` (to build, task 0.3) enforces 1 and the
mechanical half of 2, and fails the push. A tracker nobody verifies drifts, and
this one is the only thing standing between us and shipping "we have inventory"
in longer form.
