// The inventory journal (docs/146 Phase 10.7–10.8).
//
// What an accountant needs from a stock system, expressed as double entry — and
// the reason this file is pure arithmetic with no database and no HTTP anywhere
// near it: the journal that goes to QuickBooks and the journal that goes to Xero
// and the journal shown on the screen before either is sent MUST be the same
// journal. Two implementations would eventually post different numbers to the
// books of the same business, which is the one class of bug in this codebase
// that ends in a conversation with an accountant.
//
// ── sparx does not keep a ledger, and this does not change that ──────────────
//
// docs/148 §1 makes "no general ledger, no double entry, no chart of accounts" a
// permanent product position. Nothing here contradicts it: this file does not
// STORE a ledger, it TRANSLATES movements into the shape their ledger expects at
// the moment of handing them over. The entries are computed from
// `inventory_movements` every time and never persisted, so there is no second
// set of books to fall out of step with the first.
//
// ── The entries a stock system produces ──────────────────────────────────────
//
// Perpetual inventory, which is what a system that tracks every movement is:
//
//   RECEIPT     Dr Inventory        Cr Accrued purchases (goods received,
//                                      not yet invoiced)
//   SALE        Dr Cost of goods    Cr Inventory
//   SHRINKAGE   Dr Shrinkage        Cr Inventory
//   ADJUSTMENT  Dr/Cr Inventory     Cr/Dr Inventory adjustments
//   OPENING     Dr Inventory        Cr Opening balances (day one only)
//
// A transfer between the business's own locations posts NOTHING. The asset has
// not changed and the account has not changed; the only thing that moved is
// which shelf it is on, and posting a wash entry for it is how a month's journal
// becomes four hundred lines an accountant has to skim past.

import { z } from 'zod';

// ─── The accounts a journal touches ──────────────────────────────────────────

/**
 * The accounts an inventory journal needs, by role.
 *
 * Roles rather than names, because the names are the tenant's: "1200 Stock" for
 * one business and "Inventory — Raw Materials" for another. The mapping from
 * role to their real account is stored per connection and offered from THEIR
 * chart of accounts, never typed into a free-text box (docs/148 §6 rule 2).
 */
export const JournalAccountRole = z.enum([
  /** The asset. Everything else here is its counterpart. */
  'inventory',
  /** What goods cost when they sold. */
  'cost_of_goods',
  /** Received, not yet invoiced — the liability that sits between a delivery
   *  and its supplier bill. */
  'accrued_purchases',
  /** Losses, breakages and count shortfalls. Kept OUT of cost of goods on
   *  purpose: an accountant who cannot see shrinkage separately cannot tell a
   *  margin problem from a theft problem. */
  'shrinkage',
  /** Manual corrections that are neither a sale nor a loss. */
  'inventory_adjustment',
  /** Where the value of stock that already existed on day one comes FROM
   *  (docs/146 Phase 11.4). An opening balance is not a purchase and not a
   *  correction — nobody bought it from sparx's point of view and nothing was
   *  wrong before. Posting it as either would misstate the first month:
   *  as a purchase it invents a supplier liability, as a correction it makes
   *  the business look like it found a warehouse it had lost. */
  'opening_balance',
]);
export type JournalAccountRole = z.infer<typeof JournalAccountRole>;

export const JOURNAL_ACCOUNT_ROLES = JournalAccountRole.options;

/** How each role reads on a mapping screen, in the owner's language. */
export const JOURNAL_ROLE_LABELS: Record<JournalAccountRole, string> = {
  inventory: 'Stock on hand (an asset)',
  cost_of_goods: 'Cost of goods sold',
  accrued_purchases: 'Deliveries not yet invoiced',
  shrinkage: 'Stock losses and breakages',
  inventory_adjustment: 'Stock corrections',
  opening_balance: 'Opening balances (what you started with)',
};

// ─── A journal ───────────────────────────────────────────────────────────────

export interface JournalLine {
  role: JournalAccountRole;
  /** Positive cents. A line is a debit or a credit, never a signed amount —
   *  signed amounts are how a journal ends up unbalanced by twice a number. */
  debitCents: number;
  creditCents: number;
  /** What this line is, for the memo column in their books. */
  description: string;
  /** How many stock movements are behind it, so a figure can be traced back. */
  movements: number;
}

