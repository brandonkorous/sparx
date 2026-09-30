# 733 — Available, with nowhere to press

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 260
**Surface:** mypiggles + sparx workbench — Where you sell / Sales channels
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: pressing Connect opens Meta's consent window; `/v1/channels/meta/connect-url` answered 200
**Blocked on:** —

## What happened

Opening **Where you sell** for the first time. Under **Ready to connect**:

> **Meta (Instagram & Facebook)** — `Available`
> Sync your catalog to Instagram and Facebook Shops and tag products in posts.
>
> _These shops are already set up here and can be connected in your settings._

A green **Available** badge, and nothing to press. The sentence sends her to
"your settings" without naming a screen or linking to one.

## Why it matters

There is no settings screen that connects a shop either. **MEASURED
2026-09-19:**

```
GET  /v1/channels/:slug/connect-url   →  0 callers, anywhere
POST /v1/channels/callback            →  0 callers, anywhere
```

Both shipped. The route signs a short-lived HS256 state bound to the site being
worked in, the callback trades the code, encrypts the tokens and upserts the
connection. `docs/106` describes the flow and says it mirrors Search Console.

Search Console has a Connect button. The social platforms have a Connect button.
This had a badge. **A shop the platform was ready to sell through could not be
reached from any screen in either console.**
[[feedback_screen_over_a_function_nobody_calls]]

And the badge is the part that makes it a promise rather than an omission:
`availability` is resolved at runtime against the live adapter registry and the
deployment's env, so **Available** is the server saying this one is ready now.
[[feedback_a_promise_in_copy_is_a_contract]]

## What was done

**A Connect button on every shop the server calls available.** It replaces the
badge rather than sitting beside it: a green **Available** next to a button that
says Connect is the same fact twice.

**The callback route**, `/commerce/sales-channels/callback`, which is where the
consent popup lands. Piggles uses the shared `OAuthPopupRelay`; sparx has no
such component yet, so its page is written in the same shape as its own social
callback rather than inventing a fifth copy's worth of difference.

**Two hooks**, beside the disconnect that was already there, and an error-message
helper so a failure reads in words.

**A failure banner on the pane, not a toast.** A handshake fails in a window that
has already closed, so a toast lands on a screen nobody is looking at. It stays
until the next attempt clears it.

**The sentence says what the button does**: "Connect one and you sign in to that
shop, allow it once, and come straight back. Your products start going across
shortly afterwards." The Piggles override said the old thing too, and was
rewritten with it.

## Checked and NOT a defect

**The other seven consent popups do not lock when you close them.** The first
version of this pane stored a `connecting` slug and disabled the section on it,
which DOES lock: closing the shop's window posts nothing, so the flag never
clears. Search Console, Accounting and Your social accounts all derive that flag
from the mutation state instead (`connectUrl.isPending || complete.isPending`),
which falls back to false on its own. That is the house pattern and this pane now
matches it. [[feedback_copy_the_house_layout_before_building]]

## Files

- `piggles|sparx/apps/workbench/surfaces/commerce/channels.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/channels-data.ts`
- `piggles|sparx/apps/workbench/app/commerce/sales-channels/callback/page.tsx` — new
- `piggles/apps/workbench/lib/console/copy.ts` — the hint

## Proof

On screen: pressing **Connect** on Meta calls
`GET /v1/channels/meta/connect-url?redirect_uri=…/commerce/sales-channels/callback`,
which answered **200**, and the consent window opened on Meta. It was closed
without signing in — no account was connected — and the button came straight
back to **Connect**, enabled, with the rest of the section usable.

Both typechecks and ESLint clean across both consoles; all sixteen structural
checks pass.
