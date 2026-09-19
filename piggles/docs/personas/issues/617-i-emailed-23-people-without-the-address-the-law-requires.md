# 617 — I emailed 23 people without the address the law requires

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Messages › Setting it up › Email settings, every
broadcast, and every automatic email
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (seen on screen)

## What happened

Messages › Setting it up › Email settings, over an empty box:

> **Your mailing address**
> Anti-spam laws (like the US CAN-SPAM Act) require a real physical mailing
> address in every email you send to a list. A PO box or registered office
> address is fine. Without one, your email is far more likely to be blocked or
> marked as spam.

My box is empty. And I have sent a list email.

```sql
select from_name, from_address, physical_address from email_settings
 where tenant_id = '…juniper row…';
-- Juniper Row |  |            ← blank

select name, status, sent_at, recipient_count from email_broadcasts …;
-- Autumn drop announcement | sent | 2026-08-26 09:20 | 23

select status, count(*), min(last_error) from email_scheduled_sends … group by status;
-- sent | 75 | (null)          ← no error on any of them
```

23 people, all delivered, no error, and no address in the footer of any of them.

Nothing warned me before. Nothing told me afterwards.

## Why it happened

**The gate was removed because half of what it guarded became structural.**

The marketing legal footer has two parts, and `email/src/silica/frame.ts`
composes them differently:

```ts
if (opts.marketing) {
  parts.push(`…You’re receiving this because you opted in. <a …>Unsubscribe</a>…`);
} // unconditional

if (opts.compliance?.physicalAddress) {
  parts.push(`…${name} · ${address}…`);
} // only when it is set
```

docs/120 slice 7 removed the dispatch-time compliance gate, reasoning that
silica now composes the footer into every marketing send so nothing can be
authored away. That is **true of the unsubscribe link and only of the
unsubscribe link.** The address half stayed conditional, and the gate that
covered both went with the first.

The dispatch test says so in its own header, and did not notice what it was
saying:

> NOTE: the marketing COMPLIANCE GATE this suite was originally built around is
> gone (docs/120 slice 7). Silica composes the legal footer into every marketing
> send, so an unsubscribe link cannot be authored away and there is nothing left
> to refuse at dispatch.

