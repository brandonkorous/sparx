# 159 — Every page of her site makes a keyboard user walk the whole menu

**Status:** open
**Severity:** minor
**Found by:** P02 · Halo & Hem · standing check "without a mouse"
**Surface:** haloandhem.com — every page (site chrome)
**Filed:** 2026-08-23
**Fixed:** —
**Confirmed by:** —
**Blocked on:** decision — it changes the chrome every blueprint seeds

## What happened

Doing the whole booking with the keyboard, two things made the path longer than it
needs to be. Neither stops anybody; both are friction that only a keyboard user
pays.

**There is no skip link.** The first Tab on a freshly loaded page lands on the
wordmark. To reach the booking form you walk the entire header first — wordmark,
Book, The team, Our work, About, Contact, Sign in, Get in touch. Eight stops before
the content, on every page, every time. A "Skip to content" link is the standard
answer and is invisible until it is focused, so it costs the design nothing.

Worth saying what is already RIGHT, because it is most of the work: the focus ring
is clearly visible on every single control — nav links, service cards, the stylist
buttons, the time chips, the fields and the Book button — and after an in-app
navigation from a service card, focus lands on the first element of the CONTENT
rather than back at the top. The confirmation card carries `role="status"`, so it
is announced. Somebody has thought about this; the skip link is the missing piece.

**A day of times is a long walk.** Each time chip is its own tab stop. Cut and
finish on a quiet Tuesday was 13 stops; a fifteen-minute service on a full day
would be forty-odd, and there is no way past them but through. A roving-tabindex
group (one stop, arrow keys between the times) is the usual pattern and would make
it one.

## Why it matters

Not a blocker: the booking completes ([158] has the confirmation). It is the
difference between "possible" and "reasonable", and it is paid by exactly the
people least able to spare it.

The reach is what makes it worth recording rather than shrugging at: this is the
seeded site chrome, so it is not Nia's site — it is every tenant's site.

## Where it lives

The header is the silica frame seeded by
`wizeworks/packages/builder-schemas/src/site-chrome.ts` and carried by every
blueprint under `marketplace-catalog/blueprints/`. The time chips are
`wizeworks/apps/site/components/booking/booking-widget.tsx`.

## Why it is not fixed here

The skip link belongs in the seeded chrome, which means touching the navbar factory
and the 191 committed bundles that already carry a copy of it — a distribution event
for a minor accessibility gain, and a decision about tenant site chrome rather than a
defect fix. The chip grouping is a smaller, self-contained change and could go first.

Raising rather than doing, per the rule about tenant-site chrome being Brandon's
call.
