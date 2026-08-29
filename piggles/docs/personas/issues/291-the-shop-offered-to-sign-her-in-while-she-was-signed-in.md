# 291 — The shop offered to sign her in while she was already signed in

**Status:** fixed
**Severity:** major (every shopper on every site built on the platform; the one
control that reaches an account is the one that says she has none)
**Found by:** P03 · Juniper Row · standing check "Buyer's side"
**Surface:** the tenant site — the header on every page, and the footer's
**Account** column
**Filed:** 2026-08-27
**Fixed:** 2026-08-27
**Confirmed by:** Her shop's header reads **Anneliese** signed in and **Sign in** signed out

## What happened

Anneliese Vogt bought the Ash Overshirt and a Tee from Juniper Row in August. She
had no login, so she made one: **Create account**, her real email, done. The shop
signed her in and dropped her on `/account`, which greets her by name:

> **Hi, Anneliese** — Manage your orders and details here.

Her name is in the account rail. Her email is under it. There is a **Sign out**
button. And in the top right corner of the very same page, the site header says:

> **Sign in**

It says it on `/account`. It says it on `/account/orders`, above her own order.
It says it on `/shop`. It says it on the order detail page while she is reading
what she bought. The footer's **Account** column says it too. She is signed in on
every one of them.

There is no link anywhere in the site chrome that reaches her account. The only
way back to `/account` is to type the address, or to click **Sign in** — which
takes a signed-in customer to a sign-in form.

## What should have happened

The header is where a shopper looks to find out whether a shop knows them. It
should say **Sign in** to a stranger and offer her name (or "Account") to
Anneliese, linking to `/account`. This is not a preference; it is the difference
between a shop that recognizes a returning customer and one that does not.

The rule is already written down in this codebase, one slot away from the bug.
`site.brand` is a host core rather than a stamped node, and the reason is in its
docblock:

> A STAMPED brand node freezes at publish … A host node stores only a mount
> point, so the mark renders LIVE from Site settings on every request.

`site.legal-links` is a host core for the same reason, stated even more sharply:

> A host core rather than authored anchors because the links are DATA the tenant
> owns elsewhere, and a static tree gets them wrong in both directions.

The account link is data too — it belongs to the visitor rather than the tenant,
and a static tree gets it wrong in both directions in exactly the same way.

## How to reproduce

Every time, on any site on the platform.

1. Open Juniper Row's shop and click **Sign in**.
2. **Create account** as `anneliese.vogt@example.com`, any password.
3. You land on `/account` — "Hi, Anneliese", with a **Sign out** button.
4. Look at the top right of the header. It reads **Sign in**.
5. Go to `/shop`, `/account/orders`, or any order. Still **Sign in**, everywhere.

## Why it matters

Devi is moving off a marketplace that owned her customer list. The entire point
of the move is that Juniper Row is now the one who knows her customers. The first
thing her shop says to a customer it knows is that it does not know her.

It is also a dead end rather than only a wrong word. The account area holds her
orders, her addresses and her wishlist, and after the first visit there is no
route to it from the site — the header control that should go there goes to a
sign-in form instead.

And this is not Juniper Row's. There is one chrome path on the platform now (the
silica frame; the layout's `silicaActive` ternary is gone), so the stamped label
is in the header of **every tenant site**, not one badly configured site.

## Where it lives

- [wizeworks/packages/silica-catalog/src/site-chrome.ts:439](../../../../wizeworks/packages/silica-catalog/src/site-chrome.ts#L439)
  — the navbar's `secondary` slot, filled with a stamped literal:

  ```ts
  secondary: { text: 'Sign in', href: '/account/login' },
  ```

  Two slots above it, `brand` is filled with `hostCore(HOST_KEYS.siteBrand)`
  precisely so it is not stamped.

- [wizeworks/packages/silica-catalog/src/site-chrome.ts:591](../../../../wizeworks/packages/silica-catalog/src/site-chrome.ts#L591)
  — the footer's Account column, the same literal: `['Sign in', '/account']`.

The session it needs is already in scope: `SilicaChrome` renders inside
`<CustomerProvider>` in
[wizeworks/apps/site/app/layout.tsx:527](../../../../wizeworks/apps/site/app/layout.tsx#L527),
and `useCustomer()` exposes `status` (`loading` / `authenticated` / `anonymous`)
and the resolved `customer`. Nothing new has to be fetched.

## The fix

**A new host core, `site.account-link`**, in the idiom the file already
establishes. The navbar's `secondary` slot stops being a stamped literal and
becomes a mount point, so the platform answers the question per request instead
of freezing an answer at publish — the same reason `site.brand` and
`site.legal-links` are cores.

Live, it reads the session it is already sitting in (`SilicaChrome` renders
inside `<CustomerProvider>`), so nothing new is fetched:

| Session       | Shows          | Goes to          |
| ------------- | -------------- | ---------------- |
| resolving     | Account        | `/account`       |
| anonymous     | Sign in        | `/account/login` |
| authenticated | her first name | `/account`       |

The resolving state is "Account" rather than "Sign in" deliberately: it is true
either way, so a signed-in customer never sees a flash of the wrong word, and the
control does not pop into existence.

**The swap carries each placement's class**, unlike the sibling
`withHostThemeToggle`, which discards it because `ModeToggle` brings its own
styling. The `secondary` slot is filled TWICE and in two different node kinds —
an inline `<a>` in the bar (`hidden … @sm:inline`) and a `Button` component in
the phone panel (`btn btn-ghost btn-sm mt-2 w-full`) — so flattening them would
turn the phone menu's button into a bare link.

**The footer is a rename, not a core.** `/account` already routes correctly in
both directions (it bounces a stranger to the sign-in form, with a redirect
back), so only the word was false. It now reads **"Your account"**, which is true
in both states — and a footer showing her name twice would be odd.

**Reaching tenants who already published** turned out to be a separate defect and
is filed as [296]. The generator change alone reaches nobody: Devi's chrome is a
stored tree, and both her draft and published trees carried the stamped link.

## Confirmed by

Driven end to end on Juniper Row.

As Devi: opened **My Site › Header & footer**, which healed her stored draft, and
pressed **Publish**. Her published tree now carries `site.account-link` and no
`/account/login` anchor.

As Anneliese, signed in: the header on `/shop`, `/account` and `/account/orders`
reads **Anneliese**, and clicking it lands on `/account` — "Hi, Anneliese". The
footer's Account column reads **Your account**. The dead end is closed.

Signed out, on the same pages: the header reads **Sign in**, and the footer's
**Your account** lands on `/account/login?redirect=%2Faccount`.

Both placements healed — the server-rendered page carries the core twice, once as
`hidden text-sm font-medium text-base-content hover:text-primary @sm:inline` and
once as `btn btn-ghost btn-sm mt-2 w-full`, each keeping the class the block gave
it. Checked at 360px, where the bar's copy correctly hides behind the phone menu.

Her site offers a single theme, so there is no dark variant to check
(`site.theme-toggle` renders nothing unless the appearance policy is `toggle`).
