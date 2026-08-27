# 270 — Three of her page types said "Not live yet" while they were serving

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — working through the page list
**Surface:** mypiggles › My Site › Page (the list)
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Her page list, with the pages she has built by hand all reading **Live**:

```
Each blog post     One page per record   Record template   Not live yet
Each collection    One page per record   Record template   Not live yet
Each category      One page per record   Record template   Not live yet
```

All three are live. Every one of these answers with a real page today:

```
/blog/the-case-for-fewer-clothes   200
/collections/new-in                200
/category/tops                     200
```

A record template that has never been saved renders the standard design, and the
standard design IS her site's blog post, collection and category pages. "Not live
yet" said the opposite of the truth about three of the five kinds of page she has.

## Why it matters

- **The badge is the whole answer to "is my site finished?"** An owner clearing a
  punch list reads the Status column and nothing else. Three amber rows say
  "three things left to do" when the answer is zero.
- **It pushes toward a change that could make things worse.** The obvious
  response to "Not live yet" is to press Publish. Whatever "Each blog post"
  happens to hold at that moment then becomes the permanent version of every
  post page.
- **The product already says the right thing, one click away.** Open any of these
  three and the editor's own footer reads:

  > "This is the page your visitors see. Save it to make it yours."

  Two screens, two opposite claims, and the wrong one is the one you see first.

## The same bug, already fixed once, in the same file

[page-address.ts](../../../apps/workbench/surfaces/studio/page-address.ts)'s
`addressOf` carries this comment:

> "The home page's address is the site itself, and it used to read 'No address
> yet' — a page telling its owner nobody can reach it while the column beside it
> said 'Home page'."

Identical shape: a column reporting absence about a page that is plainly present,
contradicted by the column next to it. The address half was fixed. The status
half went on saying it.

## The fix

`statusOf(page)` replaces the inline `published ? … : …`:

| what it is                        | badge                             |
| --------------------------------- | --------------------------------- |
| published                         | **Live** (success)                |
| a record template, never saved    | **Live · standard design** (info) |
| an ordinary page, never published | **Not live yet** (warning)        |

The middle row is the whole point, and both halves of it earn their place: **Live**
because it is, and **standard design** because that is the reason she might still
want to open it. Its tone is `info` rather than `warning` — this is a fact about
the page, not a job outstanding.

## Confirmed

Her list now reads Live on seven rows and **Live · standard design** on the three
templates, and nothing on her site claims to be missing. Workbench typechecks;
prettier and eslint clean.

## Related

[[feedback_never_present_absence_as_measurement]] — the sharpest instance yet,
because nothing here was unmeasured. The page was serving, the status column
simply asked the wrong question of the row: "has the owner overridden this?"
rendered as "can anybody see this?".

Same family as [263]: the platform's own default doing a job, and the console
describing it as a gap.

## Rating effect

The page list, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
