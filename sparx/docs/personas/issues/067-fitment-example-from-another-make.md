# 067 — Adding a model under GMC suggested "F-250 Super Duty"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 3 (entering his engine list)
**Surface:** workbench › Fitment › a list's entries (both consoles)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** On screen, 2026-10-01: Fitment › Vehicle › GMC, the add box reads "GMC model".
**Blocked on:** —

## What happened

The add box shows an example so an empty field is not a blank stare. The example was
fixed per level: every model box said "F-250 Super Duty" and every engine box said
"6.7L Power Stroke". So "Add model under GMC" suggested a Ford truck, and "Add engine
under Canyon" suggested a Ford engine. For an owner entering his list for the first
time, the example is the instruction, and this one was wrong under four of his five
makes.

## What should have happened

An example only where it belongs: "F-250 Super Duty" under Ford. Elsewhere it names the
parent the owner chose: "GMC model", "Canyon engine".

## Fix

`surfaces/commerce/fitment-example.ts` (new, both consoles): each example carries the
parent it belongs under, and is shown only there. Otherwise the box says
"{parent} {level}", or "A make" / "An engine" at the top of a list of its own.
`fitment-nodes.tsx` passes the current parent. 3 tests in each console; restoring the
old rule (example regardless of parent) reddens 2.
