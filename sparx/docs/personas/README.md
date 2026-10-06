# sparx workbench — persona testing

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-10-01

Product validation driven by real businesses rather than QA passes. A run is one
business, with a person behind it, set up from nothing on the sparx workbench and
operated on the real screens until its job works or breaks. Every defect is fixed
inside the run and re-proved from the screen that found it.

The rules are binding and live in [CLAUDE.md](CLAUDE.md). Scores live in
[rating.md](rating.md). Defects live in [issues/](issues/), and `ls issues/` is the
index.

## The roster

| ID  | Person | Business               | Modules | What only this persona proves                                                                                         |
| --- | ------ | ---------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| P01 | Doty   | Gillett Diesel Service | all 16  | sparx can run the whole of a real multi-location B2B parts-and-service business, start to finish, before it goes live |

[P01 — Doty · Gillett Diesel Service](01-gillett-diesel.md)

## Why one persona, not ten

The Piggles exercise allocates ten personas across trades, because Piggles' main
axis of variance is the trade a small business picks at setup. This exercise has a
different job: it is the **final acceptance test before onboarding Gillett Diesel
Service**, sparx's first Enterprise client. So it is one real business, with every
module on, built out as its actual implementation in dev.

The trade-off is stated plainly. One persona with every module on covers every
pane's **full-module** path. It does not cover:

- a tenant with **few** modules on, where a cross-module link points at a module
  that is off (the Piggles runs cover much of that shape)
- a content-only or CRM-only business, where nothing is for sale
- a second site under the same owner (multi-site), beyond one deliberate switch
  for the isolation check
- a business outside the United States (currency, tax, address format)

## Run order

P01 only. Its acts run in the order written in the persona file, because each
builds on the last: the catalog before the price tiers, the trade accounts before
the quotes, the site before the shopper.

## Test data

The company side of Gillett Diesel is real, captured from the public site into
[assets/gillett/](assets/gillett/). Those files are not committed (the folder's
`.gitignore` excludes them). The people are made up and use `.test` addresses.
