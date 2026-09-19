// The words on "Stock versus your books", and nothing else.
//
// Split out of `gl-reconciliation.ts` so the copy can be tested without a
// database. The measurement half is six SQL walks; this half is a pure function
// from those numbers to the rows a person reads, which means every sentence and
// every count on that screen has a test that can go red.
//
// It was split because three things on it were wrong at once and none of them
// was reachable from a unit test:
//
//   "1 order lines"    every count hard-coded its plural. Juniper Row's one
//                      late supplier bill read "1 order lines".
//   "3 lines"          two of the counts are `COUNT(*)` over `inventory_levels`
//                      — an item at a location, which is not a line.
//   "…may not have"    a sentence that elides its own verb phrase and reads, to
//                      the business owner it is written for, as text that got
//                      cut off.

/** Each line either RAISES what the books should show relative to sparx, or
 *  lowers it. The sign is on `amountCents` and the direction is stated in the
 *  description, because an accountant reading a signed column with no words
 *  around it will read the sign the other way half the time. */
export type ReconciliationLineKind =
  | 'sparx_value'
  | 'goods_received_not_invoiced'
  | 'invoiced_not_received'
  | 'non_owned_stock'
  | 'priced_not_purchased'
  | 'uncosted_units'
  | 'in_transit'
  | 'ledger_value'
  | 'unexplained';

export interface ReconciliationLine {
  kind: ReconciliationLineKind;
  /**
   * The few words that name the line, for the row's heading.
   *
   * Carried rather than derived. The screen used to make one by cutting the
   * description at its em-dash, which stopped producing anything the day the
   * copy sweep removed em-dashes from this file: every heading became the whole
   * sentence, clipped mid-word, sitting directly above the same sentence in
   * full. A label a renderer has to guess is a label nobody owns.
   */
  label: string;
  /** Written for whoever is doing the reconciling — an owner or their
   *  bookkeeper, not an engineer. */
  description: string;
  /** Signed, in the tenant's reporting currency. Null where the figure could
   *  not be established, which is different from a difference of nothing. */
  amountCents: number | null;
  /** Where the number came from: `sparx` for anything derived from the ledger,
   *  the provider slug for anything read out of their accounting system, or
   *  `accountant` for a typed figure. */
  source: string;
  /** How many underlying rows the figure covers, or the account name for the
   *  ledger line — enough to go and look. */
  reference: string | null;
}

/** Everything the six walks measured, as plain numbers. */
export interface ReconciliationMeasurement {
  totalUnits: number;
  totalValueCents: number;

  grniCents: number;
  grniLines: number;
  inrCents: number;
  inrLines: number;

  nonOwnedCents: number;
  /** `inventory_levels` rows, so: items at a location. */
  nonOwnedItems: number;

  pricedOnlyCents: number;
  /** `inventory_levels` rows, so: items at a location. */
  pricedOnlyItems: number;

  /** Already NET of the priced-not-purchased units, so the same garments are
   *  never reported twice — once as money found and once as money unknown. */
  uncostedUnits: number;

  inTransitCents: number;
  inTransitLines: number;

  /** What the business said its inventory account holds, or null when nobody
   *  has said. NOT zero: see the note on `unexplainedCents` below. */
  ledger: { accountName: string; balanceCents: number; source: string } | null;
}

export interface ReconciliationWords {
  lines: ReconciliationLine[];
  explainedCents: number;
  /** NULL until the books figure is entered. A reconciliation that reports a
   *  zero difference because it has nothing to compare against is the single
   *  most dangerous number this screen could produce. */
  unexplainedCents: number | null;
}

/**
 * "1 order line", not "1 order lines".
 *
 * Every count on this screen is a number followed by a noun, and every one of
 * them used to hard-code the plural.
 */
