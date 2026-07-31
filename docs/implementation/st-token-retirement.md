# Retiring `st-*` and `--sx-*` — tokens and classes

**Version:** 5.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-31

---

> **THE GOAL: `st-*` and `--sx-*` cease to exist — tokens AND classes.** silicaui is the one design
> system; a parallel vocabulary beside it is the defect, not untidiness. **Never reintroduce a
> parallel token or class set, in any direction, including a "one-way alias" — that was tried and
> rejected (§4 Step 3).**
>
> · **`--st-*` TOKENS: done.** Not emitted, not aliased, not derived.
> · **`st-*` CLASSES: done.** `packages/site-ui` is deleted; the render path emits silicaui's own
> classes; the persisted-data migration is written (§4 Step 4). Every remaining repo match is prose
> explaining the removal, or a test asserting the vocabulary is absent.
> · **`--sx-*` TOKENS: done (§7).** `--sx-sel` / `--sx-sel-fg` are gone, along with the six
> `@sparx/ui` controls that hand-rolled Radix versions of components silicaui now ships and the
> `colorVars()` helper that fed them. What remains under an `sx-` prefix — `data-sx-*` and ~13 CSS
> classes — is **not** the same problem, and §7 gives the test for telling them apart.
>
> **Two things are still open — see §6:** the persisted-data migration has not run yet, and one
> inline style is awaiting Brandon's call.
>
> **One thing to raise upstream:** silicaui's `.checkbox` has no `:indeterminate` styling (§7).

