# 148 — Typing a number into a segment rule threw an error

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Customers › Segments › New segment; also custom properties on CRM records, the core count boxes on an order, and the length and size limits on content and product types
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (segment value)
**Blocked on:** —

## What happened

Doty had no audience for his fleets, so he started a segment: "Wholesale account · Fleet size", "is more than", and typed `0` in Value. The count changed to "1 of 38 match", and the console's error badge came up:

> Runtime TypeError: Cannot read properties of undefined (reading 'value')

The stack runs from the rule builder's `set` into Base UI's field `onChange`.

## What should have happened

Typing a value changes the rule and nothing else.

## Why it matters

Each keystroke in these boxes throws. In a production build, React reports the error and carries on. So the screen seems to work, but every value box of this kind is one error per keystroke, and the field's own state (dirty, filled, its validation) is never updated. The same mistake sits under:

- every value in a segment rule (sparx and Piggles)
- every custom property on a contact, company, deal, request or custom record (sparx and Piggles)
- "Usable", "Not usable", "How many arrived" and "How many" on an order's cores
- every number box in a content type's and a product type's field settings: rows, shortest, longest, smallest, largest, most items (sparx and Piggles)

## Where it lives

`FieldControl render={<X onChange={…} />}`. Base UI clones the element it is given and merges its own `onChange(event)` into the element's props. That handler reads `event.currentTarget.value`. Four of our components use the name `onChange` for their own value callback and call it with a value, not an event:

- `ValueControl` in `surfaces/crm/segment-rule-builder.tsx` calls it with the edited rule.
- `ScalarControl` in `surfaces/crm/custom-properties-panel.tsx` calls it with the property value.
- `CountInput` in `surfaces/commerce/order-cores.tsx` calls it with the typed text.
- `NumInput` in `surfaces/cms/content-type-detail.tsx` and `surfaces/commerce/product-type-detail.tsx` calls it with a number.

The merged handler gets that value, finds no `currentTarget`, and throws.

A scan of every `FieldControl render=` across sparx, Piggles and the WizeWorks apps found 48 such elements. Every other `onChange` given to a wrapped element is on a real input (`Input`, `Textarea`, `NativeSelect`, `Checkbox`) and receives the event.

## The fix

Only a real input takes `onChange` inside a `FieldControl`. A component of ours names its own callback `onValueChange` and passes the field's props, the event included, on to its input.

- `NumInput` (content type and product type, sparx and Piggles) and `CountInput` (order cores): the callback is now `onValueChange`. The rest of the props (the field's id, its label's id, its `onChange`) go through to the `Input`, and its `onChange` calls the field's handler with the event first. So the label now names the box too.
- `ValueControl` (segment rules) and `ScalarControl` (custom properties), sparx and Piggles: they hold dropdowns, switches and rows of buttons as well as boxes, so they are no longer wrapped in a `FieldControl`. Each control already names itself with its own `aria-label`.

Tests, proved red:

- `sparx/apps/workbench/components/field-control-passes-the-event.test.ts` reads every `FieldControl render=` in the console with the TypeScript parser. It fails on any element given an `onChange` that is not `Input`, `Textarea`, `NativeSelect`, `Checkbox` or a plain input. Against the committed screens it lists 26 places: 20 `NumInput`, 4 `CountInput`, 1 `ScalarControl` and 1 `ValueControl`.
- `piggles/apps/workbench/components/field-control-passes-the-event.test.ts`: the same check. Against the committed screens it lists 22 places.

Typecheck and lint pass in both consoles.

## Confirmed by

P01 on screen, 2026-10-08. Customers › Segments › New segment, as Doty. The value box of a rule took `Fleet`, and then `Contract`, and the count changed with each one (5, then 6 of 38). No error badge came up. Before the fix, typing `0` into the Fleet size value threw at once.

Not checked on screen: the cores counts, the custom properties and the type limits. They had the same cause and the same fix, and the test covers them.

## Rating effect

—