**Three places still claimed the rule was enforced.** The settings screen above;
`broadcast-service.ts` ("a broadcast from a tenant with no postal address on
file is refused, which is the CAN-SPAM rule"); and docs/120 itself ("a marketing
send with no configured `physicalAddress`/unsubscribe still refuses,
unchanged"). A promise in copy is a contract, and this one had three signatures
and no performance ([[feedback_a_promise_in_copy_is_a_contract]]).

## A second one, found on the way

Even an owner who **has** filled the box in got no address on a broadcast that
is rendered once.

`broadcast-service.ts` renders the body itself when the email is not
personalized, and that call passed `marketing: true` with **no `compliance`
object at all** — so `opts.compliance?.physicalAddress` was undefined and the
line was dropped. The personalized branch gets the address at dispatch; this one
is rendered at enqueue, so nobody handed it over.

Doing the right thing and having it thrown away is the worse of the two bugs.

## The fix

### 1. Refuse at enqueue, not at dispatch

```ts
if ((settings.physicalAddress ?? '').trim() === '') {
  throw new EmailValidationError(
    'Add your mailing address in Email settings before sending to a list. ' +
      'Anti-spam law requires a real postal address in the footer of every one.'
  );
}
```

The old gate refused at the dispatch tick: **after** the send screen had said it
went to 23 people, in a worker she cannot see, with nothing to press. This one
runs before a single `ScheduledSend` row exists.

### 2. Say it on the screen where she is standing

The compose pane already prints a list of what is still missing. It is one more
entry, worded so she knows it is not a field on this screen:

> Before you can send, this still needs an audience with people in it and **a
> mailing address on your email settings, which the law requires in the footer**.

The Send and Schedule buttons are already gated on that list being empty.

### 3. Hand the address to the render-once branch

```ts
compliance: { physicalAddress: settings.physicalAddress ?? '' },
```

### 4. One type over one endpoint

`broadcasts-data.ts` declared its **own** `EmailSettings` for
`GET /v1/email/settings`, and it dropped `physicalAddress`. So the compose screen
fetched the address, held it in `settings.data`, and could not see it: the value
was on the wire the whole time and the type made it invisible
([[feedback_fetched_but_never_rendered]]). It now re-exports the one in
`settings-data.ts`.

### 5. The same hole on the other path that sends to a list

Automatic emails (sequences) send marketing mail too. The "Welcome series" on
this shop declares:

> **What kind of email is this?** Marketing: a promotion or offer
> Marketing emails respect "do not email" choices and unsubscribes;
> transactional emails are for things a person is expecting.

Its steps reach the same dispatch tick, the same `frame.ts`, and the same
conditional address line. Fixing only broadcasts would have left the neighbor
behind for the third time today.

**Turning a sequence on is its Send button**, so it carries the same refusal:

```ts
if (patch.status === 'active') {
  const steps = parseSteps(patch.steps ?? sequence.steps);
  if (steps.some((step) => step.emailType === 'marketing')) { … }
}
```

Two things it is careful about:

- **Only when a step actually sends marketing.** A wholly transactional journey
  has nothing to opt out of and needs no address. `enroll` already asks the same
  question the same way for the do-not-contact rule.
- **`patch.steps ?? sequence.steps`**, so saving new steps and turning it on in
  one request is judged on the steps that will actually send.

The check sits in the **route**, not in `@wizeworks/email-sequences`. That
package is deliberately backend-safe (db + email-sends only) so the lean worker
can drain it, and re-deriving the per-site settings fallback inside it would be
a second implementation of the identity resolution. `settings-service.ts` says
what that costs: a console that re-derived it "named a domain the platform does
not send from". `parseSteps` was made exported rather than copied, for the same
reason.

On screen, pressing Turn on:

> **Add your mailing address first**
> Anti-spam law wants a real postal address in the footer of every marketing
> email, and this sequence sends one. It goes on your email settings.

The sequence stayed in Draft.

### 6. She had already given the console this address

The block above sent her to type something she had typed before. **My Site ›
Site identity › Address** already reads:

> 1418 Larimer Street
> Denver, CO 80202
>
> _One line per line, laid out how you would write it on an envelope._

Same business, same postal address, two boxes — and the fix as first written
made the second one compulsory. Asking somebody to repeat herself to the same
software is a worse outcome than the bug in some ways: the bug was silent, this
one is a wall.

So the email settings screen now says so, under the empty box:

> Your site already shows this address on its contact page and footer:
> 1418 Larimer Street
> Denver, CO 80202
>
> \[ Use that address ]

**Offered, never substituted.** It appears only while the box is untouched and
disappears the moment she types anything, and she still presses Save, so the
value is hers ([[feedback_honor_the_users_choice]]). Read from **this** site —
`useActivePropertyId` → `useSite` → `contactOf` — because a site's address is
its own and one owner's two shops must not borrow each other's
([[feedback_site_is_the_business]]).

Confirmed end to end: pressed it, the box filled, Save went live, saved, and the
compose screen's list dropped from

> …needs an audience with people in it **and a mailing address on your email
> settings, which the law requires in the footer**.

to

> Before you can send, this still needs an audience with people in it.

### 7. Refresh the doc that was wrong

docs/120 D5 now says which half was structural and which was not. Version 1.2 →
1.3.

## Guard

New `broadcast-ready.ts` + `.test.ts`, **9 tests** in each console.

`missingPieces` used to sit in a file that imports the surface registry, which
the node seat cannot load, so a rule with legal force had nowhere to be tested
from. It is now a leaf with no imports at all. sparx had the same six checks
written inline inside a component; it uses the leaf too.

One test earns its place beyond the obvious:

```ts
it('does not report missing while the settings are still loading', …)
```

`undefined` from the query is "not known yet", not "blank". Without that, a
legal warning flashes at every owner whose address is on file
([[feedback_never_present_absence_as_measurement]]).

Proven red by removing the check: **5 of 9** fail.

## Not changed

**The 23 emails that already went.** They are sent; there is nothing to recall.
An owner in this position may have a real compliance exposure, and this issue
does not address telling her about past sends. See below.

## Still open

**Nobody is told about sends that already went out without the address.** The
fix stops the next one. It does not go back over `email_broadcasts` with
`status = 'sent'` and a blank `physical_address` at the time and tell the owner
which of her campaigns are exposed. That needs a record of the address as it
stood at send (the settings row holds only the current value), so it is a data
change, not a copy change.

**An address cleared AFTER the gate still sends bare.** Both refusals fire when
the owner presses the button. A broadcast scheduled for next week, or a sequence
left running, reads the settings again at dispatch, and `frame.ts` still omits
the line rather than refusing. Closing that means the dispatch tick either
refusing or, better, stamping the address onto the `ScheduledSend` payload at
enqueue the way the `From` header already is — which is also what the audit
above would need.
