# 458 — A pane that named itself, in the wrong language

**Status:** fixed
**Severity:** major
**Found by:** Devi opening Social for the first time — eight panes, never used
**Surface:** `social.inbox`, `social.approvals`, `social.cadence`, `social.connections`, `crm.settings`, `platform.settings.industry`, `platform.settings.security` (Piggles); `commerce.cart.detail`, `seo.audits.detail` (sparx)
**Filed:** 2026-09-09

## What was wrong

Devi opened four Social screens. The rail called them **Comments and replies**,
**Posts waiting on you**, **How often you post** and **Your social accounts**.
The command palette called them the same. Their own tabs said:

> **Inbox** · **Approvals** · **Cadence** · **Connections**

Three of them sat in one strip beside **How your posts did**, which was correct —
so the same tab bar showed both behaviours at once, and the difference between
them was invisible from the screen.

`crm.settings` was worse than inconsistent. Its tab read **"How the CRM
behaves"**: a technical acronym on a product whose whole promise is that a
business owner never meets one, and a word `check:piggles-nav` explicitly bans.

## Two authors, one label

A pane's tab has two possible authors.

- The **catalog title**, resolved through `resolveTitle` → `productSurfaceTitle`.
  That is the chokepoint the registry's own comment describes: _"One lookup
  renames a screen in all seven places at once, and there is no seventh place for
  one of them to be missed."_
- **`ctx.setTitle`**, which writes `PaneDescriptor.title` — documented as
  _"Operator-set tab label… an explicit title survives only because a user renamed
  the tab"_ — and therefore outranks the registry. It has to: `INV-000004` must
  beat `Invoice`.

There was a seventh place after all. A surface handing its OWN name to the second
one pins the tab to the platform's word and cuts that pane out of the first.

```tsx
useEffect(() => {
  ctx.setTitle('Inbox'); // the word vocabulary.ts exists to replace
}, [ctx]);
```

## How wide

Measured before fixing, by resolving each catalog entry the way the app does:

|                                           | Piggles | sparx |
| ----------------------------------------- | ------- | ----- |
| surfaces in the catalog                   | 303     | 297   |
| with a STATIC title (no record to name)   | 276     | 270   |
| whose only `setTitle` calls are constants | 26      | 28    |
| **…showing a name used nowhere else**     | **7**   | **1** |

The other 46 restated a name nobody had changed yet. Not lies — **lies in
waiting**: the moment somebody edits that catalog entry, the constant wins
silently and the tab is the one place the new name never reaches. That is exactly
how the first eight got here.

The count excludes detail panes that mix a literal with a record name
(`setTitle('New content')` / `setTitle(record.title)`). That is the contract
working, and treating it as a defect would have produced fifteen false positives.

## Two more, found by the sweep

**sparx's page check named every check the same.** Piggles set
`` `${pageName} · page check` ``; sparx set the constant `'Page check'`. Three
open checks were three identical tabs, and the only way to tell them apart was to
click each one. Ported from the Piggles version, which already reads the page's
own title from the params and falls back to the kind of page.

**sparx's cart pane was titled from both places at once** — catalog `'Cart'`,
effect `'Basket'`. Everything else in that console says basket, so the catalog was
the stale one and now says `'Basket'` too.

## The fix

**One rule, at the chokepoint.** `isOwnStaticTitle(surfaceKey, title)` in both
registries: true when a surface's static catalog name is handed back to it. A
FUNCTION title is never an own-name — it exists to name a record, so there is
nothing static to collide with.

`controller.setTitle` then **clears** rather than stores it, so the pane keeps
answering to the registry and one rename reaches the tab with everywhere else.

The 54 now-provable no-op effects were removed. The sweep script refused loudly on
the two files that were not the exact three-line shape, and both turned out to be
the extra defects above — a refusal that found work rather than skipping it
([[feedback_codemod_diff_your_own_sweep]]). Every swept file's diff is exactly
`0 added, 4 removed`.

## It was written down in three places

The wrong word did not just render. It was **saved**, and finding all three
copies took two failed attempts.

1. **Our descriptors** (`panes` in the layout). Swept in `hydrate`, because the
   effects that used to hand the stale word back on mount are now gone — nothing
   else would ever remove it.
2. **dockview's serialized grid.** It writes its own copy of every tab label
   inside the blob our persistence comment calls _"opaque to us by design — it
   owns layout."_ It owns layout AND had a private copy of the name, and on
   restore that copy is the one a person reads. `retitleFromDescriptors` pushes
   the derived name back after `fromJSON`.
3. **The windows/tabs mode snapshots.** I reasoned this one was safe —
   `reuseExistingPanels` moves live panels rather than rebuilding them. Then I
   clicked the toggle, and the tab said **Connections** again. Same helper, after
   `reconcile`.

Copy 2 was caught by looking at the screen after the fix "worked". Copy 3 was
caught only because I stopped reasoning and clicked. [[feedback_test_as_a_business_owner]].

## The check that was already there and could not see it

`check:piggles-nav` exists for exactly this — _"every new screen arrives wearing
sparx's words by default"_ — and it passed. It labels a surface's title `pane tab`
in its own output, so it believed it covered this. It was reading the name the tab
was **supposed** to have.

Added as **seam 4**: every string literal passed to `ctx.setTitle` is a rendered
tab label and now faces the same ban list. 28 strings that were unchecked.

Red proof: reinstating the one line gives

```
✗ sparx vocabulary in the Piggles nav (625 rendered strings …)
  [CRM] pane tab "How the CRM behaves"  ctx.setTitle  (surfaces/crm/crm-settings.tsx)
```

and the denominator moves 624 → 625, so the scan is genuinely reading the file
rather than reporting green over nothing ([[feedback_structural_checks_go_blind]]).

## Proving it red

`pane-title.test.ts`, 9 tests in each console.

| breaking                                    | reddens                                        |
| ------------------------------------------- | ---------------------------------------------- |
| storing the own-name instead of clearing it | 2 — `expected 'Inbox' to be undefined`         |
| dropping the function-title guard           | 2 — a record named "New invoice" loses its tab |
| removing the `hydrate` sweep                | 1 — the saved layout keeps the stale word      |
| reinstating one `setTitle` constant         | 1 check failure, naming the file and the word  |

## On screen

Before: **Inbox · Approvals · Cadence** in one strip, beside a correct
**How your posts did**.

After, restored from the same saved layout, in both tabs and windows mode:
**Comments and replies · Posts waiting on you · Your social accounts**.

## What this cost her

Nothing she could have reported. A tab saying "Inbox" is not obviously broken — it
is a word, and she would have assumed it was the name. The damage is that the
console spoke two languages at once, and the one place she looks most often was
speaking the wrong one.
