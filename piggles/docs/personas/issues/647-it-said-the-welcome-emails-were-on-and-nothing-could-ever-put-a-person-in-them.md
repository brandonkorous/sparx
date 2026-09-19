# 647 — It said the welcome emails were on, and nothing could ever put a person in them

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 223
**Surface:** mypiggles › Messages › Automatic emails (the list, the editor, Enrolled people)
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 223 (all three states read back on screen, in both themes and at 360px)

## What happened

Messages › **Automatic emails** holds one sequence, seeded with the account:

> **Welcome series** · Greets a new customer on day 0 and follows up on day 3 · **Draft**

Opening it gives a genuinely good editor. Two emails, a wait of three days
between them, a switch that stops the rest arriving once somebody buys, and a
section headed **"Who it is for · Where this runs and how it treats people."**

That section says which business it belongs to, whether a person may go through
it twice, and what happens when they order. It does not say **how anybody gets
in.** Nothing on the screen does.

Pressing **Turn on** answered:

> **Welcome series is on**
> People enrolled from now on will start receiving the emails.

Measured the same day, against the platform database:

|                                                  |           |
| :----------------------------------------------- | --------: |
| automations on this platform                     | **2,411** |
| of those, ones that put a person into a sequence |     **0** |
| email sequences                                  |    **15** |
| of those, ones that are switched on              |     **0** |
| enrollments, ever, by anybody                    |     **0** |

A sequence sends nothing by itself. Something has to enroll a person, and there
are exactly two somethings: an automation carrying the action **"Add to an email
sequence"**, or somebody adding a person by hand. Neither existed, so "People
enrolled from now on will start receiving the emails" described nobody, and
would have gone on describing nobody forever. The only sign would have been a
count of zero that never moved.
[[feedback_a_promise_in_copy_is_a_contract]] [[feedback_never_present_absence_as_measurement]]

## The screen that already knew

One button along, **Enrolled people**, the empty state says it perfectly:

> **Nobody is enrolled yet**
> People are added automatically by any automation that starts this sequence, or
> you can add someone by hand.

So does the data layer's own header comment ("People are enrolled by an
automation or by hand"), and the service's, and the route's. The fact was
written down four times in the code and once on a screen — and not on the screen
with the on switch. [[feedback_a_fix_leaves_its_neighbour_behind]]

## The fix

**The editor now always carries one statement**, in every state, where before it
spoke only when the sequence was already on — which left the state every
sequence on this platform is actually in with nothing said at all.

| it is       | nothing points at it                                       | rules point at it, all off                           | a rule is running                                        |
| ----------- | ---------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| **a draft** | blue · "Nothing adds anyone to this yet" + both ways in    | blue · "and none of them is switched on either"      | blue · "They start arriving as soon as you turn this on" |
| **on**      | **amber** · "This sequence is on, and nothing adds anyone" | **amber** · "the automation that adds people is off" | blue · "2 automations add people to it"                  |
| **stopped** | blue · "It sends nothing and nobody new is added"          | —                                                    | —                                                        |

"Nothing points at it" and "the rule is switched off" are told apart on purpose:
the remedies are different, one is build a rule and the other is turn one on.

**The badge on a row** no longer wears the working green for a sequence that is
on and cannot reach anybody. It reads **"On, adds nobody"** in amber.

**The toast** reports what is wired rather than promising delivery:

> **Welcome series is on, but nothing adds anyone**
> It will send nothing until somebody is in it. An automation using the action
> "Add to an email sequence" adds people for you, or you can add someone by hand
> from Enrolled people.

## Where the number comes from

`GET /v1/email/sequences` and `/:id` now carry `enrollers: { total, live }` —
how many of the tenant's automations name this sequence in an
`email.sequence_add` action, and how many of those are switched on.

One query for the whole page, not one per row: a `@>` containment narrows to the
automations carrying that action at all, then a walk reads which sequence each
names, because containment cannot report WHICH value matched. Only PUBLISHED
actions count; a draft edit that wires one up is not running yet, and saying
otherwise would be the same lie one level down.

`live`, not `total`, decides the warning. Two rules pointed at a sequence and
both switched off is the same outcome as none.

## Three smaller things on the same surface, fixed with it

