/**
 * The arithmetic behind every industry page's price table.
 *
 * A vertical page's whole reason to exist is answering "what would this cost
 * ME" — so the one thing it must never do is carry its own copy of a price.
 * Nothing here holds a figure. Everything is joined from the two files that
 * already own these facts:
 *
 *   • ../modules-catalog.ts  → the module's label, its monthly price, and which
 *                              other modules include it FREE (`includedWith`).
 *   • ../pricing/data.ts     → what each module replaces, and the published
 *                              monthly price of the thing it replaces (LEDGER).
 *
 * Change a price on /pricing and all six industry pages re-price themselves,
 * including their totals and their savings line, with no edit here or in
 * ./registry.ts. That is the point.
 *
 * ## The bundling rule is applied, not narrated
 *
 * Invoicing and Inventory are free to anyone running Commerce or B2B. A shop's
 * stack lists Inventory because a shop genuinely needs it — but it must add $0,
 * or this page would quote a higher number than /pricing does for the same
 * modules, and the first reader to check would be right and we would be wrong.
 * `bundledBy` marks the line so the table can show WHY it is free rather than
 * quietly dropping it, which would lose the strongest fact on the page.
 */
import { MODULES } from '../modules-catalog';
import { LEDGER } from '../pricing/data';
import type { StackModule, Vertical } from './registry';

export interface StackLine {
  module: StackModule;
  /** Product-accurate module name, from the catalog. */
  label: string;
  /** What this module replaces, e.g. "Shopify — Advanced". */
  replaces: string;
  /** Published monthly price of the thing it replaces, in whole dollars. */
  elsewhere: number;
  /** What it adds to the sparx bill — the list price, or 0 when bundled. */
  price: number;
  /** Set when the price is 0 because another module in this stack includes it.
   *  Carries that module's label, so the row can say "free with Commerce". */
  bundledBy?: string;
}

export interface VerticalStack {
  lines: StackLine[];
  /** Monthly sparx total for this stack. */
  monthly: number;
  /** Monthly total of the tools this stack replaces. */
  elsewhere: number;
  /** elsewhere − monthly. */
  saved: number;
  /** Rounded to the nearest $100 — a yearly figure quoted to the dollar reads
   *  as a precision this comparison does not have. */
  savedYearly: number;
}

const catalog = new Map(MODULES.map((m) => [m.id, m]));
const ledger = new Map(LEDGER.map((l) => [l.key, l]));

/** Dollars out of a LEDGER string like "$2,400". */
function dollars(value: string): number {
  return Number(value.replace(/[^0-9.]/g, ''));
}

/**
 * Resolve one vertical's stack into priced lines plus totals.
 *
 * Throws on an unknown module rather than rendering a table with a hole in it:
 * this runs at build time (every industry page is statically rendered), so a
 * typo in a `stack` array fails the build instead of shipping a price that is
 * silently missing a line.
 */
export function verticalStack(vertical: Vertical): VerticalStack {
  // Labels of the modules in THIS stack that bundle others in for free.
  const present = new Set(vertical.stack);

  const lines: StackLine[] = vertical.stack.map((module) => {
    const entry = catalog.get(module);
    const priced = ledger.get(module);
    if (!entry || !priced) {
      throw new Error(
        `[verticals] "${vertical.slug}" lists the module "${module}", which is missing from ` +
          `${entry ? 'the pricing LEDGER' : 'the module catalog'}. Add it there, or correct the stack.`
      );
    }

    // `includedWith` names modules by LABEL ("Commerce"), so resolve back to an
    // id and check it is actually in this stack — Inventory is only free if the
    // business is running Commerce, not merely because Commerce exists.
    const bundler = entry.includedWith
      ?.map((label) => MODULES.find((m) => m.label === label))
      .find((m) => m && present.has(m.id as StackModule));

    return {
      module,
      label: entry.label,
      replaces: priced.alt,
      elsewhere: dollars(priced.amt),
      price: bundler ? 0 : entry.price,
      bundledBy: bundler?.label,
    };
  });

  const monthly = lines.reduce((sum, l) => sum + l.price, 0);
  const elsewhere = lines.reduce((sum, l) => sum + l.elsewhere, 0);
  const saved = elsewhere - monthly;

  return {
    lines,
    monthly,
    elsewhere,
    saved,
    savedYearly: Math.round((saved * 12) / 100) * 100,
  };
}

/** `$1,002` — the one place a figure becomes a string, so every surface spells
 *  money the same way. */
export function money(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}