export interface InventoryJournal {
  /** The date the entry is posted at — the period's last day. */
  postingDate: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  lines: JournalLine[];
  totalDebitCents: number;
  totalCreditCents: number;
  /** Debits minus credits. Zero on a valid journal; anything else means it must
   *  not be sent. */
  imbalanceCents: number;
  /** Movements in the period carrying no cost, and therefore contributing
   *  nothing to the entry above. A non-zero count means the journal UNDERSTATES,
   *  and it is reported rather than left for somebody to find in a variance. */
  uncostedMovements: number;
  /** Movements that were deliberately not posted — transfers between the
   *  business's own locations, which change no account. */
  ignoredMovements: number;
}

/** One period's costed movements, grouped by reason — exactly what the SQL in
 *  the service produces. */
export interface JournalSourceRow {
  reason: string;
  /** Signed, summed from `cost_consumed_cents` for outbound reasons and from
   *  quantity × unit cost for inbound ones. Positive = value left the asset. */
  costCents: number;
  movements: number;
  /** Movements in this reason with no cost stamped. */
  uncostedMovements: number;
}

/** Reasons that move value between accounts, and which counterpart each uses.
 *  Anything absent from this map is a movement the journal ignores. */
const REASON_TREATMENT: Record<
  string,
  { counterpart: JournalAccountRole; direction: 'into_inventory' | 'out_of_inventory' }
> = {
  receive: { counterpart: 'accrued_purchases', direction: 'into_inventory' },
  sale: { counterpart: 'cost_of_goods', direction: 'out_of_inventory' },
  // A customer return puts goods back on the shelf and reverses the cost of the
  // sale. Same pair as a sale, the other way round.
  return: { counterpart: 'cost_of_goods', direction: 'into_inventory' },
  cancel: { counterpart: 'cost_of_goods', direction: 'into_inventory' },
  loss: { counterpart: 'shrinkage', direction: 'out_of_inventory' },
  damage: { counterpart: 'shrinkage', direction: 'out_of_inventory' },
  recount: { counterpart: 'inventory_adjustment', direction: 'out_of_inventory' },
  manual: { counterpart: 'inventory_adjustment', direction: 'out_of_inventory' },
  sync: { counterpart: 'inventory_adjustment', direction: 'out_of_inventory' },
  // Day one. Value arrives in the asset against opening balances, which is what
  // an accountant expects to see for stock that predates the system.
  opening: { counterpart: 'opening_balance', direction: 'into_inventory' },
};

/** Reasons deliberately posted as nothing. Named rather than defaulted so a new
 *  reason lands in `ignoredMovements` visibly instead of silently becoming an
 *  adjustment nobody asked for. */
const IGNORED_REASONS = new Set(['transfer_in', 'transfer_out', 'reserve', 'release']);

const DESCRIPTIONS: Record<string, string> = {
  receive: 'Goods received',
  sale: 'Cost of goods sold',
  return: 'Customer returns back to stock',
  cancel: 'Cancelled orders back to stock',
  loss: 'Stock losses',
  damage: 'Damaged stock written off',
  recount: 'Stock count corrections',
  manual: 'Manual stock corrections',
  sync: 'Corrections from a connected system',
  opening: 'Opening stock balances',
};

/**
 * Build the period's journal.
 *
 * ── Why it nets per counterpart rather than per movement ─────────────────────
 *
 * An accountant wants one entry a month with five or six lines, not four
 * thousand. Netting also makes the entry self-checking: every line's counterpart
 * is Inventory, so the inventory line is the sum of all of them and the journal
 * balances by construction — which is what `imbalanceCents` verifies rather than
 * assumes.
 */
