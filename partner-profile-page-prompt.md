# Task — public partner profile pages at `/partners/[slug]`

Build the public partner profile route the partner program has always been specified to
have (docs/114 §B.6 lists `/partners/:id`) and never got. Use a **slug**, not a UUID.

This is a **full vertical slice**: Prisma migration → service → API → marketing data layer →
page → links. Ship all of it. It is not done until a real partner row resolves at
`/partners/<their-slug>` and the directory links to it.

---

## Hard constraints (read these first — they will bite)

- **Do NOT run `prisma migrate`, `prisma db push`, or `prisma generate`.** The docker
  Postgres and the generated client are shared with a running dev stack and other agents.
  Author the migration and all dependent code **as files only** and hand off. Code that
  references the new `slug` field will not typecheck until the user regenerates the
  client — **that is expected**; say so in your report rather than working around it.
- **Migration directory names must be MONOTONIC.** Prisma orders lexicographically and
  this repo's hand-authored prefixes run ~6 months ahead of the wall clock. The newest
  existing migration is `packages/db/prisma/migrations/20270131000000_silica_class_vocabulary`.
  Yours **must sort after it** — use `20270201000000_partner_slug`. CI enforces this
  (`scripts/check-migration-order.mjs`). Do not let `migrate dev` name it for you.
- **RLS is hand-written SQL, not Prisma-generated.** The partner policies live in
  `packages/db/prisma/migrations/20261003000000_partner_program/migration.sql`
  (`partners_visibility`). Read it before touching anything that reads partners publicly.
- **Do not commit or push.** Leave everything in the working tree and report changed files.
- **Do not start or restart the dev server.** Verify with typecheck / lint / curl against
  the already-running stack (marketing is on **:3003**, api-rest on **:3100**).
