# Handoff: install the 4 new templates live + capture preview screenshots

## Your job

On the **live deployed** sparx dashboard (more stable than the slow local dev server), do an end‑to‑end **install → go‑live → screenshot** pass for the four new marketplace templates, then wire each screenshot in as the template's `preview` image and re‑run the gate. Also fix the flagship's logo to match. **Do not push** — the user pushes manually.

## Background (what already exists, all UNPUSHED, gate‑green)

The "Templates" feature (internally **Blueprints**, docs/54) installs a whole themed site (brand+theme, pages, products, content, emails) onto the **active property** as drafts, then "Go live" publishes it. One flagship already shipped (`retail-store-blog`). This session added **4 new templates** and they're built, validated, and gate‑green:

| Template key       | Brand                   | Vertical | Theme preset | Mockup (design source)                    |
| ------------------ | ----------------------- | -------- | ------------ | ----------------------------------------- |
| `tattoo-studio`    | Ironleaf Tattoo         | services | apex         | `mockups/templates/tattoo-studio.html`    |
| `beauty-salon-spa` | Maren & Wilde           | services | drift        | `mockups/templates/beauty-salon-spa.html` |
| `antique-shop`     | Marrow & Hale           | retail   | market       | `mockups/templates/antique-shop.html`     |
| `auto-parts`       | Ironhaul Diesel & Fleet | b2b      | fleet        | `mockups/templates/auto-parts.html`       |

Files in play:

- `packages/blueprints/src/blueprints/{tattoo-studio,beauty-salon-spa,antique-shop,auto-parts}.ts` — the 4 manifests.
- `packages/blueprints/src/registry.ts` — registers all 5 templates.
- `mockups/templates/*.html` — the design mockups these were built from (open them to see the intended look; they use clean SVG wordmark logos).
- `docs/help/building-a-template.md` — the authoring guide (manifest anatomy, node model, gotchas).
- `apps/dashboard/public/blueprint-previews/` — where preview PNGs live; `retail-store-blog.png` exists; `tattoo-studio.png` here is **stale (old garbled logo) — overwrite it**.

The manifests currently have **no `preview` field** (the 4 new ones) — that's what you're adding once you capture real screenshots.

## CRITICAL gotchas (these caused real failures this session)

1. **The installer is NOT idempotent.** Product handles are unique per tenant. If a template was _ever_ installed in a tenant, reinstalling it (even after deleting its site — deleting a site keeps its products/content) fails with **"Couldn't install — an internal error occurred"** (duplicate handle at the commerce step).
   → **Install each template on a FRESH site in a tenant that has never had that template.** If the live env is a clean tenant, you're fine. If you must reuse, pick a tenant/site where that specific template was never installed.
   → _(Recommended follow‑up, optional: make `installBlueprint` in `services/api-rest/src/lib/blueprint-installer.ts` upsert‑by‑handle so reinstalls don't collide. Not required for this task.)_
2. **Each template needs its OWN fresh site** so its product/content grids are clean. Products & content are **property‑scoped** (a fresh property shows only its own records), so separate sites = clean screenshots. Installing two templates on the same property mixes their grids.
3. **Install lands on the ACTIVE property** (the site selected in the dashboard's top breadcrumb site‑switcher). Create the site, confirm it's active ("Editing now"), then install.
4. **Logo:** already fixed in code — each template ships a brand‑colored **monogram** (a `ui-avatars.com` SVG, env‑agnostic) **plus** the business name in the header (a Logo + Heading lockup). Verify the header shows "mark + name", not a garbled image. _(Background: the originals hot‑linked a `picsum.photos` random photo into the logo slot → noise.)_
5. **Home** is a published **singleton with no slug** → it serves at `/`.
6. **Confirm dialogs** for Install and Go‑live are in‑app React dialogs (not native) — click "Install template" / "Go live" to proceed.

## Steps (repeat per template)

1. In the dashboard, **create a new site** (Settings → Sites → New site; e.g. name "Ironleaf Tattoo", handle `ironleaf`). Creating it makes it active.
2. Go to **Templates**, click **Install** on the matching card → confirm **Install template** → wait for "Installed · draft".
3. Click **Go live** → confirm **Go live** → wait for "Live".
4. Open the **live site** for that property and screenshot the **home** (frame the hero; the marketplace card crops ~16:10, top‑aligned). On live, each site is reachable at its canonical domain (e.g. `https://<tenant>-<handle>.sparx.zone`, primary at `https://<tenant>.sparx.zone`). Confirm: header shows the monogram + business name, the hero renders, products show **only this template's** items with images, journal posts render with images.
5. Save the screenshot to `apps/dashboard/public/blueprint-previews/<key>.png` (keys: `tattoo-studio`, `beauty-salon-spa`, `antique-shop`, `auto-parts`).
6. In each manifest, add near the top (after `requiresModules`): `preview: '/blueprint-previews/<key>.png',`.

## Also do

- **Flagship logo:** `packages/blueprints/src/blueprints/retail-store-blog.ts` still uses a `picsum` logo (`pic('driftwood-logo', …)`) and a plain `node('Logo', { bind: 'site.identity' })` header — apply the **same monogram + header name‑lockup fix** the 4 new ones use (see any of them for the pattern: ui‑avatars logo asset URL in brand colors + a `Stack` of Logo + Heading in the header). Recapture/refresh its preview if you reinstall it.

## Gate (must be green before handing back)

```
pnpm --filter @sparx/blueprints test        # parseBlueprint runs via registry; expect 15 passed
pnpm --filter @sparx/blueprints typecheck
pnpm --filter @sparx/blueprints lint
pnpm exec prettier --check "packages/blueprints/src/**/*.ts" "apps/dashboard/public/blueprint-previews/*"  # png not formatted; check the .ts
```

After adding `preview` to the 4 manifests, run `pnpm exec prettier --write` on the changed `.ts` files.

## Hard rules

- **Do NOT push, do NOT commit unless the user explicitly asks** — the user pushes manually. Everything stays UNPUSHED.
- **Never** add a `Co-Authored-By` trailer. **Never** `git stash`.
- No eyebrows (no small uppercase kicker above headings). Say "Site," not "Site," in user‑facing copy.
- If the live install also hits the duplicate‑handle collision (template already installed in that tenant), use a different fresh tenant/site rather than deleting+reinstalling.

## Done =

4 (ideally 5, incl. flagship) templates installed live, each with a real home‑page preview PNG committed under `apps/dashboard/public/blueprint-previews/`, each manifest's `preview` field set, flagship logo fixed, gate green, nothing pushed. Report the live URLs you used and any template that wouldn't render correctly.

## Still queued after this (do NOT start unless asked)

- A **Bang Bang** (https://www.bangbangforever.com/) closer‑mimic — a second, bolder tattoo template variant the user requested (keep the original).
- The remaining **16 templates** from the approved 20‑template lineup (barbershop, fitness, restaurant, photographer, apparel, home/furniture, jewelry, coffee, plant shop, bakery, bookstore, trade supply, wholesale, news/magazine, nonprofit, pro‑services firm).