export function buildInventoryJournal(input: {
  rows: readonly JournalSourceRow[];
  periodStart: Date;
  periodEnd: Date;
  currency: string;
}): InventoryJournal {
  const byCounterpart = new Map<
    JournalAccountRole,
    { intoInventoryCents: number; movements: number; descriptions: Set<string> }
  >();
  let uncostedMovements = 0;
  let ignoredMovements = 0;

  for (const row of input.rows) {
    uncostedMovements += row.uncostedMovements;
    if (IGNORED_REASONS.has(row.reason)) {
      ignoredMovements += row.movements;
      continue;
    }
    const treatment = REASON_TREATMENT[row.reason];
    if (!treatment) {
      ignoredMovements += row.movements;
      continue;
    }
    // Normalise every reason to "how much value entered the asset". A sale's
    // cost is a positive number meaning value LEFT, so it flips.
    const intoInventory = treatment.direction === 'into_inventory' ? row.costCents : -row.costCents;

    const entry = byCounterpart.get(treatment.counterpart) ?? {
      intoInventoryCents: 0,
      movements: 0,
      descriptions: new Set<string>(),
    };
    entry.intoInventoryCents += intoInventory;
    entry.movements += row.movements;
    entry.descriptions.add(DESCRIPTIONS[row.reason] ?? row.reason);
    byCounterpart.set(treatment.counterpart, entry);
  }

  const lines: JournalLine[] = [];
  let inventoryDelta = 0;

  for (const [role, entry] of byCounterpart) {
    // A counterpart that nets to nothing over the period is left out. Posting a
    // zero line is noise an accountant has to read past.
    if (entry.intoInventoryCents === 0) continue;
    inventoryDelta += entry.intoInventoryCents;
    // Value entering inventory credits its counterpart; value leaving debits it.
    lines.push({
      role,
      debitCents: entry.intoInventoryCents < 0 ? -entry.intoInventoryCents : 0,
      creditCents: entry.intoInventoryCents > 0 ? entry.intoInventoryCents : 0,
      description: [...entry.descriptions].join(', '),
      movements: entry.movements,
    });
  }

  if (inventoryDelta !== 0) {
    // The asset line, first, because that is where an accountant looks first.
    lines.unshift({
      role: 'inventory',
      debitCents: inventoryDelta > 0 ? inventoryDelta : 0,
      creditCents: inventoryDelta < 0 ? -inventoryDelta : 0,
      description: 'Movement in stock on hand',
      movements: [...byCounterpart.values()].reduce((sum, e) => sum + e.movements, 0),
    });
  }

  const totalDebitCents = lines.reduce((sum, line) => sum + line.debitCents, 0);
  const totalCreditCents = lines.reduce((sum, line) => sum + line.creditCents, 0);

  return {
    postingDate: input.periodEnd.toISOString(),
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    currency: input.currency,
    lines,
    totalDebitCents,
    totalCreditCents,
    imbalanceCents: totalDebitCents - totalCreditCents,
    uncostedMovements,
    ignoredMovements,
  };
}

/**
 * Whether a journal may be sent.
 *
 * Three refusals, each one a thing that would be somebody's afternoon if it
 * reached their books:
 *
 *   unbalanced       the accounting package will reject it, but not always
 *                    before writing half of it.
 *   unmapped role    a line with no account behind it lands in a suspense
 *                    account, or silently in the wrong one.
 *   closed period    posting into a closed month is the single fastest way to
 *                    lose an accountant permanently (docs/148 §6 rule 1).
 */
export interface JournalGateResult {
  ok: boolean;
  reasons: string[];
}

export function checkJournalSendable(
  journal: InventoryJournal,
  mappedRoles: ReadonlySet<string>,
  booksClosedThrough: Date | null
): JournalGateResult {
  const reasons: string[] = [];

  if (journal.lines.length === 0) {
    reasons.push('Nothing moved in this period, so there is nothing to post');
  }
  if (journal.imbalanceCents !== 0) {
    reasons.push(
      `The entry does not balance — debits and credits differ by ${journal.imbalanceCents} cents`
    );
  }
  for (const line of journal.lines) {
    if (!mappedRoles.has(line.role)) {
      reasons.push(
        `${JOURNAL_ROLE_LABELS[line.role]} is not matched to an account in your books yet`
      );
    }
  }
  if (booksClosedThrough && new Date(journal.postingDate) <= booksClosedThrough) {
    reasons.push(
      'This period is inside the months your books are closed through, so nothing will be sent'
    );
  }

  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}
