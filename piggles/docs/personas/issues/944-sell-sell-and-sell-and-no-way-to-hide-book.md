# 944 — Sell, Sell and Sell, and no way to hide Book

**Status:** fixed (act 6), one route waiting on the scheduling files
**Severity:** major
**Found by:** P09 · The Marrow Review · act 6, taking the shop off her journal's site
**Surface:** mypiggles › Sites › a site › What this site shows (both consoles), and the public site's module gate (`apps/site/lib/site-modules.ts`)
**Filed:** 2026-10-07
**Fixed:** 2026-10-07
**Confirmed by:** P09 · The Marrow Review · act 6, her header down to Home, About, Account, Journal and Contact
**Blocked on:** — (see Still open)

## What happened

Her persona file says a basket, a price or a checkout on this site is the
finding. After retiring the design's example products she opened her site's
**What this site shows**: "Switch off anything this site has no use for."

- The list read **Sell, Content, Customers, Messages, Sell, Sell, Stock,
  Connections**. Three modules live in the Sell app, each switch was named after
  the app, and nothing said which Sell was the shop.
- There was **no switch for Bookings**. Her site's header said **Book**, and the
  public site's own gate left booking pages out on purpose ("scheduling is not
  one of the eight switches"). A journal could not take a booking page off its
  own site.
- Four of the switches (Messages, the third Sell, Stock, Connections) change
  nothing a visitor sees at all; they only change what an AI assistant connected
  to the site can look up. Nothing said so.

## The fix

- **Each switch says what it covers** (`site-scope-words.ts`): "Sell: The shop:
  products, basket, checkout and order history." "Sell: Wholesale accounts."
  The four assistant-only switches say "Visitors see no difference. It only
  changes whether an AI assistant connected to this site can use …".
- **Bookings is a switch**, in both consoles and in the public site's gate. It
  owns `/book` and `/meet`, and the booking list block. A customer's own link to
  a booking already made (`/booking/<token>`) stays reachable, so switching
  Bookings off never strands somebody holding one.

## Proof

- `site-scope-words.test.ts`: the three Sell switches read three different
  lines; an assistant-only switch promises no visible change; Bookings exists.
- `site-modules.test.ts` (public site), 38 cases: `/book`, `/book/fitting` and
  `/meet/devi` belong to Bookings, `/booking/abc` belongs to nobody, and the
  booking list block goes with the switch. Removing `/book` reddens 1.
- On screen, as Rosalind: the switches read as above. She switched off the shop,
  Bookings, wholesale, dropshipping and stock. Her live header and footer went
  from Shop, Book, Journal, About, Contact, Collections, Search, Orders, Returns
  and Cart to **Home, About, Account, Journal, Contact**; `/cart`, `/products`
  and `/shop` answer 404.

## Still open

- `/book` still answers when somebody types it, because the page itself
  (`apps/site/app/book/page.tsx`, and `book/[serviceId]`, `meet/[slug]`) must
  call `requireSiteModule(site, 'scheduling')`, and those are scheduling files
  another session owns. Nothing on her site links there any more.
