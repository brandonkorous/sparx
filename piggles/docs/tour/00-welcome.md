# Tier 1 — the welcome tour

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-17

The one tour that runs on its own. It is about the **shell** — the parts that are
the same whichever app you open — and it never mentions a feature. Ten steps,
about two minutes.

Content lives in [lib/tour/steps.ts](../../apps/workbench/lib/tour/steps.ts).
Written under the rules in [README.md](README.md) §4.

---

## When it runs

Offered, never started. It arrives on the status strip as a pink
**"New here? Show me around"** about a second after the console settles, and waits
to be taken up on it. Somebody who has just answered what their business does and
been dropped into a full console is keen to poke at it; a walk that begins on its
own is a walk they are trying to get past.

Declining is an answer and is recorded as one, so it never comes back —
which is exactly why **it has to be replayable from the account menu**, and today
is not (see [README.md](README.md) §8).

## New anchors this tour needs

Four, all in existing chrome. None of them exists yet.

| Anchor          | Element                                                    | File                                                                    |
| --------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `site-switcher` | the `/ 🌐 <site name> ⌄` dropdown beside the business name | [components/topbar.tsx](../../apps/workbench/components/topbar.tsx)     |
| `all-apps`      | the **All apps** button in the rail footer                 | [components/app-rail.tsx](../../apps/workbench/components/app-rail.tsx) |
| `quick-add`     | the pink **+** trigger                                     | [components/topbar.tsx](../../apps/workbench/components/topbar.tsx)     |
| `help`          | the `<FeedbackButton />` slot                              | [components/topbar.tsx](../../apps/workbench/components/topbar.tsx)     |

Put each on the wrapper, not on the silica control — a `data-guide` on a `<Button>`
rings whatever silica happens to render as the root, and the ring is meant to
outline the thing a person would point at.

## The steps

### 1 · `hello` — no anchor

**This is where you run everything**

> Your website, what you sell, who you sell it to, and what you get paid — all of
> it lives here. A couple of minutes, and you can stop any time. Nothing on screen
> is locked while we do this.

### 2 · `business` — `business`

**This is your business**

> Its name sits up here so you always know whose books you are looking at. Run
> more than one? This is where you swap between them, and everything on screen
> follows.

### 3 · `site` — `site-switcher`

**And this is the business your customers see**

> A site is a shopfront with its own name, its own look and its own customers. Most
> people have one. If you run two, switching here swaps the lot — and each one
> remembers how you had your screens arranged.

_The single most confused idea in the product, and the reason it gets its own step
rather than a clause in the one above. A tenant is who we bill; a site is the
business somebody deals with._

### 4 · `app-rail` — `app-rail`

**Every one of these is yours**

> These are your apps, and you have all of them — nothing here costs extra and
> nothing is a trial. They are grouped and colored by what they are for, so the
> orange ones are about selling and the green ones are about money.

### 5 · `all-apps` — `all-apps`

**There are a few more behind here**

> We start you with the apps most businesses want, and keep the rest out of the
> way. Nothing is switched off and nothing has a price on it — open this and drag
> any of them onto the list whenever you need it.

_Not padding. Partners, Automations and Connections are off the rail for a new
business (`defaultEnabled: false` in [@piggles/config](../../packages/config/src/apps.ts)),
so without this step three whole apps are invisible and read as unavailable —
which is the exact thing RULE #2 says must never happen._

### 6 · `app-panel` — `app-panel` · opens **Home**

**Pick an app, get its screens**

> Clicking an app on the list opens everything inside it here — this is Home's. If
> you are ever hunting for something, this column is the map, and each group has a
> short walk of its own if you want one.

_`app: 'home'` on the step. Without it the ring lands on a closed panel — a
zero-width box against the left edge, pointing confidently at nothing._

### 7 · `workspace` — `workspace`

**Your work opens in here**

> Screens open side by side so you can keep an eye on two things at once — an
> order next to the customer who placed it. Drag one out and it becomes its own
> window. Everything stays exactly as you left it, per business.

### 8 · `search` — `search`

**When you would rather just ask**

> Type a customer, an order, a product or the name of a screen. Ctrl-K opens it
> from anywhere — ⌘K on a Mac — and it is almost always quicker than clicking.

### 9 · `add` — `quick-add`

**Making something new**

> An invoice, a product, a customer, a booking. This is the shortcut for when you
> know what you want to make and would rather not go and find the screen first.

### 10 · `help` — `help`

**And if you get stuck, we are right here**

> Send us a question, an idea, or something that is not working, and a real person
> reads it. That is the whole shape of the place. Open any app and we will offer
> you a quick walk through that one too — same deal, and you can always say no.

---

## What this tour deliberately leaves out

- **Favourites and the pane star.** Useful, and useless on day one — nothing has
  been used often enough to be a favourite yet. It belongs in a "you have been
  here a fortnight" prompt, not here.
- **Layouts, saved arrangements, tearing panes into windows.** The workspace step
  says a pane can become a window and stops there. Somebody with one screen open
  has nothing to arrange.
- **Light and dark, and the tabs/windows toggle.** Preferences. People find them.
- **Notifications.** It teaches itself the first time the bell has something in it.
- **What the business pays WizeWorks.** The console never knows a price
  ([CLAUDE.md](../../CLAUDE.md) RULE #2); the trial card in the rail is the whole
  of what this app says about money it is owed, and a tour step would be a second
  voice on it.
