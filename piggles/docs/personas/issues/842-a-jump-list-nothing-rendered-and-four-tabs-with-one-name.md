# 842 — A jump list nothing rendered, and four tabs with one name

**Status:** fixed
**Severity:** a finished feature that was not on the screen, and panes that could not be told apart
**Found by:** P03 · Juniper Row · act 288
**Surface:** The dock — windows and tabs
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** driven on `localhost:3022` with 374 panes open, and read back after a reload

## The strip, and what it will not do

Devi's workspace has **374 open panes**. The tab strip carries every one of them,
and at the right-hand end it had two arrows: `‹` and `›`.

One press moves 80% of a strip. To reach the three hundredth tab that is roughly
forty presses, reading as you go, with no way to search.

`lib/dock/tab-list-menu.tsx` is the answer to that, and it was already written.
Two hundred and fifty lines: a popover with a search field, a row per pane with
its app's hue and its own close button, arrow keys wired by hand, a subscription
to every pane's title so a renamed tab stays findable under the name on screen.
Its header explains in forty lines why it replaced dockview's own overflow list.

**Nothing imported it.**

```
$ grep -rn "TabListMenu" piggles/apps/workbench
lib/dock/tab-list-menu.tsx:61:interface TabListMenuProps {
lib/dock/tab-list-menu.tsx:67:export function TabListMenu({ panels, activePanel }: TabListMenuProps) {
```

Its own file, twice, and nowhere else. The feature its comments describe was not
on the screen and never had been in this console.
[[feedback_screen_over_a_function_nobody_calls]]

### The other console had the other half

|             | Scroll arrows | Jump list                      |
| ----------- | ------------- | ------------------------------ |
| **piggles** | wired         | **built, imported by nothing** |
| **sparx**   | absent        | wired                          |

Two consoles, two halves of one answer, one half in each tree. Neither is wrong
on its own: the arrows answer _move along the strip_, the list answers _take me
to the one called X_. They are different questions and they sit in the same inch
of chrome.

Both consoles now carry both. sparx needed the arrows ported into its own
idiom — lucide icons, no `@piggles/ui` — because the brands may not import from
each other. `check:boundaries` green.

