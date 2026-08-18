# Running the place — My Team, Automations, Connections

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-17

11 screens across three apps, and no feature tours — none of these apps has a
group big enough to need one. 3 app tours, 14 steps. Replaces
[lib/tour/app-tours/run.ts](../../apps/workbench/lib/tour/app-tours/run.ts).

**Two of the three are off the rail for a new business.** Automations and
Connections are `defaultEnabled: false`, so most people arrive through the All
apps door having gone looking. Both tours open by saying what the app is rather
than assuming somebody chose it on purpose.

---

# My Team · 5 screens

Five rows and three headings, so one tour walks the lot in panel order.

**Not the same thing as Team under Home.** `platform.settings.team` is who can
sign in to Piggles; this app is hours, pay and cover. The first step says so,
because the two rows are one word apart and the mix-up is guaranteed otherwise.

## App tour · `staff` · 6 steps

### 1 · `team.people` — `nav-staff.people`

**Who works with you**

> Everyone on the team, what they are paid and what they are allowed to see.
> Somebody who only does the diary never has to be shown your takings. This is the
> people side; who can sign in to Piggles is set under Home.

### 2 · `team.timesheets` — `nav-staff.timesheets`

**Hours worked**

> What people actually did, against what they were rostered for. It is what
> payroll runs off, so it is worth a glance before the end of the week rather than
> after.

### 3 · `team.schedule` — `nav-staff.schedule`

**Who is on when**

> The rota, week by week. It sits next to the diary on purpose — a booking with
> nobody rostered to do it is the mistake this screen exists to catch.

### 4 · `team.timeoff` — `nav-staff.timeoff`

**And who is away**

> Holiday, sickness, a half day. Approve it here and the rota and the diary both
> know, so nothing gets booked into an empty slot.

### 5 · `team.certifications` — `nav-staff.certifications`

**Tickets and licences**

> Anything with an expiry date on it — a forklift ticket, a food hygiene
> certificate, a DBS check, an insurance renewal. Piggles warns you before one
> runs out rather than after somebody has worked a shift they should not have.

### 6 · `team.close` — no anchor

**That is the whole app**

> Five screens. If you work on your own, none of them will ever have more than one
> name in — and that is fine; nothing else in Piggles depends on this being filled
> in.

---

# Automations · 3 screens

## App tour · `automations` · 4 steps

The tour deliberately leads with the **recipe library** rather than with the panel's
first row. Panel order is for scanning; a tour is for teaching, and dropping a
beginner onto an empty rule builder is the fastest way to close it again.

### 1 · `automations.recipes` — `nav-automations.recipes`

**Start with one somebody already wrote**

> Ready-made ones for the things most businesses want — thank somebody after their
> first order, flag a customer who has gone quiet, tell you when stock runs low.
> Pick one, change the words, switch it on.

### 2 · `automations.list` — `nav-automations.list`

**Everything running for you**

> Each one is "when this happens, do that". You can switch any of them off at any
> moment, and nothing here can spend money or message a customer without you
> having said so.

### 3 · `automations.reports` — `nav-automations.reports`

**What it actually did**

> Every time one of them fired, and what came of it. If something has been sending
> things you did not expect, this is the screen that tells you which one and when.

_The shipped step anchors `nav-automations.runs`, and `automations.runs` is
`listed: false` — it is always scoped to one rule and reached from that rule's
toolbar, so it is never a nav row and the step rings nothing. `automations.reports`
is the row that is actually there. See [README.md](README.md) §8._

### 4 · `automations.close` — no anchor

**Start with one, not five**

> Switch one on, leave it a week, and see what it did before you add another. An
> automation you have forgotten about is the only kind that causes trouble.

---

# Connections · 3 screens

Piggles never runs an AI on your behalf and never puts one on your bill. Every
step here says so in one form or another, because it is both the truth and the
reassurance people actually want — and because it is a rule, not a phase
([CLAUDE.md](../../CLAUDE.md), no platform AI).

## App tour · `connections` · 4 steps

### 1 · `connections.overview` — `nav-ai.overview`

**Bringing your own assistant**

> If you already pay for an AI assistant, you can point it at your own business
> from here using your own account. Piggles never runs one for you and never puts
> one on your bill — it stays your subscription and your key.

### 2 · `connections.instructions` — `nav-ai.prompts`

**Telling it how you work**

> How you talk to customers, what your returns policy actually is, the things you
> would tell a new member of staff in their first week. Written once here, so you
> are not explaining it every time.

### 3 · `connections.tools` — `nav-ai.tools`

**And deciding what it may touch**

> You choose exactly what it is allowed to read and change — look at orders but
> never issue a refund, say. Everything starts off, and nothing turns itself on.

### 4 · `connections.close` — no anchor

**Nothing here happens by itself**

> If you never open this app again, nothing about Piggles changes. It is here for
> people who already use an assistant and would rather it knew about their
> business than not.