1. **"Enrol someone"** was British. It is **"Enroll someone"** now, and it
   matches the pane's own "Nobody is **enrolled** yet" two inches below it.
2. That button is **icon-only below `@lg`**, and the label is hidden with
   `hidden`, which is `display: none` — so it left the accessibility tree with
   the text and a narrow pane had a button with **no name at all**. It now
   carries `aria-label` and `title`.
3. The automations builder told a Piggles shop to **"create one under Email →
   Sequences"**. This console has neither of those words: the app is
   **Messages** and the screen is **Automatic emails**. It now says so, through
   `copy.ts` like every other Piggles sentence. The sequence editor's own
   "Design one under Email" was wrong in BOTH consoles — the screen is called
   **Email designs** and it is not under Email — and now names it.

## Confirming it

Driven as Devi, on her own seeded sequence:

1. Opened as a draft: **"This is a draft, so nothing is sending. Nothing adds
   anyone to this yet…"**
2. Pressed **Turn on**: the badge went amber **"On, adds nobody"**, the notice
   became **"This sequence is on, and nothing adds anyone"**, and the toast
   said so too.
3. Pressed **Pause**: back to Draft, toast **"Welcome series paused. It stops
   adding new people."** The row in the database is `draft` again and
   enrollments are still `0` — turning it on enrolled nobody, which is the
   point.
4. Read at **360px** and in **dark**: the notice wraps, the form stacks, every
   button in the pane has an accessible name.

## Guard

- **`sequence-words.test.ts`**, both consoles, **13 tests**. Proved red twice:
  restoring the sentence that actually shipped (one fixed line, only when on)
  fails **6 of 13**; reading `total` where it should read `live` fails **2**.
- **`sequence-enrollers.test.ts`**, api-rest, **7 tests** against real Postgres
  through the routes the console calls. Proved red three times: counting every
  rule as running fails the "EXIST versus RUN" test; counting steps rather than
  rules fails the twice-named test; ignoring the action type fails the
  "takes people OUT" test.

That last one **did not redden on the first attempt**. The decoy was a separate
automation carrying `email.send_campaign`, which the containment filter removes
before the walk ever sees it, so the type check was never exercised. The fixture
is now ONE rule that both removes from this sequence and adds to another — both
actions naming a sequence in the same config field, so only the type tells them
apart. [[feedback_a_test_that_cannot_go_red]]

## It now offers to build the automation

This section used to say the opposite, and the reasoning was wrong.

The notice names the remedy exactly: an automation carrying the action "Add to an
email sequence", pointed at this sequence. Both halves are already on the screen.
Making her leave, find Automations, start a rule, pick that action out of a list
of dozens and then pick this sequence out of a menu is asking her to reassemble a
sentence the screen just said.

So the notice carries **Build the automation that adds people** whenever nothing
is feeding the sequence. It opens the automations editor with:

- the action already there, pointed at this sequence, and
- the rule already named **Add people to <sequence>**, because an automations
  list full of "Untitled automation" is its own defect.

**The trigger is deliberately NOT guessed**, which is what the old note got
right and then drew the wrong conclusion from. Picking it for her would be the
editor pretending to know her business. She lands on a rule that says what it
does with the one real question still open — and that question is worth her
answering, because the default is "An order is placed" and a welcome series
wants "A new customer is added".

Confirmed as Devi, end to end: clicked the button, the rule opened seeded, chose
the trigger, created it, turned it on, and the sequence's own notice changed from
"Nothing adds anyone to this yet" to "1 automation already adds people to it".

### The count said "1 automation add people to it"

Found on that screen, in copy written for this issue. `rules()` pluralised the
NOUN and left the verb behind, in **five** sentences — and one is the commonest
number there is, because it is what the first rule somebody builds looks like.

The test could not catch it. It read:

```ts
expect(sequenceNotice('active', working).body).toContain('1 automation ');
```

and stopped on the space, one character before the broken word. Two tests now
read the verb back whole; removing the agreement reddens both.
[[feedback_a_test_that_cannot_go_red]]

## Still not offered

**Nothing offers the OTHER way in.** The notice names adding someone by hand from
Enrolled people and does not link there either. Smaller than the automation half
(the Enrolled people screen is one click from this pane's header) but the same
shape, and written down rather than fixed.
