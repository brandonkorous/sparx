# 637 — Nine of eleven rows had an empty Entries column

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 218
**Surface:** mypiggles › Content › Kinds of content (list and editor)
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 218 (seen on screen, before and after)

## What happened

Content › Kinds of content. Eleven rows, three columns: Name, Key, Entries.

| Name            | Entries                            |
| :-------------- | :--------------------------------- |
| **Testimonial** | _(blank)_                          |
| Announcement    | _(blank)_                          |
| Blog post       | 3 entries / 18 on your other sites |
| Case study      | _(blank)_                          |
| Event           | _(blank)_                          |
| Help article    | _(blank)_                          |
| Job posting     | _(blank)_                          |
| Landing page    | _(blank)_                          |
| News article    | _(blank)_                          |
| Page            | 6 entries                          |
| Team member     | _(blank)_                          |

Nine of eleven cells empty, under a column headed **Entries**. The one I care
about most is the top one: **Testimonial** is the type I defined myself. A blank
there reads as a screen that has not finished loading, not as an answer.

## Why it happened

The counts arrive as one map, and reading it asks two questions that look
identical in TypeScript and mean opposite things:

| what is undefined                   | what it means                |
| :---------------------------------- | :--------------------------- |
| the MAP                             | the numbers have not arrived |
| a KEY inside a map that has arrived | the number is **zero**       |

The server groups over the rows that exist, so a type nobody has used has
nothing to group and gets no row at all:

```ts
const byType = [...allSitesByKey.keys()].map(…)   // reports.ts
```

The data layer wrote that rule down in its own comment — _"a missing key means
zero"_ — and the cell three files away read `counts?.get(type.key)` and printed a
blank for both ([[feedback_a_fix_leaves_its_neighbour_behind]]).

So **"No entries yet" could never render for the case it was written for.** It
reached the screen only in the cross-site case ([[389]]: none here, some
elsewhere). A type with nothing anywhere — which is every type the moment it is
created — always showed blank.

Measured 2026-09-17 on her account:

|                                           |       |
| :---------------------------------------- | ----: |
| content types on the screen               |    11 |
| types with any entry anywhere             | **2** |
| rows that therefore printed an empty cell | **9** |
| her own types among them                  | **1** |

## The second half: the Delete warning

The same `?? 0` sat in the type editor, where it decides what the confirmation
says before removing a type:

```ts
const entryCount = typeCounts?.allSites ?? 0;
```

A counts request that has not landed yet — or has failed — therefore promised
**"This removes the type and its fields for good"** over a delete
`deleteContentTypeTx` refuses tenant-wide. That is [[389]]'s hazard reached
through the loading door instead of the scoping one
([[feedback_never_present_absence_as_measurement]]).

It does not block the button. A counts request that failed must not take Delete
with it. It says what it does not know, and what will happen either way:

> We could not check how much content uses the "Blog post" type. If any does, the
> delete will be refused and nothing will change. If none does, this removes the
> type and its fields for good, which cannot be undone.

## The fix

Three sentences moved into `content-type-usage-words.ts`. Every one takes the
**map** and the key, never a looked-up row, so a caller cannot flatten the two
nothings on the way in.

| reader                  | map undefined         | key missing from a loaded map               |
| :---------------------- | :-------------------- | :------------------------------------------ |
| `entriesHereLabel`      | `''`                  | **"No entries yet"**                        |
| `entriesElsewhereLabel` | `null`                | `null`                                      |
| `deleteTypeWarning`     | "We could not check…" | "…for good. This cannot be undone."         |
| `deleteTypeRowNote`     | "We could not check…" | "Removes the type and its fields for good." |

On screen now, every one of the eleven rows reads.

## The section called one thing three names

[[389]] recorded this and left it, because picking one word is a decision about
the whole section rather than a rename in passing. It is decided here.

| screen                       | said      |
| :--------------------------- | :-------- |
| Kinds of content, the list   | Key       |
| Kinds of content, the editor | Id        |
| Tags and topics, the list    | Reference |
| Tags and topics, the editor  | Reference |

**Reference**, because it is the only one of the three that says what the thing
is FOR rather than what a database calls it, and because [[385]] already settled
the twin pane on it and explained why. The search box offered "Name or id…" for a
word the screen no longer used; it now says "Name or reference…".

The word and its one-sentence explanation live in `reference-word.ts` and all
four screens import them, so a fifth screen cannot invent a fourth name without
deliberately not importing it.

## sparx

The same conflation, in the same three places, plus one more: its counts map
carried only the **site** number, so its Delete warning said "3 entries use this
type" over a refusal that counts 21. The endpoint already served `allSitesCount`;
sparx simply never read it. Mirrored in full.

sparx keeps **Key** and **Id** — its vocabulary is the platform's by design, and
the Piggles rename is a Piggles decision.

## Guard

`content-type-usage-words.test.ts`, **12 tests** in each console. The two that
are rules:

```ts
it('says so, instead of leaving the cell blank', …)
  expect(entriesHereLabel(map, 'testimonial')).toBe('No entries yet');

it('never says "for good" while the numbers are still unknown', …)
  expect(line).toContain('could not check');
```

Proved red by putting the `?.get()` shape back: **2 of 12** fail, and they are
those two.
