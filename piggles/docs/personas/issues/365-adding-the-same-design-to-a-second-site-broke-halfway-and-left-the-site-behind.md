# 365 — Adding the same design to a second site broke halfway and left the site behind

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · doing what [363]'s new warning tells her to do
**Surface:** mypiggles › My Site › Ready-made sites › one design › Add it to a site
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** made Juniper Row Lookbook from Longform Literary, second site, 9 pages in

## What happened

[363] gave the pane an honest warning and told her what to do instead: add the design
to a different site. So she did.

She chose **A new site**, called it **Juniper Row Lookbook**, and pressed the button.
The site was made. The design was not. And the screen said nothing about either — it
sat on "A new site" with the name still in the box, now reporting:

> Juniper Row Lookbook already has that address. Pick another.

Which was true, because it had just made it. She has a new empty site she did not
mean to keep, a message telling her the name is taken, and no idea the design failed.

## Why it happened

Two separate faults, one visible failure.

### 1. The lookup was scoped narrower than the constraint

`blueprint-installer.ts` reconciles a design's authors and taxonomy per SITE:

```ts
const existing = await tx.author.findFirst({
  where: { tenantId, propertyId, slug: a.slug }, // per site
  select: { id: true },
});
```

The database says otherwise:

```
authors          UNIQUE (tenant_id, slug)
taxonomies       UNIQUE (tenant_id, key)
taxonomy_terms   UNIQUE (taxonomy_id, slug)
```

All three are per BUSINESS. A lookup narrower than its own constraint finds nothing,
then asks for a row the database refuses. So the second site got:

```
Invalid `tx.author.create()` invocation … Unique constraint failed
```

Longform Literary was already on her Sample Sale site, so its six authors existed.
Adding it anywhere else in the same business died on the first one.

This has nothing to do with the new-site option — it breaks on any second site, which
is precisely what the pane invites: _"Pick which site this design goes into. **You can
add it to more than one.**"_

The comment above it claimed "an Author / a term is per-publication", which is the
belief that produced the narrow lookup. It was never true of the schema. An author is
a **person** and a taxonomy is a **vocabulary**; both belong to the business rather
than to one of its websites, which is what those indexes have always said. Fixed by
reconciling on the key that is actually enforced, and correcting the comment.
`propertyId` is still stamped on a row this install creates, so whichever site
introduced one owns it; an existing row is reused as it stands and never repointed,
because another site's content may reference it.

### 2. The pane only pointed at the new site when the install SUCCEEDED

`newSite.settle(id)` ran inside `onSuccess`, so a failed install left the picker on
"A new site" with the typed name still in it — hence the "already has that address"
message about the site it had just made, and a `failed` install row on a site nothing
on screen pointed at.

Settling now happens the moment the site exists, before the install is attempted. The
error message says which half happened: **"Juniper Row Lookbook was made, but the
design did not go in."**

## Confirming it

With the picker pointing at the real site, the pane showed what it already knew how to
say:

> **Setup stopped on Juniper Row Lookbook**
> Something went wrong partway through adding this design. Remove it to clear what was
> started, then try again.

Removed it, pressed **Add "Longform Literary" to Juniper Row Lookbook**, and:

```
Juniper Row Lookbook      9 pages     install: installed
Juniper Row Sample Sale   9 pages     (untouched)
authors: 6 rows, no duplicates, all still owned by the site that introduced them
```

Second site, same design, nothing lost on the first. Which is what the pane has been
promising all along.

## Still open

- **A failed install leaves the site it made.** That is arguably right — she named it,
  and deleting somebody's site because a later step failed is worse — but nothing
  offers to tidy it up. The Remove action clears the install, not the empty site.
