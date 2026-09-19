# 615 — Told I have no suppliers, on the day I paid two of them

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Partners › What they can send · What they are sending ·
What you made on it
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (all three panes seen on screen)

## What happened

Partners › **What they can send**:

> **No suppliers connected**
> Supplier products appear once you connect a supplier and sync its catalog.

I have two suppliers. Ashcombe Mills and Fairfield Trims. I was looking at their
bills twenty minutes ago, on a screen in this same app, and I owe them
$1,626.72.

The other two panes said the same thing in their own words:

> You have not connected a supplier yet, so nothing can be routed.
> You have not connected a supplier yet, so there is nothing to weigh.

Measured:

```sql
select count(*) from inventory_suppliers where tenant_id = '…juniper row…';  -- 2
select count(*) from dropship_suppliers  where tenant_id = '…juniper row…';  -- 0
```

Both numbers are right. The sentence is what is wrong: **the word means two
things in this console**, and it was used in the meaning I do not have without
saying so.

## Why it happened

This is not a case of nobody having thought about it. The navigation table had
already met the problem, solved it, and written the reasoning down:

> The dropship module and the inventory module BOTH have a screen called
> Suppliers, and Piggles' Partners app shows them side by side — two rows, one
> word, two entirely different lists. The platform never had to solve that
> because the two lived in different modules.
>
> So the dropship one is named by what makes it different: these are the
> suppliers who post the parcel straight to your customer, and you never touch
> the goods.

The **screen** was renamed to "Ship-direct suppliers". The **sentences inside
it** were not. So the console tells me these are two different things in its
navigation and then, one click later, uses the shorter word to tell me I have
none of the thing I have two of.

Fourth time today that a fix stopped at the example in front of somebody.
609, 610, 611 and 614 are the others.

## The fix

Only the **zero case**, on all three panes. Once a ship-direct supplier exists
the context is settled and "your supplier" is the right, shorter word.

| pane                  | was                      | now                            |
| :-------------------- | :----------------------- | :----------------------------- |
| What they can send    | No suppliers connected   | Nobody is shipping for you yet |
| What they are sending | No supplier is connected | Nobody is shipping for you yet |
| What you made on it   | No supplier is connected | Nobody is shipping for you yet |

And each detail now does two things it did not:

1. **Names the act that makes this kind different**, in the navigation's own
   terms: "another business posts straight to them for you".
2. **Says out loud that it is not the other kind**: "That is a different
   arrangement from the suppliers you buy from and stock yourself."

`What they can send` also moved its empty states into `dropship-empty.ts`,
joining the two panes 575 put there. It was the pane 575 found already right,
and it was right about the COUNT only — it branched on whether a supplier
existed and offered the button. It had nowhere to be tested from, which is why
nobody noticed the other half was missing.

sparx keeps its own heading for the non-zero state ("Nothing in this catalog
yet" against Piggles' "Nothing from this supplier yet"); only the zero case is
shared wording.

## Guard

`dropship-empty.test.ts`, 14 tests in each console, six of them new.

The new ones are a property over all three panes at once rather than three
string checks:

```ts
it('never claims she has no supplier full stop', …)
it('says which kind is missing, on every one of the three', …)
it('says out loud that it is not the suppliers she buys from', …)
it('offers the way out on all three', …)
```

That shape is deliberate. The reason this bug existed is that a third pane was
written separately and nobody compared it to the other two, so the guard is one
that fails unless all three agree.

One existing assertion was relaxed and not deleted: it required the exact string
"a longer period above will not change that" and the rewrite made that its own
sentence, capital A. The rule it states is that the screen must say a longer
period cannot help; the casing was never the point, so it is now
case-insensitive with a comment saying why.

Proven red by putting the vague sentence back on one pane: **2 of 14** fail.

## Not changed

**188 other sentences on these screens say a bare "supplier"**, and they stay.
Inside a screen called Ship-direct suppliers, with a supplier connected, the
context settles the word and "Could not save this ship-direct supplier" would be
worse writing. The confusion only bites where a sentence makes a CLAIM about
whether she has any, and those are the three that changed.

## The button underneath, found on the confirming reload

The reload that was supposed to close this issue opened another one. The
paragraph was right and the button under it was not:

> **Nobody is shipping for you yet**
> These are goods another business holds and posts straight to your customer.
> That is a different arrangement from the suppliers you buy from and put on
> your own shelves. Connect one that ships for you and its products appear here
> to import.
>
> \[ **Connect a supplier** ]

Three sentences separating the two meanings of the word, and then the word, on
its own, on the control. So the pane explained the distinction and then asked me
to act on the term it had just finished saying was ambiguous. If I click it, I
do not know whether I am about to see Ashcombe Mills.

This is the shape the issue is about, happening inside the fix for it. The fix
that leaves its neighbor behind, one level down.

### Why the button was missed

Because the button was not where the words were. Two of the three panes read a
`offerConnect: boolean` off the words module and then wrote their own label; the
third did not even read the flag, and called the words function four times for
two empty states with the label hardcoded beside them. The words moved and the
label had no reason to follow.

So the flag is gone. `DropshipEmpty.connect` is the **label itself**, or `null`
when there is no button:

```ts
/**
 * The words on the button that fixes this, or null when there is no button.
 *
 * A label rather than a flag so the three panes cannot word it differently,
 * and so a pane that decides to show the button is already holding the text.
 */
connect: string | null;
```

A pane cannot now decide to show the button without holding the words that go on
it.

| console | label                                 |
| :------ | :------------------------------------ |
| Piggles | Connect a ship-direct supplier        |
| sparx   | Connect a supplier that ships for you |

Piggles uses the phrase its own navigation teaches, which is the point of 614.
sparx teaches no such phrase, so it describes the kind instead rather than
importing Piggles' vocabulary.

**Not changed:** the same label inside the Ship-direct suppliers screen itself
(its toolbar, its own empty state, the create pane's title). The heading there
has already settled the word, and "Connect a supplier" is the better, shorter
writing.

### Guard

Two more, bringing each console to 16:

```ts
it('does not put the ambiguous word back on the button', …)
it('words the button the same on all three', …)
```

The first rejects the bare label and requires the kind to be named. The second
asserts the three panes agree, which is the same property the sentences are held
to, for the same reason.

Proven red by putting the bare label back: **4 of 16** fail.

## Confirmed on screen

All three panes, after:

| pane                  | heading                        | button                         |
| :-------------------- | :----------------------------- | :----------------------------- |
| What they can send    | Nobody is shipping for you yet | Connect a ship-direct supplier |
| What they are sending | Nobody is shipping for you yet | Connect a ship-direct supplier |
| What you made on it   | Nobody is shipping for you yet | Connect a ship-direct supplier |

## Still open

Nothing from this issue.
