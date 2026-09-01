# 364 — The set-up screen offered to rebuild a business that was already running

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · walking `workbench.onboarding.story` for the first time
**Surface:** mypiggles › Get set up › Describe your business, and › Set up step by step
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** both screens, opened as Devi, on an account with 22 pages and a year of orders

## What happened

Devi opens **Describe your business**. The screen has already decided what she does:

> **So, what's your story?**
> Tell it the way you'd tell a friend … **Start from one of these**, or begin with a
> blank page.
>
> [**A salon**] [A local grocer] [A consultancy] [A fitness studio] [A distributor]
>
> I **want to start** ✂ **a salon** for **people**, where they can **book
> appointments** and **order online**. I'll **share what I know on a blog**. I'll also
> **remember every customer**.
>
> Find me at `juniper-row`.piggles.site.

"A salon" is already chosen. The one button on the screen says **Build my salon**.
Devi runs a small-batch womenswear label.

The step-by-step screen next door is the same fiction in switches. It showed her:

| app                        | the screen said | her account says |
| -------------------------- | --------------- | ---------------- |
| Messages                   | off             | **on**           |
| Trade customers            | off             | **on**           |
| Connections                | off             | **on**           |
| Dropshipping               | off             | **on**           |
| Invoices, Stock, Live chat | off             | **on**           |

Seven apps she uses, drawn as switched off. **Trade customers** is what her entire
"Juniper Row Trade" site exists for.

And the buttons are not previews. `Build my salon` and `Continue` both start with
`saveModules(resolveModules(story))`, and `resolveModules` sets **false** for every
app the story does not mention:

```ts
const on: Record<string, boolean> = {};
for (const m of SWITCHBOARD_MODULES) on[m.key] = false; // ← everything, first
```

`PUT /v1/tenant/modules` merges that map, so one press turns off **email, b2b, ai,
dropship, invoicing, inventory and chat**. The story flow then installs a salon
blueprint with example data into her primary site — which, per [363], **replaces
every page on it** — and renames the business and the site after that.

One click, from a screen reachable in the menu, and her business is a salon.

## Why it happened

There is no first-run gate in this console. The catalog comment describes one
("At FIRST RUN onboarding is a full-viewport gate … components/workbench-shell +
surfaces/onboarding/onboarding-gate"), but neither file exists here. The only
reference to either flow anywhere in the app is the surface catalog:

```
lib/surfaces/catalog/onboarding.ts
surfaces/onboarding/onboarding-surfaces.tsx
```

So **every person who has ever opened either screen already had an account**, and
most already had a business. Both were written for the other case and neither reads a
single fact about the business it is pointed at: the seed is `starterStory(slug)`,
which is `STORY_EXAMPLES[0]` — the salon — for everybody.

`isOnboardingFinished` existed for exactly this and was called **nowhere**. It would
not have caught Devi anyway: she has no `settings.onboarding` at all, because she was
seeded, and a business furnished at signup or imported is in the same state. The
progress endpoint already knows this shape and says so about a sibling bug:

> a tenant furnished through `/internal/tenant/furnish` … had a blueprint installed
> and a flag still reading false. The checklist then asked them to choose a template
> they had already chosen, **with a CTA that would install a second one over the top.**

The checklist was fixed. The flow the checklist links away from was not.

## What should have happened

Setup should not run over a business that exists. Not behind a warning either: every
outcome setup produces is already reachable without breaking anything, so offering
setup again is offering a strictly worse route and asking her to accept the risk of
taking it.

## The fix

**`isBusinessRunning(state, pageCount)`** in `lib/onboarding/entry.ts`, and
`<SetupGate>` around both flows.

Two signals, and the order matters:

1. `finishedAt` stamped → setup is over.
2. otherwise, if setup has been **engaged** — a step advanced, a phrase composed, a
   design installed, any step flagged — she is part-way through and still gets the
   flow. This has to win over the page count, because the design step installs pages:
   without it, anybody mid-setup would be locked out of finishing their own.
3. otherwise, pages that actually exist → this business was built some other way.

`currentStep` counts only once it has **moved**. api-rest defaults the field to the
first step for every tenant, so a business with no stored setup still reads
`currentStep: 'modules'` — truthy, and meaning nothing. My first version treated the
bare field as progress, which made the predicate always true and the gate a no-op;
`resolveOnboardingFlow` above it already drew the same distinction for the same
reason. Eight cases, run against the real predicate:

```
running=false started=false  a brand-new business, nothing done
running=false started=true   part-way: apps saved, design not chosen
running=false started=true   part-way: a design installed, so it HAS pages
running=false started=true   part-way: a story composed, nothing built yet
running=true  started=true   finished setup in this console
running=true  started=true   finished, and somehow has no pages
running=true  started=false  seeded/imported: no setup record, real pages
running=false started=false  no state at all (read failed)
```

Neither read landing is not a reason to block: a business that cannot be measured is
treated as one that still needs setup, which is the state the flows were built for.

**What she sees instead** (`surfaces/onboarding/setup-gate.tsx`), on the welcome
checklist's skeleton, because it is the same kind of screen:

> **Juniper Row is already set up**
>
> This screen builds a business from nothing, and yours is already running. Going
> through it again would switch your apps back to a starting set and lay a ready-made
> site over the one you have, so it stops here instead.
>
> Everything it would have asked you has its own screen now, and each of those
> changes one thing at a time.
>
> **Get set up** — what is still worth doing, worked out from your own pages, orders
> and settings rather than from a checklist you ticked once. → Open
> **Ready-made sites** — a whole site somebody else designed, ready to start from. → Open
> **Business details** — what your business is called and the web address people
> reach it at. → Open
>
> To add an app or put one away, open All apps, at the bottom of the menu down the
> side. Every app is included, so adding one never changes what you pay.

A row is dropped when this brand does not have that screen — `surfaceTitle` returns
null for a hidden key, and that is its whole contract. Apps get a sentence rather than
a button because this console has no modules settings page on purpose: it prices one
flat plan and puts apps behind the rail's own door.

## Still open

- **The rated gaps on `workbench.onboarding` remain** for the businesses that still
  see it: nothing says what happens if an app is switched on later, and the summary
  card fills in "Your starting point" before that step is reached.
- **No test renders either surface.** [361] shipped a hard crash on both; this shipped
  a destructive button on both. The predicate is pure and was exercised directly, but
  the surfaces are not covered. FOLLOW_UPS #8.