This is now the single tracking doc for both halves. [st-removal-handoff.md](st-removal-handoff.md)
is the earlier, narrower brief (migrating `apps/site`'s own components off `st-*`); it is largely
landed and superseded by §4 Step 4 here.

§1–3 are the token diagnosis, written in the present tense of the bug and kept because the failure
mode generalises: two vocabularies for one thing, bridged in contradictory directions, so which one
wins comes down to stylesheet source order. That is the shape to recognise, whatever it is next
called. §2's inventory is likewise the pre-work count, kept as the record of what was removed.

---

## 1. Why this is a bug, not a cleanup

[layout.tsx:294](../../apps/site/app/layout.tsx#L294) already states the intent:

> Coexists with `themeCss` during the parallel run; `--st-*` retires at the flip.

The flip never happened, so the storefront ships **two** concrete token payloads on every request
([layout.tsx:440-442](../../apps/site/app/layout.tsx#L440-L442)):

| Injected                                          | Emits                | Sourced from                                                          |
| ------------------------------------------------- | -------------------- | --------------------------------------------------------------------- |
| `themeCss` (`buildThemeCssV2`)                    | concrete `--st-*`    | brand columns + `draftSettings.tokens` (v1 overlay) + v2 presentation |
| `silicaThemeCss` (`buildSilicaThemeCssFromTheme`) | concrete `--color-*` | the **authored** silica theme (or `BASE_SILICA_THEME`)                |

…and three separate bridges alias one vocabulary onto the other, in **contradictory directions**:

| File                                                                                             | Declares                             | Layer              |
| ------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------ |
| [globals.css:33-82](../../apps/site/app/globals.css#L33-L82) (`@theme`)                          | `--color-primary: var(--st-primary)` | `@layer theme`     |
| [globals.css:89-111](../../apps/site/app/globals.css#L89-L111) (`:root`)                         | `--color-primary: var(--st-primary)` | **unlayered**      |
| [surface-compile/theme.ts:24-41](../../packages/surface-compile/src/theme.ts#L24-L41) (`@theme`) | `--color-primary: var(--st-primary)` | `@layer theme`     |
| [site.css:25-34](../../apps/site/app/site.css#L25-L34) (`@layer st-legacy`)                      | `--st-primary: var(--color-primary)` | `@layer st-legacy` |

### 1.1 The two concrete failures

**A. Colour is a source-order race.** [globals.css:89-111](../../apps/site/app/globals.css#L89-L111)
is an **unlayered** `:root` block — the same weight as the injected `silicaThemeCss` `:root`. Whether
the authored theme or the legacy brand compile wins depends on whether the app stylesheet `<link>` or
the inline `<style>` lands last in `<head>`. That is the "switched theme, kept the old primary"
symptom.

That block's own comment says it exists because `@sparx/ui/tokens.css` sets brand `--color-*` in an
unlayered `:root`. **That is no longer true** — the silicaui migration removed the colour half of
`packages/ui/src/tokens.css` (it now only _reads_ `--color-module*`). The block is obsolete and is now
purely the thing that beats the tenant's real theme.

**B. Fonts are a deterministic loss.** [globals.css:78-79](../../apps/site/app/globals.css#L78-L79)
maps `--font-heading` / `--font-body` onto `--st-font-heading` / `--st-font-body`.
[silica-css.ts:102-111](../../packages/site-themes/src/v2/silica-css.ts#L102-L111) **deliberately
refuses** to emit `--font-head` so an authored theme's heading choice survives — which leaves the
legacy `--st-font-*` values completely unopposed. A theme swap therefore _never_ changes site fonts.

Reported symptom (2026-07-31, template tenant): after `apply_saved_theme`, the v2 presentation held
the new pine palette while the site kept `colorPrimary: "#4F46E5"`, `fontHeading: "Space Grotesk"`,
`fontBody: "Inter"`. Both mechanisms above explain it exactly.

---

## 2. Inventory

~985 occurrences of `--st-`, very unevenly distributed:

| Area                                                       | Count | Notes                                                                |
| ---------------------------------------------------------- | ----- | -------------------------------------------------------------------- |
| `packages/site-ui`                                         | ~500  | the parallel `st-*` component library; only 3 exports still consumed |
| `apps/site/app/site.css`                                   | 109   | the `st-legacy` layer + bespoke composites                           |
| `packages/section-template-react/src/section-template.css` | 66    | reads `--st-space-*` throughout                                      |
| `packages/site-themes/src/v2/css.ts`                       | 65    | the `--st-*` emitter                                                 |
| `apps/site/app/globals.css`                                | 54    | the two bridge blocks                                                |
| `packages/surface-compile/src/theme.ts`                    | 38    | compiled into **every** builder surface stylesheet                   |
| `packages/site-themes/src/tokens.ts`                       | 14    | the v1 `TOKEN_CSS_VARS` dual-write map                               |

---

## 3. The non-silica render path — resolved, not assumed

`silicaThemeCss` used to be `''` when `silicaActive` was false, and such a site would have rendered
entirely on `--st-*`. That made "is every served site silica-active?" a load-bearing assumption.
[silica.ts:212-235](../../apps/site/lib/silica.ts#L212-L235) argued yes — `getPublishedSilicaFrame`
falls back to the code starter frame, "so the storefront ALWAYS wears silica chrome".

Rather than rest on it, the gate was **removed**: the theme, the web fonts and the accent colour all
resolve from `silicaFrame.theme ?? BASE_SILICA_THEME` unconditionally. There is no branch left to get
wrong and no page that can render unthemed. Don't reintroduce the gate.

---

## 4. Plan

### Step 0 — the two data bugs (independent of the token work) ✅

- [x] **`apply_saved_theme` leaves `draftSettings.tokens` stale.**
      [saved-theme-service.ts](../../packages/sitebuilder/src/services/saved-theme-service.ts) `apply()`
      spreads `...draft` and overwrites only `presentation` + `activeSavedThemeId`; the v1 `tokens`
      overlay survives and still feeds `compileTokens()` at
      [publish-service.ts:291](../../packages/sitebuilder/src/services/publish-service.ts#L291).
      Fix: **clear** it on apply (it is the layer being retired — do not teach apply to rewrite it).
- [x] **`update_site_settings.settings` replaces wholesale.**
      [theme-service.ts:114](../../packages/sitebuilder/src/services/theme-service.ts#L114) assigns
      `draftSettings: input.settings`, so sending `{tokens}` alone silently drops `presentation` and
      `activeSavedThemeId`. Fix: top-level merge over the existing draft.

### Step 1 — collapse the bridge directions ✅

- [x] Delete the obsolete unlayered `:root` block in
      [globals.css](../../apps/site/app/globals.css). The stated reason for it
      (`@sparx/ui/tokens.css` asserting brand colours unlayered) no longer holds. **This is the fix
      for failure A** — colour now has exactly ONE unlayered declaration on the storefront, the
      injected theme.
- [x] Point `--font-heading` / `--font-body` in [globals.css](../../apps/site/app/globals.css) at
      `--font-sans` instead of `--st-font-*`. **This is the fix for failure B.** Also dropped the
      self-referential `--font-sans: var(--font-sans)` / `--font-mono: var(--font-mono)`, which
      resolved to nothing.
- [x] Retarget [surface-compile/theme.ts](../../packages/surface-compile/src/theme.ts) onto silica's
      `--color-*` / `--radius-*` / `--font-*`, so builder-authored surfaces compile against the same
      vocabulary the storefront injects. Its fallback values interpolate from `BASE_SILICA_THEME`
      rather than duplicating a palette — this adds `@sparx/silica-catalog` as a dependency
      (**needs `pnpm install`**). Shadows now ride silica's `--depth`, and `--spacing` anchors to the
      standard `0.25rem` (silica has no tenant-rescalable spacing unit — docs/118).
- [x] Retarget the `.st-hover--*` shadow tints in
      [surface-compile/motion.ts](../../packages/surface-compile/src/motion.ts) onto
      `--color-neutral` / `--color-primary`.

### Step 2 — stop emitting `--st-*` ✅

- [x] Stop injecting `themeCss` in [layout.tsx](../../apps/site/app/layout.tsx); delete
      `apps/site/lib/theme.ts`. `silicaThemeCss` is now emitted **unconditionally** rather than gated
      on `silicaActive` — with the legacy payload gone, gating would mean a page rendering unthemed,
      and resolving `silicaFrame.theme ?? BASE_SILICA_THEME` everywhere removes the branch entirely.
- [x] Replace the `@theme` colour registrations in [globals.css](../../apps/site/app/globals.css)
      with an `@import` of [base-theme.css](../../packages/silica-catalog/src/base-theme.css) — a CSS
      projection of `BASE_SILICA_THEME`, kept honest by
      [base-theme.css.test.ts](../../packages/silica-catalog/src/base-theme.css.test.ts) (fails on any
      key or value drift). They are needed because Tailwind's **namespaced** utilities
      (`ring-primary`, `ring-offset-base-100`, `from-primary`, `divide-base-300` — all really used)
      only generate for colors declared in `@theme`; silicaui's plugin registers nothing there.
      Radius is NOT declared: silicaui emits `rounded-box`/`-field`/`-selector` itself.
- [x] Delete the `st-legacy` token block + the `--color-*: var(--st-*)` reverse bridge from
      [site.css](../../apps/site/app/site.css) (566 → 413 lines), plus the `.st-h1/2/3`,
      `.st-eyebrow`, `.st-muted` type utilities. Call sites moved to the silica scale.
- [x] Remap [section-template.css](../../packages/section-template-react/src/section-template.css)
      (66 refs) onto silica tokens.

### Step 3 — delete the machinery ✅

- [x] Remap **all ~500 `--st-*` reads in `packages/site-ui`** onto silica tokens directly. The built
      `dist/styles.css` now contains zero `--st-*` and reads `var(--color-primary)` et al.
- [x] Delete `v2/css.ts` (the `--st-*` emitter), `v2/legacy.ts` (the v1→v2 bridge feeding it), their
      tests, and the `TOKEN_CSS_VARS` / `tokensToCssVars` / `tokensToCss` half of `tokens.ts`.
- [x] Remap [email-leaf.tsx](../../packages/builder-render/src/email-leaf.tsx) (the only other live
      consumer) and correct the MCP `classVocabulary` strings in
      [vocabulary.ts](../../packages/builder/src/mcp/vocabulary.ts), which described the retired
      vocabulary to agents.

**A rejected approach, recorded so it is not retried.** The first attempt at `site-ui` gave the
package its own `tokens.css` deriving `--st-*` from silica one-way. That is still a parallel
vocabulary — it just moves ownership. The point of silicaui is that there is ONE token set; an alias
layer re-adds the indirection the whole exercise exists to delete. Remap the rules, don't bridge them.

### Step 4 — the `st-*` CLASS vocabulary ✅

Decision (Brandon, 2026-07-31): kill `st-*` entirely, classes included. The token work above removed
the second SOURCE OF TRUTH; this removes the second VOCABULARY. `--sx-*` was queued next on the same
grounds, sized here at "**29 token refs + 196 `sx-` classes**" — a stale count from before the
silicaui migration. §7 has the real one and the outcome.

Starting count 2769 `st-*` class occurrences: 1885 inside `packages/site-ui` (which dies with the
package), 884 in consumers.

- [x] **The builder catalog** (`builder-schemas/src/catalog/*.ts`) — all 48 distinct recipe strings
      replaced. `st-btn st-c-<color> st-v-<treatment> st-btn--sz-<size>` → `btn btn-<color>
btn-<treatment> btn-<size>`; badges → `badge badge-*`; fields → `input-*`. Zero left.
- [x] **Platform classes renamed off `st-`** onto the builder's existing `bx-` prefix (they were never
      site-ui's; the `st-` name was the accident): `st-fixed-*`, `st-toc__*`, `st-reveal*`,
      `st-anim-ready`, `st-in`, `st-hover--*`, `st-tpl-*`.
- [x] Fixed three **emitter/consumer mismatches** the rename exposed, each of which fails silently:
      `section-renderer.tsx` wrote `data-st-reveal`, `layout.tsx`'s `REVEAL_INIT_SCRIPT` added
      `st-reveal-ready`/`st-anim-ready`, and MCP `vocabulary.ts` instructed agents to author
      `st-reveal` / `st-hover--*`. **Always grep for the emitter after renaming a behaviour class.**
- [x] **Ported `@sparx/builder-render` off `@sparx/site-ui`.** The blast radius turned out to be small:
      only `apps/site` consumed either package (the dashboard canvas that used to is gone, and the
      workbench builder studio never used them). Every other repo hit was a comment.
- [x] **Collapsed the recipe bridge.** `recipeFromClass` parsed `st-c-*` / `st-v-*` / `--sz-*` back
      out of the class to feed typed props, because the vocabulary and the props were two spellings
      of one thing. Under silica there is one spelling, so ~30 lines of parser + six cast helpers
      became `rootClass(base, leafClass)`: the node's class IS the recipe, and the only remaining job
      is guaranteeing the base class for a node authored before the class-first catalog.
- [x] **Built the sparx components for the gaps** (Brandon, 2026-07-31 — build them on silicaui rather
      than keep site-ui for them), in
      [packages/builder-render/src/atoms/](../../packages/builder-render/src/atoms/). Its
      `index.ts` states the bar for adding one: silica has no equivalent AND the difference is real —
      a different mechanism (`ThemeToggle` needs a cookie, not localStorage, so the server can resolve
      the mode without a flash), a different owner (`SocialLinks` draws other companies' marks), or a
      constraint from builder NODES (`NavShell` must render its children exactly once because a node
      id is also a dnd-kit sortable id). "silica's version looks slightly different" is not on it.
- [x] **Deleted `packages/site-ui`** + its stylesheet import, its `apps/site` dependency, its
      Dockerfile build step, and the `Sparx*` rows in the app's jsx-a11y map.
- [x] **Deleted `packages/db/scripts/backfill-sf-to-st.ts`** and unregistered `db:backfill:sf-to-st`.
      It renamed `sf-` → `st-`; leaving it runnable left a one-command path back to the vocabulary
      this doc exists to remove.

Three deliberate behaviour changes came with the port, each fixing a rule violation rather than
reproducing it: the floating nav panels lost their drop shadow (no-shadows), `Text variant="meta"`
got smaller instead of fainter (RULE #3), and the nav panels became mobile-first — in flow on a narrow
frame, floating once wide — so a dropdown behaves correctly wherever it is dropped rather than only
inside a `NavShell`. The frame container query was renamed `st-frame` → `bx-frame`, and the storefront
cascade layer `st-legacy` → `bx-legacy`.

### The persisted-data migration ✅

The catalog is **stamped (forked) into tenant pages**, so `st-btn st-c-primary st-v-solid
st-btn--sz-md` is **persisted in `BuilderNode` trees in the database** — draft AND published, across
pages, layouts, blocks, components and archetypes. New stamps are clean; existing tenant pages were
not, and serving them without site-ui's CSS would render every button unstyled.

[20270131000000_silica_class_vocabulary](../../packages/db/prisma/migrations/20270131000000_silica_class_vocabulary/migration.sql)
rewrites them in place. It is family-aware — `st-c-primary` is `btn-primary` on a Button and
`badge-primary` on a Tag — so it maps `node.type` to the silica family first, then rewrites token by
token, preserving Tailwind utilities and `bx-*` behaviour classes verbatim. Idempotent: it only ever
consumes `st-` tokens and emits none.

Two colours have no silica counterpart and are handled explicitly: `surface` is dropped (on a button
`st-v-glass` → `glass` is what actually produced that look), while `danger` and `highlight` carry
through because both ARE registered with the plugin in each app's `globals.css`.

It covers pages, layouts, emails, email blocks, component versions and archetypes per tenant, plus
the platform-scoped `platform_components`. It deliberately skips the manifest tables (reference lists,
not trees) and the silica page/email documents (authored in silica's vocabulary from the start).
**Prod** runs through the pipeline, not a laptop ([packages/db/CLAUDE.md](../../packages/db/CLAUDE.md)).

#### Applied to local dev, and what that run taught

Applied to the docker DB 2026-07-31 (241 migrations, this one last). Before: **159 of 1097** builder
rows across 67 tenants carried `st-`. After: **zero** `st-` class tokens anywhere.

Three things the run changed about the migration itself, none of which the synthetic fixture caught:

1. **The UPDATEs were unguarded.** The tree walker rebuilds a node's `children` array
   unconditionally, so a clean row still gets rewritten to a byte-identical value. Without a `WHERE`
   the migration would have touched all 1097 rows, and every future run would do it again. Guarded
   now.
2. **The guard has to be token-aware, not a substring.** `LIKE '%st-%'` matched 28 rows holding no
   `st-` class at all — `best-selling`, `fast-growing`, `first-time`, `list-none`, `/request-demo`,
   `Cast-iron` all contain the three characters. A class token can only start after a quote or a
   space, so the guard is `~ '["[:space:]]st-'`. On the migrated dev data that is 0 rows where the
   loose form is 28. Verified it still catches every real token, against a fixture seeded with those
   exact decoy strings.
3. **Local cannot prove the prod RLS path.** `sparx_owner` is a SUPERUSER on docker, so RLS is
   bypassed and a migration that forgot `set_config('app.tenant_id')` would pass here and update
   zero rows in prod — the failure mode [packages/db/CLAUDE.md](../../packages/db/CLAUDE.md) warns
   about. It was rehearsed separately in a throwaway Postgres with `sparx_owner` as a NON-superuser,
   FORCE RLS on, and the live policies copied in (`tenant_id = current_tenant_id()` for the builder
   tables, `platform_components_owner_all USING (true)` for the global one). All three tenants were
   reached and the global table converted. **If you write another data migration over these tables,
   rehearse it that way — a green local run is not evidence.**

Idempotency is now measured rather than asserted: a second full run changed **zero** `xmin` row
versions, decoy rows included.

### Step 5 — the v1 `tokens` overlay in the data model ⬜

- [ ] `SiteSettings.tokens`, the `compileTokens` draft/publish path, and the `{tokens:{light,dark}}`
      seed in [\_config.ts:26](../../packages/sitebuilder/src/services/_config.ts#L26).
      `SiteVersion.compiledTokens` is a **persisted DB column and a public API field**, so this is a
      schema + API change, not a styling one — deliberately out of the styling slices' scope.

---

## 6. State (2026-07-31)

**The `st-*` work is complete and verified.** `pnpm install` has run (two dependency edges changed:
`@sparx/surface-compile` gained `@sparx/silica-catalog`, and `@sparx/builder-render` swapped
`@sparx/site-ui` for `@wizeworks/silicaui-react`). Nothing is committed — it is all in the working
tree; Brandon commits.

Green across every touched package — typecheck + lint on `builder-render`, `builder-schemas`,
`apps/site`, `silica-catalog`, `surface-compile`, `site-themes`, `sitebuilder`, `builder`,
`sitebuilder-schemas`, `section-template-react`, `db`; tests 75 / 300 / 650 / 46 / 74 / 45 / 88;
`pnpm format:check` clean repo-wide.

### Still open

1. **The migration has run on LOCAL DEV only — prod is still pending.** 159 rows converted on docker,
   zero `st-` tokens left there. Prod applies when
   [20270131000000_silica_class_vocabulary](../../packages/db/prisma/migrations/20270131000000_silica_class_vocabulary/migration.sql)
   is pushed to `main` and the DB Migrate workflow picks it up. Until then, prod tenant content saved
   before 2026-07-31 renders its buttons unstyled. New stamps are already clean.
2. **One inline style awaiting Brandon's call** — the colour swatch in
   [commerce.tsx](../../packages/builder-render/src/commerce.tsx): `style={{ background:
val.swatchHex }}`. The hex is the merchant's own product-option value from the database, so no
   token can express it, but it is the only inline style left in the render path.

### The one deliberate survivor

`id="st-main"` in [silica-catalog/src/site.ts](../../packages/silica-catalog/src/site.ts). It is an
HTML anchor, not a class or a token, and it is advertised as the storefront skip-link target — a
tenant may already have authored a link pointing at `#st-main`, which renaming would break silently
for no gain. Documented in place so it doesn't read as a miss.

### Two things worth knowing before touching this area again

- **The storefront's Tailwind bundle only emits classes from sources it SCANS.** `builder-render`
  authors its layout as literal strings, so `apps/site/app/globals.css` now `@source`s
  `packages/builder-render/src/**`. Adding a component elsewhere without a matching `@source` ships
  correct markup with no layout at all — and nothing fails loudly.
- **Renaming a behaviour class means grepping for its emitter.** Three separate places wrote
  `data-st-reveal` / `st-reveal-ready` / told MCP agents to author `st-reveal`; a CSS-only rename
  fails silently in all three.

---

## 7. `--sx-*` — DONE (2026-07-31)

**`--sx-sel` and `--sx-sel-fg` no longer exist.** They were the last parallel token vocabulary in
the repo, and they are gone the same way `--st-*` went: the thing that needed them was deleted, not
aliased.

### The correction that made this small

Two earlier sizings of this phase were both wrong, in opposite directions.

- v1–v3 of this doc: "29 token refs + 196 `sx-` classes". Measured before the silicaui migration.
- v4 (written hours before the work): "`--sx-*` tokens: **0**. Already gone."

**v4's zero was a measurement bug, not a fact.** `rg -- '--sx-'` eats `--sx-` as a flag terminator
and returns nothing; the pattern needs `rg -e`. The real count was 48 refs. Worth remembering: a
grep for a token that starts with `--` silently returns clean.

### What it actually was

Not a token problem at heart — a **component** problem. Six `@sparx/ui` components hand-rolled
Radix controls that silicaui had since grown natively:

| `@sparx/ui`       | Consumers outside its own test | Silica equivalent            |
| ----------------- | ------------------------------ | ---------------------------- |
| `Slider`          | **0**                          | `Slider` / `Range`           |
| `RadioGroup`      | **0**                          | `RadioGroup` / `RadioOption` |
| `Card`'s `accent` | **0**                          | `bg-<color> bg-soft`         |
| `Progress`        | 2 (both inside `packages/ui`)  | `Progress`                   |
| `Switch`          | 2                              | `Switch`                     |
| `Checkbox`        | 3                              | `Checkbox`                   |

A Radix control can't take a plugin color class, so each one set a per-instance `--sx-sel` custom
property from a `colorVars(color)` helper and consumed it through `data-[state=checked]:bg-[var(--sx-sel)]`.
That was a reasonable bridge when it was written. It stopped being one the moment silica shipped
`checkbox-<color>` / `switch-<color>` / `progress-<color>`, at which point one accent had two
spellings and only stylesheet order decided which won — the same shape as the `--st-*` bug in §1.

**The call sites had already voted.** 45 of 47 `Switch` imports, 33 of 35 `Checkbox`, 6 of 8
`Progress` were pointing at `@wizeworks/silicaui-react` before this work started. The `@sparx/ui`
copies were stragglers, so this was deletion rather than migration.

### What changed

- **Deleted** `checkbox` / `switch` / `radio-group` / `slider` / `progress` (+ 4 test files) from
  `packages/ui`, and their five exports from the barrel. They are **not** re-exported — a wrapper
  would be a second name for one control.
- **Deleted** `colorVars()`. `_recipes/variants.ts` now exports `pluginColor()` instead: a slot name
  → its silicaui plugin color name (`commerce` → `module-commerce`). It returns a CLASS FRAGMENT,
  never a `var(…)` string, which is what keeps it from becoming `colorVars` again.
- **`<Card variant="module">`** now emits `bg-module bg-soft` — silica's universal `soft` treatment
  — instead of a hand-rolled 12% `color-mix` off `--sx-sel`. The tint percentage lives in silica
  now, so retuning it is one change there rather than a sweep here. The card sets **no inline style
  at all**; there is a test asserting that.
- **Re-pointed 6 consumers**: `selection-list`, `schema-field-renderer`, `bar-list`, `import-dialog`
  (all `packages/ui`), plus `triage-controls` and `module-switchboard` in `apps/admin`.
- **Dropped 4 now-unused deps** from `packages/ui/package.json`: `@radix-ui/react-{checkbox,switch,slider,radio-group}`.

### Two behaviour notes

**`onCheckedChange` → `onChange`.** Silica's `Checkbox` is a restyled native input, so its handler is
the native one. `Switch` is Base UI and kept `onCheckedChange`. They are not symmetric — check which
you are holding.

**A module color is `module-<name>` to the plugin, `<name>` to us.** `colorVars` resolved
`commerce` to `var(--color-module-commerce)`, a CSS variable that exists in `@sparx/brand/theme.css`
regardless of anything. A plugin CLASS only exists where the app registered it: workbench and web
register the full module palette, **admin and site register only `module`**. So the portable way to
color for a module is still `<ModuleProvider module="…">` + `color="module"`, and that is what
`module-switchboard.tsx` now does. `pluginColor()`'s doc comment says so at the point of use.

### One silicaui gap this surfaced

**`.checkbox` styles `:checked` but not `:indeterminate`.** Silica sets `appearance: none`, which
suppresses the browser's own dash, and nothing replaces it — so a tri-state checkbox paints exactly
like an unchecked one. The one place sparx needs it is `SelectionList`'s "select all" header, where
partial selection is a real third state.

`packages/ui/src/tokens.css` carries a single rule for it, written against silica's OWN `.checkbox`
class and its OWN `--checkbox-accent` / `--checkbox-content` vars — one platform-wide rule that
inherits whatever accent the color class set, not a call-site patch and not a new class. **Raise it
upstream; delete the block when silica ships it** (it will be redundant, never conflicting).

Separately: `indeterminate` is a DOM property with no HTML attribute, so it is unreachable from JSX.
`SelectionList` sets it through a callback ref (`setIndeterminate`).

### What is left, and why it is not the same problem

| What                | Count        | Same problem?                                                                                                                                                                                                              |
| ------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--sx-*` tokens     | **0**        | Genuinely zero now. Verified with `rg -e`, not `rg --`.                                                                                                                                                                    |
| `data-sx-*` markers | ~152         | **No.** The BEHAVIOUR runtime (`SX_ROLES` / `sxAttrs` / `BEHAVIOR_NAMES`, docs/98 Pillar 5). It names what a node DOES; silicaui has no equivalent, so there is no second vocabulary for it to compete with.               |
| `.sx-*` CSS classes | ~13 distinct | **No.** `sx-topbar*` (the module-spectrum loading bar), `sx-made-with-sparx`, `sx-silica-body`. Each is a sparx component silica does not have, and the prefix is namespacing it AWAY from silica's — the opposite defect. |

The test that separates them: **does silicaui have its own name for this thing?** If yes, ours is a
competing vocabulary and has to go. If no, the `sx-` prefix is doing its job. `--sx-sel` failed that
test the day `checkbox-primary` shipped. `.sx-topbar__bar` passes it.

So `sx-*` is closed. Renaming the survivors would be churn with nothing on the other side of it.

## 5. Verification

Per step, before commit:

- `pnpm --filter <pkg> run typecheck` + `lint`, `npx prettier --write <changed>`.
- A theme swap must change **primary, secondary, accent, base ramp, AND both fonts** on the live
  storefront — fonts are the token that silently didn't move before, so they are the regression
  canary.
- Builder canvas and published site must stay visually identical (they bridge through the same
  `@theme`, so a one-sided retarget shows up as a canvas/site divergence).