- Read **`CLAUDE.md`** and **`packages/db/CLAUDE.md`** before you start. The design rules
  in CLAUDE.md (RULE #1–#4) are binding on the page you build.

---

## Current state — verified, do not re-derive

**Model** — `packages/db/prisma/schema/83-partners.prisma`, `model Partner`:

- `id` uuid PK, `tenantId` uuid (unique — one partner per tenant)
- `displayName` VarChar(255), `bio` VarChar(2000), `websiteUrl`, `kind`, `photoUrl`
- `locationCity` / `locationState` / `locationCountry` / `isRemote`
- `specialties String[]` (real Postgres `text[]`)
- `tier` (`informal|registered|certified`), `status` (`pending|active|suspended`)
- `directoryVisible Boolean @default(true)`
- `referralCode` VarChar(32), globally unique via `@@unique([referralCode], map: "partners_referral_code_unique")`
- **There is no `slug` column.** That is the gap.

**API** — `services/api-rest/src/routes/v1/public/partners.ts`:

- `GET /v1/public/partners` → faceted list
- `GET /v1/public/partners/:id` → **`z.string().uuid()`**, calls `directoryService.getPartner(id)`
- `POST /v1/public/partners/apply`
- The `/v1/public/` prefix skips Bearer auth (see `app.ts`); the directory runs under
  `withSystem` so the `partners_visibility` RLS policy applies.

**Service** — `services/api-rest/src/lib/partners/`:

- `directory.ts` → `getPartner(id)` filters `status: 'active', directoryVisible: true, deletedAt: null`
  and maps through `toPartnerCard()`.
- `service.ts` → `provisionForTenant()` is where a partner row is created; it already mints
  `referralCode: await uniqueReferralCode(tx)` (see `uniqueReferralCode` at ~line 88 — the
  retry-loop shape to copy). `updateProfile()` (~line 157) is where a partner renames itself.
- `bootcamp-service.ts` (~lines 20–39) already has **exactly the helper pair you need**:
  `slugify()` (NFKD normalize → non-alphanumeric to `-` → trim → 120 chars → fallback) and
  `uniqueSlug(tx, title)` (6 attempts, `randomBytes(2)` suffix, then `randomBytes(4)`).
  **Mirror these for partners rather than inventing a second convention.**

**Marketing data layer** — `apps/web/lib/partners.ts`: server-only, reads
`SPARX_API_REST_URL` (default `http://localhost:3100`), unwraps a `{success, data}` envelope,
`next: { revalidate: 300 }`, and **degrades to empty on any error so pages still render**.
Exports `PartnerCard`, `PartnerProfile extends PartnerCard` (adds `locationCountry`,
`headline`), `TIER_META`, `partnerLocation()`. Neither type has a `slug`.

**Marketing routes** — `apps/web/app/partners/` has `page.tsx`, `directory/`,
`opengraph-image.tsx`, `twitter-image.tsx`, `actions.ts`. **No `[slug]` route exists.**

---

## What to build

### 1. Migration — `packages/db/prisma/migrations/20270201000000_partner_slug/migration.sql`

- `ALTER TABLE partners ADD COLUMN slug varchar(160);`
- **Backfill every existing row** from `display_name` using the same rules as `slugify()`
  (lowercase, non-alphanumeric → `-`, trim leading/trailing `-`). Collisions must be
  resolved deterministically in SQL — append a short suffix derived from the row (e.g. the
  first 6 chars of `id`) for the 2nd+ row of any duplicate base. Do not leave nulls.
- Then `ALTER COLUMN slug SET NOT NULL` and add `CREATE UNIQUE INDEX partners_slug_unique ON partners (slug);`
- Order matters: add nullable → backfill → set not-null → unique index. A single
  `ADD COLUMN ... NOT NULL UNIQUE` will fail on any table with rows.
- **Check `packages/db/CLAUDE.md` for the FORCE-RLS backfill footgun** before writing the
  UPDATE — a plain `UPDATE` inside a migration on an RLS-forced table can silently affect
  zero rows. Follow whatever that doc says; do not guess.

Mirror the column into `83-partners.prisma`:

```prisma
slug String @db.VarChar(160)
// … and in the block-level attributes:
@@unique([slug], map: "partners_slug_unique")
```

### 2. Service

- Add `slugify()` / `uniquePartnerSlug(tx, displayName)` to
  `services/api-rest/src/lib/partners/service.ts` (or a shared helper both it and
  `bootcamp-service.ts` import — **preferred**, but do not refactor bootcamps' behaviour).
  Fallback base string should be `'partner'`, not `'bootcamp'`.
- `provisionForTenant()` must set `slug: await uniquePartnerSlug(tx, input.displayName)`
  on create, right beside the existing `referralCode` mint. **Do not** change the slug in
  the `existing` re-provision branch — a slug is a permanent public URL.
- `updateProfile()`: a rename must **NOT** change the slug. A public URL that moves when
  someone edits their display name breaks every inbound link and every share card. If you
  think the slug should ever be editable, say so in your report and leave it immutable.
- `directory.ts`: add `getPartnerBySlug(slug)` with the identical
  `status: 'active', directoryVisible: true, deletedAt: null` guard. Also add `slug` to
  `toPartnerCard()`'s output and to its input type.

### 3. API

In `services/api-rest/src/routes/v1/public/partners.ts`, add:

```
GET /v1/public/partners/slug/:slug   → directoryService.getPartnerBySlug(slug)
```

A separate path segment, **not** a union param — `:id` is `z.string().uuid()` and
overloading it to accept both means a malformed uuid silently becomes a slug lookup.
Keep the existing `:id` route working (internal callers may use it). Validate with
`z.string().min(1).max(160).regex(/^[a-z0-9-]+$/)`. 404 via `notFound('Partner', slug)`.

### 4. Marketing data layer — `apps/web/lib/partners.ts`

- Add `slug: string` to `PartnerCard`.
- Add `fetchPartner(slug: string): Promise<PartnerProfile | null>` using the existing
  `getPublic()` helper. It must return `null` (not throw) on 404 or on any failure, so the
  page can call `notFound()` itself.

### 5. The page — `apps/web/app/partners/[slug]/page.tsx`

**Read these three files first and match them exactly.** They are the current house pattern
and were rebuilt this week:

- `apps/web/components/marketing/band.tsx` — the `<Band>` section shell (`tone`,
  `flush`, `bleed`). **Every section is a `<Band>`.** Do not hand-roll `<section>`.
- `apps/web/app/partners/directory/page.tsx` — band rhythm, empty states, metadata shape.
- `apps/web/app/partners/directory/_components/partner-card.tsx` and
  `_components/specialties.ts` — **reuse `specialty()` for the module-hued tags.**

Requirements:

- `generateMetadata()` — title/description from the partner, `alternates.canonical`, and an
  **absolute** `openGraph.url` (`https://sparx.works/partners/<slug>`). A bare path makes
  LinkedIn de-duplicate the share against the homepage; that bug has already been fixed
  twice on this site.
- `generateStaticParams()` is **not** appropriate (the directory is live data) — use
  `export const revalidate = 300` like every sibling route.
- `notFound()` when `fetchPartner` returns null.
- An `opengraph-image.tsx` for the route. **Satori cannot resolve CSS custom properties** —
  import the literal hexes from `MODULE_HEX` / `BRAND` in `@sparx/brand`. This is one of
  only two sanctioned literal-hex contexts in the whole repo.
- **JSON-LD**: emit a `schema.org` `ProfessionalService` (or `Organization`) block
  server-side. `/bootcamp/[slug]` already does `Event` JSON-LD — match that approach.
- Link back to `/partners/directory` and out to the partner's `websiteUrl`
  (`target="_blank" rel="noopener noreferrer"`).

### 6. Wire it up

- `apps/web/app/partners/directory/_components/partner-card.tsx`: the partner **name**
  becomes a link to `/partners/${partner.slug}`. Keep the external "Visit their site ↗"
  link as a separate action — they go to different places and both matter.
- `apps/web/components/marketing/partners/directory.tsx` (the aside on `/partners`): same.
- `apps/web/app/sitemap.ts`: include published partner profiles. Check how it already
  awaits published bootcamps and follow that.

---

## Design rules that are binding on the page (non-negotiable)

These are from `CLAUDE.md` and have caused rejected work on this exact page family:

- **silicaui first, Tailwind utilities second, nothing else.** No new dependency, no bespoke
  CSS, **no inline `style` prop**. `apps/web/app/marketing.css` still holds legacy `.mkt-*`
  classes — **do not add to it**; several were deleted this week.
- **Body text floor is 16px** (`text-md`). `text-sm` is for genuine captions only. The old
  partner pages were riddled with 14px body copy.
- **Selection / emphasis is a FILLED shape, never a pale one.** Three separate places in
  the partner surfaces had `variant={on ? 'soft' : 'outline'}` — i.e. the active thing was
  the palest thing. Do not reintroduce it.
- **`soft` badges and buttons are effectively broken on light hues.** Measured on the live
  site: `badge-warning badge-soft` = 1.66:1, `badge-module-crm badge-soft` = 2.15:1 — silica
  paints the label in the raw accent over a 15% tint of the same accent. See
  `docs/silicaui/02-core-asks.md` §2. **Use `variant="solid"`** (the `--color-<c>` /
  `--color-<c>-content` pair measures 4.6:1–8:1) and do not paint a text colour on top.
- **Module hues are fills, not inks.** `text-module-crm` on white measures 2.4:1. To show a
  hue at size, fill a shape and write in its paired `-content`. `bg-*` does **not** bring
  its `-content` along — always write both.
- **No eyebrows** (nothing above a heading to introduce it — no kicker, no `01/02/03`, no
  `<Badge>` in that slot), **no shadows**, **no gradients**.
- **Neutral must be earned.** A screen where everything is grey is a failure, not a safe
  default.
- Audience is **non-technical business owners** — see `docs/141-marketing-page-system.md`
  §2 for the voice rule and the jargon translation table. `/partners` is not exempt.

## A footgun that has bitten three times on these exact pages

**JSX silently drops the space between `{expr}` and the text after it** when prettier wraps
the line or the text contains an HTML entity. It shipped `How Builderworks →` on nine
`/features` cards, `$186a month` on `/partners`, and `Certified1` / `B2B1` / `SEO1` across
the directory facet bar. Typecheck and lint cannot see it.

**Build one interpolated string** — ``{`${label} · ${count}`}`` — instead of relying on
JSX whitespace between children, and use literal `—` / `→` rather than `&mdash;` / `&rarr;`
when an expression shares the line. Then **scan the rendered page**, not the source:

```bash
curl -s http://localhost:3003/partners/<slug> \
  | python -c "import sys,re; h=sys.stdin.buffer.read().decode(); \
      t=re.sub(r'<[^>]+>',' ',re.sub(r'<!-- -->','',h)); \
      print(sorted(set(re.findall(r'[a-z]{3,}[A-Z][a-z]{3,}|\d[a-z]{2,}', t)))[:15])"
```

---

## Definition of done

1. `pnpm --filter @sparx/web exec tsc --noEmit -p tsconfig.json` — clean, **or** failing
   only on `slug` not existing on the generated Prisma client (report this explicitly).
2. `pnpm --filter @sparx/web exec eslint app/partners components/marketing/partners` — clean.
3. `pnpm --filter @sparx/api-rest exec tsc --noEmit` — same caveat.
4. `npx prettier --check` on every file you touched.
5. `node scripts/check-migration-order.mjs` passes.
6. The rendered-HTML scan above returns no glued words.
7. Report: changed files, **the exact command the user must run to apply the migration**,
   and anything you could not verify because you could not touch the database.

## Report honestly

If something cannot be done without running Prisma, say so plainly and leave it. Do not
invent partner data to make a page look populated — the previous version of the directory
aside shipped three fabricated agencies ("Northlight Studio", "Austin, TX") to a public
page, and removing that was part of this week's work. An empty state is the correct answer
when there is no data.