**Driven at 374 panes:** the trigger reads `⌄ 371` for its group, the popup
opens 440px tall between y=109 and y=550 in a 1112px window (bounded and
scrolling, which is the failure its header describes in dockview's version), and
typing `invoice` takes 371 rows down to 13.

## Four tabs, one name

Open in the strip at the same time:

```
Supplier invoice    Supplier invoice    Supplier invoice    Supplier invoice
```

Four different supplier invoices. Beside them: `PO-000001`, `PO-000002`,
`GR-000001`, `GR-000002` — every other record in the same app wearing its own
number.

The registry gives each surface a starting title, and a record pane is supposed
to replace it once the record arrives:

```tsx
useEffect(() => {
  if (data) ctx.setTitle(data.number);
}, [data, ctx]);
```

**Sixty-one of this console's seventy-five detail panes do exactly that.** A
probe over the registry and the surfaces found **fourteen in piggles and seven
in sparx that did not**, so every pane they opened carried the same words.

The whole Stock app is finished, in both consoles:

| Pane                 | Was                    | Now                  |
| -------------------- | ---------------------- | -------------------- |
| Supplier invoice     | `Supplier invoice` ×4  | the invoice's number |
| Delivery coming      | `Shipment`             | the notice's number  |
| Return to a supplier | `Return to a supplier` | the return's number  |
| A walk               | `Walk`                 | the walk's number    |
| Stock count          | `Count`                | the count's number   |
| Counting schedule    | `Counting schedule`    | its name             |
| Approval rule        | `Approval rule`        | its name             |

**Read back off the screen after a reload:** the tab that said `Counting
schedule` now says **`Everything at Main, weekly`**, which is what that schedule
is called.

The fixer refused loudly on two of the twelve files rather than guessing — both
had two identical anchors — and those two were then placed by hand.
[[feedback_codemod_diff_your_own_sweep]]

## A ternary that makes no decision

In the window menu:

```tsx
{
  detached ? (
    <Icon glyph={faWindow} className="size-4" aria-hidden />
  ) : (
    <Icon glyph={faWindow} className="size-4" aria-hidden />
  );
}
{
  detached ? 'Bring this back' : 'Move to its own window';
}
```

Both branches render the same icon. Somebody meant two glyphs and it reads, at a
glance, as though the direction is drawn as well as written. It is one glyph
now, with a comment saying the label is what carries the direction.

## The one I nearly filed, and the tab that saved me

Halfway through, the console stopped answering. Screenshots timed out, script
injection timed out, and it stayed that way for over a minute across three
reloads. The obvious story wrote itself: **374 panes with no cap** — the layout
is saved to `localStorage` on every change and restored whole, nothing is ever
pruned, and the only remedy is "Close everything and start empty."

Then I looked at the other browser tab, signed in as the same owner, on the same
site, sharing the same stored layout. **It was responsive the whole time**, with
all 374 panes, and the fix to the search bar's keycap already visible in it.

So the wedge was a development-server rebuild in one tab, not the pane count. I
had the number, the mechanism and the missing cap all lined up, and the second
tab was the only thing that said no. That is the fifth reading this session that
looked like a defect and was not. [[feedback_no_arguing_without_proof]]

The dock is still uncapped, and that is a fact rather than a finding: nothing
measured says it hurts.

## What the dock gets right

- Every tab's close button names its pane: `Close Bills to pay`, not `Close`.
- So does every favorite star: `Add Orders to suppliers to favorites`.
- The arrows disable at each end and disappear entirely when nothing is out of
  view — chrome that appears when it has a job.
- Closing a whole window goes through the controller, never
  `group.api.close()`, so the unsaved-work conversation still happens.
- Panes are reused rather than duplicated: opening the same surface four times
  from the launcher left the count where it was.

## The eight and the two, finished

The first pass left ten panes named here rather than guessed at, "because each
one's identity is a copy decision that needs its own screen open." All ten are
done. Re-measuring them first changed the number, which is the part worth
keeping.

### The list was wrong, and the way it was wrong is the same lesson

The probe that produced it read the file the REGISTRY names and stopped there.
Five of the eight piggles panes register a thin loader that renders an editor
next door, and the editor is where the title was set — already, in commits
months old:

```
commerce.collection.detail    collection-detail.tsx  →  collection-editor.tsx   ✓ already named
commerce.category.detail      category-detail.tsx    →  category-editor.tsx     ✓ already named
cms.webhooks.detail           webhook-detail.tsx     →  webhook-manage.tsx      ✓ already named
inventory.warehouses.detail   location-detail.tsx    →  location-editor.tsx     ✓ already named
scheduling.services.detail    service-detail.tsx     →  service-editor-state.ts ✓ already named
```

A one-file probe over a two-file pane reports the pane as broken. That is the
same failure as the jump list at the top of this page, pointed the other way:
there, believing a header instead of looking; here, believing a list instead of
re-measuring. [[feedback_verify_capability_in_code_not_docs]]

The probe now walks every import a surface reaches. Run over both trees it reads
**337 catalog entries in piggles and 332 in sparx**.

### What was actually silent, and what each one says now

| Pane                                | Was         | Now                        |
| ----------------------------------- | ----------- | -------------------------- |
| `crm.object-type.detail` (both)     | Record type | its PLURAL: `Projects`     |
| `scheduling.bookings.detail`        | Booking     | who it is for, and the day |
| `commerce.cart.detail` (sparx)      | Basket      | `Mara Quill's basket`      |
| `invoicing.invoice.preview` (both)  | Preview     | `Preview - INV-000118`     |
| `invoicing.template.preview` (both) | Preview     | `Preview - Plain invoice`  |

**The record type says its plural** because that is the word the row she clicked
says, and the open action beside it says "Open the projects". It is read off the
DRAFT, not the server row, so renaming one renames its tab as she types.

**A booking has no name field**, which is why it was left for a decision. It is a
service, a person and a time. The person is what an owner scans a strip of tabs
for; the day is what tells two of the SAME person's bookings apart. When nobody
was written down at all, `bookingWhoLabel` honestly answers "No one assigned",
and that identifies nothing, so the service takes the first half instead.
Six tests state which half wins; breaking the rule reddens two of them.

**The two previews were the pair nobody counted.** Neither is a detail pane, so
neither was on the list, and both open one-per-record from an editor. Two invoice
previews side by side read `Preview  Preview`. Each now reads the SAME query key
its editor uses, so opening a preview from an editor costs no request at all and
a preview that outlives its editor fetches once.

### The three left, and why they are right

`workbench.welcome`, `platform.pulse` and piggles' `builder.publish` are
singletons: no params, one open at a time, nothing to tell apart. `PublishPaneSurface`
does not even take a context. A fixed title is the correct title for a pane that
can only exist once.

## Also fixed here

`check:console-parity` held a stale exception for `lib/dock/tab-scroll` —
piggles-only when it was written, ported to sparx by the fix at the top of this
page, and never deleted. The guard caught it, which is the guard working: "an
exception nobody can see the effect of is how the next one gets waved through."

## Files

- `piggles/apps/workbench/lib/dock/group-actions.tsx`
- `sparx/apps/workbench/lib/dock/group-actions.tsx`
- `sparx/apps/workbench/lib/dock/tab-scroll.tsx` (new, ported)
- seven Stock detail surfaces in piggles, six in sparx
- `piggles/apps/workbench/surfaces/scheduling/bookings-data.ts`
- `piggles/apps/workbench/surfaces/scheduling/booking-manage.tsx`
- `piggles/apps/workbench/surfaces/scheduling/booking-tab-title.test.ts` (new)
- `piggles/apps/workbench/surfaces/crm/object-type-detail.tsx`
- `piggles/apps/workbench/surfaces/invoicing/invoice-preview.tsx`
- `piggles/apps/workbench/surfaces/invoicing/template-preview.tsx`
- `sparx/apps/workbench/surfaces/commerce/cart-detail.tsx`
- `sparx/apps/workbench/surfaces/crm/object-type-detail.tsx`
- `sparx/apps/workbench/surfaces/invoicing/invoice-preview.tsx`
- `sparx/apps/workbench/surfaces/invoicing/template-preview.tsx`
- `scripts/check-console-parity.mjs`

## The thing to remember

**A component with a long header explaining why it exists is the easiest kind to
believe in without checking.** This one described a feature, gave its reasons,
listed the three ways the thing it replaced was broken, and was rendered by
nothing. The header is what made it invisible: it read like a decision already
taken.
