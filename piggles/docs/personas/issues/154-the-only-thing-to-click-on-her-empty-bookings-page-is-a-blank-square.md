# 154 — The only thing to click on her empty bookings page is a blank square

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing check — the buyer's side
**Surface:** haloandhem.com › Account › My bookings
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** see below

## What happened

Imani signed in and went to her bookings.

> **My bookings**    ▪
> Upcoming · Past
> You have no upcoming bookings.

The ▪ is a solid brown square in the top right corner, the size of a button, with
no word in it. It is the "Book an appointment" button. It is the only thing to
click on a page that has just told her she has nothing, and it says nothing.

## Why it happened

One call site, in `apps/site/app/account/(authed)/bookings/page.tsx`:

```tsx
<Button color="primary" render={<Link href="/book">Book an appointment</Link>} />
```

silica's `render` prop swaps the ELEMENT and keeps the Button's own children. The
label was put inside the render element instead, so the Button rendered its own
children — which were empty — into a correctly styled anchor. Everything about it
is right except that nobody can read it.

Fifteen other call sites across the site and account apps pass `render` a
self-closing element with the label as children, which is the contract. This was
the only one that did not, and it survived because it sits on a page nobody had
ever opened as a customer.

## The fix

```tsx
<Button color="primary" render={<Link href="/book" />}>Book an appointment</Button>
```

The same page's hand-rolled `style={{ display: 'flex', … }}` layout went with it,
for Tailwind utilities.

## Confirmed by

Signed in as Imani on `haloandhem.com` › Account › My bookings: the button reads
**Book an appointment** and opens the booking page.