export function count(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

export function reconciliationWords(m: ReconciliationMeasurement): ReconciliationWords {
  const lines: ReconciliationLine[] = [
    {
      kind: 'sparx_value',
      label: 'What we make it',
      description: 'What your stock is valued at here, from your deliveries and sales',
      amountCents: m.totalValueCents,
      source: 'sparx',
      reference: `${count(m.totalUnits, 'unit', 'units')} on hand`,
    },
    {
      kind: 'goods_received_not_invoiced',
      label: 'On your shelves, not yet invoiced',
      description:
        'On your shelves with no supplier invoice yet: counted here, but not in your books until the bill arrives',
      amountCents: m.grniCents,
      source: 'sparx',
      reference: count(m.grniLines, 'order line', 'order lines'),
    },
    {
      kind: 'invoiced_not_received',
      label: 'Invoiced, not yet on your shelves',
      description:
        'Invoiced by a supplier but not yet booked in. Your books have it, your shelves do not',
      amountCents: -m.inrCents,
      source: 'sparx',
      reference: count(m.inrLines, 'order line', 'order lines'),
    },
    {
      kind: 'non_owned_stock',
      label: 'In your building, but not yours',
      description:
        'Consigned or customer-owned stock in your building. It is left out of your value here; if your books include it, this is the difference (measured today, not at the date above: ownership is not dated)',
      amountCents: m.nonOwnedCents,
      source: 'sparx',
      reference: count(m.nonOwnedItems, 'item', 'items'),
    },
    {
      kind: 'priced_not_purchased',
      label: 'Priced by you, not bought through us',
      description:
        m.pricedOnlyCents > 0
          ? 'Stock you counted onto the shelf and put a cost price against yourself. Your other stock screens include it, and the figure above is built only from what you bought through us, so this is the difference between them (measured today, not at the date above: a cost price has no history)'
          : 'Everything you hold that has a price was bought through us, so both figures agree',
      amountCents: m.pricedOnlyCents,
      source: 'sparx',
      reference: count(m.pricedOnlyItems, 'item', 'items'),
    },
    {
      kind: 'uncosted_units',
      label:
        m.uncostedUnits > 0 ? 'Units with no cost behind them' : 'Every unit has a cost behind it',
      description:
        m.uncostedUnits > 0
          ? `${count(m.uncostedUnits, 'unit', 'units')} counted onto the shelf with nothing recorded about what they cost. They are worth nothing in this figure, because nothing was ever paid for them that we can see. If your books carry an opening balance for them, that is the difference`
          : 'Every unit on hand has a cost behind it',
      // Deliberately null and not zero: the units exist and their value is
      // genuinely unknown. Reporting $0 would assert they are worthless.
      amountCents: m.uncostedUnits > 0 ? null : 0,
      source: 'sparx',
      reference: m.uncostedUnits > 0 ? count(m.uncostedUnits, 'unit', 'units') : null,
    },
    {
      kind: 'in_transit',
      label: 'Moving between your locations',
      description: 'Shipped from one of your locations and not yet booked into the other',
      amountCents: m.inTransitCents,
      source: 'sparx',
      reference: count(m.inTransitLines, 'transfer line', 'transfer lines'),
    },
  ];

  const explainedCents =
    m.grniCents - m.inrCents + m.nonOwnedCents + m.inTransitCents + m.pricedOnlyCents;
  const unexplainedCents =
    m.ledger === null ? null : m.ledger.balanceCents - (m.totalValueCents + explainedCents);

  lines.push({
    kind: 'ledger_value',
    label: 'What your books say',
    description: m.ledger
      ? 'What your accounting system says the inventory account holds'
      : 'Nobody has entered what your inventory account says yet',
    amountCents: m.ledger?.balanceCents ?? null,
    source: m.ledger?.source ?? 'accountant',
    reference: m.ledger?.accountName ?? null,
  });

  lines.push({
    kind: 'unexplained',
    label: 'Unexplained',
    description:
      unexplainedCents === null
        ? 'Cannot be worked out until your inventory account balance is entered'
        : unexplainedCents === 0
          ? 'Nothing unexplained: the two agree once the timing differences are allowed for'
          : 'Left over after every timing difference above. This is the part worth investigating',
    amountCents: unexplainedCents,
    source: 'sparx',
    reference: null,
  });

  return { lines, explainedCents, unexplainedCents };
}
