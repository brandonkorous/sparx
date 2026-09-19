# 614 — The console taught me a phrase and then did not answer to it

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › the search box (every screen)
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (seen on screen, before and after)

## What happened

The box at the top of every screen says **"What do you want to do?"**. I wanted
to find where the legal pages live, and I remembered the heading: the navigation
panel groups them under **Keeping it legal**. So I typed that.

> Nothing matches that. Try a different word.

I tried the other heading I could remember, **Who can get in**, which is where
signing in and connected software sit. Same answer.

Those are not words I invented. They are the headings this console prints above
its own screens, written in plain English on purpose so I would remember them.
Then the box that asks what I want to do has never heard of them.

## Why it happened

`lib/surfaces/registry.ts`. The launcher scores a screen on its name, the words
it was tagged with, and its app:

```ts
export function surfaceKeywords(definition: SurfaceDefinition): readonly string[] {
  const keywords = definition.keywords ?? [];
  const platform = definition.title;
  if (typeof platform !== 'string' || resolveTitle(definition, {}) === platform) return keywords;
  return [...keywords, platform];
}
```

The comment above it already had the whole insight:

> Every extra word this surface can be found by. A Piggles name REPLACES the
> platform's, so "Collections" stops being findable once it reads "Groups of
> products" — and the old word is often the one somebody arrives knowing.

Exactly right, and applied to the screen's own name only. The **section** it
sits under is the other name a person reads, it is renamed by the same table
with the same care, and it was never a keyword at all.

The same fix, stopping one step short of its neighbour. Third time today.

## The fix

The section goes in, in both spellings, for the same reason the old title does:

```ts
const { section } = definition;
if (section) {
  keywords.push(section);
  const renamed = productSectionTitle(section);
  if (renamed && renamed !== section) keywords.push(renamed);
}
```

On screen, after:

| typed              | before               | after                                                     |
| :----------------- | :------------------- | :-------------------------------------------------------- |
| `keeping it legal` | Nothing matches that | My Team › Tickets and licenses                            |
| `who can get in`   | Nothing matches that | Other software · AI connections · Signing in and security |

The platform spelling goes in too, so somebody who learned the other console, or
read a support page, can still type "Compliance" and arrive.

sparx got the same thing in its launcher. Its headings are not renamed, so there
is only one spelling, but "Going out the door" and "In progress" were equally
unfindable there.

## Guard

`lib/surfaces/surface-keywords.test.ts`, 8 tests.

The one that matters is not about legal pages:

```ts
it('covers every renamed heading, not just the one that was noticed', …)
```

It walks the whole `PIGGLES_SECTIONS` table and asserts both spellings for every
entry, so the next heading somebody renames is covered without anybody
remembering to come back. Plus a floor on the table's own size, because a test
that iterates an empty object passes and says nothing.

Two limits, stated rather than hidden. The test builds surface definitions by
hand and feeds the heading table in with `configureProduct`, because the console
test seat is `environment: 'node'` and both the real registry and the shell's
own configuration import components that render. So this proves the **rule**,
not the catalog. Registering a surface with no section, or with a section nobody
added to the table, is still something only looking catches.

Proven red by removing the section lookup: **4 of 8** fail.

## Still open

Nothing from this issue.
