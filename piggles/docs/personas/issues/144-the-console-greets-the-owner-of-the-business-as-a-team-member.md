# 144 — The console greets the owner of the business as a team member

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing check — wrong moves
**Surface:** mypiggles › the top bar, every load
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Every time Nia opens her console, the chip beside her avatar reads:

> **Nia Okafor**
> Team member

for a second or two, and then changes to **Owner**.

She owns Halo & Hem. She is the only person with an account. The first thing the
product says to her, on every single load, is that she is staff in her own salon.

## Why it happened

```ts
function roleLabel(role: string | undefined): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Runs the place';
    case 'viewer':
      return 'Can look, not touch';
    default:
      return 'Team member'; // ← and `undefined` lands here
  }
}
```

The `default` branch was written for `editor`, the fourth platform role. It also
catches "the viewer request has not come back yet", and those are not the same
thing: one is an answer and the other is the absence of one. This is the shape
the persona rules call presenting absence as measurement, and it is the version
of it that is easiest to ship, because a default is a normal thing to write and
the wrong answer is a plausible one.

## Where the line is drawn

The app rail does something that looks similar and is not the same mistake. It
shows every app while entitlements load — three of them (Partners, Automations,
Connections) then disappear — and `useReachableModules` says so in as many words:
"a briefly too-generous rail beats navigation that pops in group by group". That
is a considered trade with a stated reason, and offering a door that turns out to
be open is not a false claim about the person using it.

A role is a claim about the person. There is no equivalent trade: an empty line
for two seconds costs nothing.

## Where it lives

- [components/topbar/viewer-menu.tsx](../../../apps/workbench/components/topbar/viewer-menu.tsx) (new) — `roleLabel`
- [components/topbar.tsx](../../../apps/workbench/components/topbar.tsx)

## The fix

`roleLabel` returns `null` when it does not know, and `editor` gets the label
that was written for it:

```ts
case 'editor': return 'Team member';
default: return null;
```

The line under the name is rendered either way with a `min-h-4`, so the name does
not shift down when the answer arrives.

topbar.tsx was 551 lines. Touching it means splitting it (RULE #0.5), so the four
controls it had grown moved into `components/topbar/`: the business switcher, the
site switcher, quick add, and this menu. What is left states the shape of the bar
and nothing else. Two unapproved `color="neutral"` buttons went with them — the
business switcher's trigger and the modal's Close — replaced by colourless
buttons, which resolve to `base-content` and are theme-correct without naming a
colour that is Brandon's to choose (root RULE #4).

## Confirmed by

> Reloaded the console as Nia. The chip reads **"Nia Okafor"** with an empty line
> beneath while the mascot loader is up, and **"Nia Okafor / Owner"** the moment
> the viewer resolves. Reproduced the old behaviour twice before the fix, so this
> is not a one-off timing artefact: it happened on every load.
