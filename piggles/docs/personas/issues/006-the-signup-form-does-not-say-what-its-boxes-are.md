# 006 — The boxes on the signup form have no names, if you cannot see them

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 1
**Surface:** getpiggles › Create your account (and sign in, reset password, onboarding)
**Filed:** 2026-08-19
**Fixed:** 2026-08-19
**Confirmed by:** re-ran P01 act 1 — read the signup page's accessibility tree: the three boxes now announce as "Your name", "Email" and "Password", and the page has zero labels pointing at a control that does not exist
**Blocked on:** — (the same defect elsewhere in the console is tracked below as its own scoped item)

## What happened

On `localhost:3021/signup` the three boxes look labelled — "Your name", "Email",
"Password" sit right above them. The markup says otherwise:

```html
<label for="base-ui-_R_136j5esnelb_" class="field-label">Your name</label>
<input type="text" class="input input-lg" autocomplete="name" name="name" />
```

The label points at `base-ui-_R_136j5esnelb_`. **No element on the page has that
id.** The input has no id at all. Chrome's accessibility tree confirms it:

```
textbox [ref_3] type="text"          ← no name
textbox "you@yourbusiness.com" …     ← "named" by its placeholder, not its label
textbox [ref_5] type="password"      ← no name
```

Same on sign in, on the two-factor code box, on both boxes of the password reset,
and on "What is your business called?" in onboarding.

## What should have happened

The label names the box. Someone using a screen reader hears "Your name, edit
text" rather than "edit text", and clicking the word "Password" puts the cursor
in the password box (it does not — the `for` resolves to nothing).

## How to reproduce

Every time:

1. Open `http://localhost:3021/signup`.
2. Run in the console:
   `[...document.querySelectorAll('label[for]')].filter(l => !document.getElementById(l.htmlFor))`
3. Three labels come back. Clicking any of the three label texts moves no cursor.

## Why it matters

Piggles' stated audience includes a 61-year-old on a phone in a workshop, and the
product's own Trust page makes accessibility claims. A signup form nobody can
hear is the first screen of the product.

It is also silent: it looks perfect on screen, and typecheck, lint and build all
pass. Nothing but opening the accessibility tree finds it.

## Where it lives

The `Field` contract, used wrong. silicaui's own docs are explicit:

> Base UI wires the label, control, description, and error together (ids, aria,
> validity tracking); Silica styles them.
> `<Field><FieldLabel>Email</FieldLabel><FieldControl type="email" /></Field>`
> For a non-input control, pass it via `render`: `<FieldControl render={<Textarea />} />`

`FieldControl` is what registers with the Field context and receives the minted
id. A bare `<Input>` inside a `<Field>` is styled correctly and registered with
nothing, so the label's `for` is left pointing at an id that was never rendered.

Four files in the account app: `components/signup-form.tsx`,
`components/sign-in-form.tsx`, `components/password-reset-forms.tsx`,
`components/onboarding.tsx`.

## The fix

Every bare control that follows a `<FieldLabel>` became
`<FieldControl render={<Input size="lg" />} … />` — `render` because `Input` and
`PasswordInput` carry silica's styling and `PasswordInput` carries the reveal
toggle, so they must stay the rendered element rather than be replaced by
FieldControl's own input. Sizing goes on the rendered element; behaviour and
name go on `FieldControl`.

Twelve controls across the four files, covering the whole signed-out surface:
signup, sign in, the two-factor code, both reset boxes, and both the
business-name field and the trade picker in onboarding.

`NativeSelect` was assumed to register itself and did not — checked on the
onboarding screen, where "What kind of business is it?" came back an orphan and
its `<select name="industry">` had no id. It is a plain `<select>` with silica
classes, so it needs `FieldControl` exactly as `Input` does. Assumed and then
disproved on the screen, which is why the count above moved from eleven to
twelve.

## The same defect elsewhere — scoped, not ignored

A static sweep of `piggles/` finds **268** places where a `<FieldLabel>` is
followed by something other than a `<FieldControl>`. Of those, the ones proven to
break are the plain controls: **54 `Input`, 13 `Textarea`, 4 `PasswordInput`**
and **64 `NativeSelect`** — a plain `<select>` registers no more than a plain
`<input>` does. `Select`, `Switch` and `Combobox` are Base UI composites and are
**not checked** (personas RULE #4): each gets tested on the first pane that
renders one, not assumed either way. The remaining rows are layout `div`s.

The account app's eleven are fixed here. The remainder are in
`apps/workbench` and are **not** fixed in this run — that is a sweep across 163
files and is larger than the surface under test (personas CLAUDE.md, "a fix
bigger than the surface under test"). They are being fixed **pane by pane as the
persona runs open them**, which is the process this exercise already follows.

The audit that finds them on any screen, worth keeping:

```js
[...document.querySelectorAll('label[for]')].filter((l) => !document.getElementById(l.htmlFor));
```

## Confirmed by

> Re-ran P01 act 1 on `localhost:3021/signup?from=home-hero`. The orphan-label
> query returns `[]`. Each of the four controls now resolves to its label —
> `name → "Your name"`, `email → "Email"`, `password → "Password"`,
> `analytics → "Help us fix what is confusing"`. Clicked the word "Password" and
> the cursor landed in the password box. Carried on into onboarding and ran the
> same query there: `[]`, with `select[name=industry]` now resolving to
> "What kind of business is it?".

## Rating effect

getpiggles › Create your account — Ease 6 → 8 (recorded in [rating.md](../rating.md)).
