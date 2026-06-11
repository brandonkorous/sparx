# Sparx Marketplace — submission package templates

This folder is the **canonical contract** for everything published to the Sparx
marketplace. There is one template per category:

| Category        | Folder                          | Payload is…                         | Runs code? |
| --------------- | ------------------------------- | ----------------------------------- | ---------- |
| **Theme**       | [`theme/`](./theme)             | design tokens (data)                | no         |
| **Component**   | [`component/`](./component)     | a builder node-tree (data)          | no         |
| **Blueprint**   | [`blueprint/`](./blueprint)     | a declarative site manifest (data)  | no         |
| **Integration** | [`integration/`](./integration) | a declarative connector spec (data) | no¹        |

¹ A submitted integration is a **declarative connector** (endpoints, auth, field
mappings, webhooks) — pure configuration, no executable code. Integrations that
need real custom logic are a separate **sandboxed code tier** (see the design doc),
not part of the open submission contract.

Sparx publishes its own first-party themes/components/blueprints/integrations
**through this same contract** — we are just the first publisher, auto-approved.
There is one pipeline, not two.

---

## The golden rule: declarative in, declarative out

A submitter may author in TypeScript/TSX for ergonomics, but **the bundle is
compiled, server-side, into a declarative data artifact** (token JSON / node-tree
JSON / manifest JSON / connector JSON). Only that artifact is stored and applied.
**Untrusted code is never executed** to render a theme, install a blueprint, or
place a component. This is what keeps the multi-tenant / RLS security model intact.

## Strict allow-list — "no other things"

A submission is a folder (uploaded as a `.zip`). It may contain **only** the files
its category template defines, and **nothing else**. The validator rejects a bundle
that contains anything outside this list:

```
<slug>/
  sparx.json          REQUIRED  — the metadata manifest (see below)
  <payload>           REQUIRED  — exactly ONE category payload file (e.g. theme.ts)
  media/
    icon.png          REQUIRED  — square mark for cards/lists (512×512, ≤256 KB)
    preview.png       REQUIRED  — detail-view hero (1600×1000, 16:10, ≤2 MB)
    …                 OPTIONAL  — more images: .png .jpg .jpeg .webp .svg
  README.md           OPTIONAL  — human-readable description (markdown, no HTML)
  CHANGELOG.md        OPTIONAL  — version history (markdown)
```

**Denied automatically:** any other file or extension — `node_modules/`, lockfiles,
`*.sh`/`*.bat`, dotfiles other than none, nested packages, binaries other than the
allowed image types, symlinks, a second payload file, files above a size cap, or any
import the payload makes outside the allow-listed authoring API. A bundle is **also
denied if it is missing a required file** — the payload, `icon.png`, or `preview.png`
(or either image is off-spec in format/dimensions/size). A bundle that trips any rule
is **denied with the offending path(s)** and never reaches storage.

## `sparx.json` — the metadata manifest (every category)

```jsonc
{
  "schemaVersion": 1,
  "category": "theme", // theme | component | blueprint | integration
  "slug": "aurora", // unique, kebab-case, [a-z0-9-]
  "name": "Aurora",
  "version": "1.0.0", // semver; bump to publish an update
  "tagline": "One line, ≤255 chars.",
  "description": "A few sentences. No markup.",
  "payload": "theme.ts", // the single payload file in this bundle
  "facets": {}, // category-specific (see each template)
  "pricing": { "model": "free", "priceCents": 0 }, // free | one_time | subscription
  "media": [
    { "file": "media/icon.png", "kind": "icon", "alt": "Aurora mark" },
    { "file": "media/preview.png", "kind": "preview", "alt": "Aurora home page" },
  ],
  "author": { "displayName": "Your Studio", "website": "https://example.com" },
  "requires": { "modules": [] }, // category-specific (see each template)
}
```

## Pricing & caps

`pricing.priceCents` is capped by the platform. Caps are **category- and
size-aware** — e.g. a blueprint's ceiling scales with its **feature counts**
(products, pages, content entries, emails, components). A submission priced above
its computed cap is denied with the cap explained. Free is always allowed.

## Lifecycle

`submitted → scanning → (approved | denied) → published → (updated | unlisted)`

- **scanning**: allow-list check → compile payload in isolation → validate against
  the category's Zod schema → integrity cross-refs → image scan → price-cap check.
- **approved**: artifact + media written to object storage; a catalog row is created
  (`status: published`); the item is **applyable/installable immediately, no deploy**.
- First-party (Sparx) submissions skip manual review (auto-approved) but run the
  same automated scan.

See the design doc for the full pipeline (storage layout, review queue, runtime
resolution, monetization/payouts, and the integration sandbox).
