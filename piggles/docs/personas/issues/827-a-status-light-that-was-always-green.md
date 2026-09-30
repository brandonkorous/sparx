# 827 — A status light that was always green

**Status:** fixed (one migration waiting)
**Severity:** correctness + copy
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles workbench — the four Connections panes, and the seeded AI instruction library
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi
**Blocked on:** Brandon, for migration `20270520000000` (42 rows)

## The badge

Top-left of **What is connected**, in green, with a little live dot:

> ● Bridge online

```tsx
status={
  <Badge color="success" variant="soft" size="sm">
    <span className="bg-success mr-1 inline-block size-2 rounded-full" aria-hidden />
    Bridge online
  </Badge>
}
```

No data. The color is a literal, the words are a literal, and the dot is a
`<span>`. It reports health it has never measured, and there is no state in which
it could have said anything else — if the connection were down it would still be
green, still saying online.

That is the defect `check:automation-health` exists for, whose pre-push note
reads: _"a rule whose every run has failed wears a green On"_. Same shape, a
different screen: a status that cannot report the bad case is not a status.

And "bridge" is a word from inside the machine. What a shop owner wants from that
bar is whether anything is connected at all — which this pane already knows,
because it counts the keys four inches below. It says so now.

## A sentence with a hole in it

Beside it:

> **Worked as asked**
> **—**
> of calls in the last 30 days

The em dash is the console's empty-cell mark and is right; the caption under it
was written for the case where there IS a number. Read together it says "— of
calls in the last 30 days". It says "nothing has been asked yet" when nothing
has been asked.

## Three places naming a screen this console does not have

`ai.tools` is titled **What it may do** in Piggles. It was named **Permissions**
on:

- the cross-link card on **AI connections**
- the "that's in ___" sentence on **Instructions**
- the toolbar status of **What it may do itself**, above a tab reading the other
  name

All three read the registry now, so the name cannot drift from the tab it points
at. The third is the one worth remembering: a pane spelling out a different name
for itself, on itself.
[[feedback_a_copy_edit_breaks_identity_lookups]]

## "storefront", in seeded data, years after the rename

The second row of Instructions:

> **Support assistant persona**
> The voice + guardrails for your storefront chat assistant. The live-chat AI
> reads the active enabled persona to ground every reply.

**"storefront" is a retired word.** The rename was platform-wide — copy,
database, API, CSS and docs — keeping exactly one use: the sales-channel VALUE,
which is a wire string rather than a word. It survived here because seeded data
is not copy anybody greps.

The rest of the sentence is the AI trade talking to itself: guardrails, persona,
"ground every reply", and a `+` doing the work of "and". Four other rows had
smaller doses — "benefit-led", "on-brand", "platform-appropriate", and a second
`+` inside a NAME ("SEO title + meta description").

`default-prompts.ts` states in its own header why fixing the file is not enough:

> the install is ensure-by-key (idempotent), so editing a body here does NOT
> overwrite a tenant's edited copy; it only affects tenants that don't yet have
> that key.

Third time this act, after the ready-made reports and the reply notices.
Migration `20270520000000` refreshes the rows that no tenant has edited, matched
on `key`, gated on `created_at = updated_at`, wrapped in a tenant loop because
`ai_prompt_templates` is FORCE RLS. Dry run, rolled back:

```
NOTICE:  ready-made instructions: 42 row(s) refreshed
 still_storefront
------------------
                0
```

## Why the word got through, and the two guards that will now stop it

**`storefront` was not on `BANNED_IN_PRODUCT_COPY`.** That list is described in
its own file as "the enforceable half of RULE #3 — a copy review can grep for
these", and it already carries the identical lesson one entry up:

> The word the console renamed a whole surface to avoid: "What fits what", not
> "Fitment". It was still reaching the screen from a shared package, five times
> on one pane, because this list is what a reviewer greps and 'fitment' was not
> on it.

Same story, next word. It is on the list now.

**And `check:plain-words` reads only `piggles/apps/workbench/**`.** The seeded
instruction library lives in api-rest, so no amount of adding words to the list
would have caught this one. Measured across both consoles and both shared trees:
5,564 files, 51 lines still saying it outside a comment — almost all of them env
vars, the documented sales-channel value, marketing prose about a real shop
window, and the docs guide that states the rule.

One was live and one was a decision:

- **`lib/surfaces/nav.ts: storefront: 'Storefront'`** — the retired word in the
  one label table every surface now reads through `moduleLabel` after issue 822.
  It says **Site**. Both consoles.
- **`lexicon.ts: MODULE_TERMS.storefront = 'Online store'`** is deliberate and
  documented: _"the site is the whole web presence; the storefront is the part
  that takes money, and a business with both needs to be able to tell them
  apart."_ Left alone.

## Files

- `piggles/apps/workbench/surfaces/ai/{overview,prompts-list,prompt-editor,tool-policies}.tsx`
- `piggles|sparx/apps/workbench/lib/surfaces/nav.ts`
- `piggles/packages/config/src/lexicon.ts`
- `wizeworks/services/api-rest/src/lib/ai/default-prompts.ts`
- `wizeworks/packages/db/src/sample-data/engine/ai.ts`
- `wizeworks/packages/db/prisma/migrations/20270520000000_the_ready_made_instructions_stop_saying_storefront/`

## Noted, not fixed

**38 tool descriptions on one app, written for a machine.** What it may do draws
the MCP tool catalog straight onto the screen:

> Cancel a booking, releasing its slot immediately. Any deposit/hold is settled
> per the service policy by the booking surface; this tool performs the
> cancellation and notifies the customer.

"the booking surface", "this tool performs", "deposit/hold", "per the service
policy". These are written to be read by an AI deciding whether to call
something, and they are correct for that. A shop owner deciding whether to LET it
is a different reader with a different question, and there are hundreds of them
across every app. It wants the same treatment the industry starters just got: the
brand's own sentence at the boundary, keyed by tool name.

**`check:plain-words` scans one tree.** Extending it to the shared packages is
not a one-line change, because api-rest serves both brands and sparx's reader
legitimately knows "CRM" and "module". The words that are retired PLATFORM-wide,
like this one, are a smaller and safer list to check everywhere.
