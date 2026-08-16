import { A4, canvasToPdfImage, PdfDocument, textWidth, wrapText, type PdfImage } from './pdf';

/**
 * Invoices and quotes — one model and one layout, two sets of words.
 *
 * They are the same document. Both are a header with two addresses, a table of
 * things and prices, a total, and a line about when money should move. The
 * differences are entirely in the vocabulary — "Invoice number" against "Quote
 * number", "Due" against "Valid until", "Amount due" against "Estimated total" —
 * and in one field each.
 *
 * Building them as one thing is not code-golf: it means the tax rounding, the
 * discount order and the column widths are decided ONCE. Two copies of this
 * would disagree about whether the discount comes off before or after tax within
 * a month, and both would look right.
 */

export type DocumentKind = 'invoice' | 'quote';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface DocumentInput {
  kind: DocumentKind;
  /** Yours. Remembered on this device between documents. */
  from: { name: string; address: string; email: string; phone: string; taxId: string };
  to: { name: string; address: string; email: string };
  number: string;
  issuedOn: string;
  /** Due date on an invoice; valid-until on a quote. */
  dueOn: string;
  items: LineItem[];
  currency: string;
  taxRate: number;
  taxLabel: string;
  /** Percentage off the subtotal. */
  discountPercent: number;
  notes: string;
  paymentTerms: string;
  accent: string;
  /** A logo, already drawn to a canvas. */
  logo: HTMLCanvasElement | null;
}

export interface DocumentTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
}

/**
 * The sums, in the order that makes them right.
 *
 * Discount comes off BEFORE tax. That ordering is not a preference — tax is owed
 * on what is actually charged, so applying it to the pre-discount figure
 * overcharges the customer and overstates what you owe. Every line is rounded to
 * whole cents as it is produced rather than at the end, so the printed lines add
 * up to the printed total. A total computed from unrounded intermediates is off
 * by a cent often enough that somebody eventually queries an invoice over it.
 */
export function calculateTotals(input: DocumentInput): DocumentTotals {
  const round = (n: number) => Math.round(n * 100) / 100;

  const subtotal = round(
    input.items.reduce((sum, item) => sum + round(item.quantity * item.unitPrice), 0)
  );
  const discount = round(subtotal * (input.discountPercent / 100));
  const taxable = round(subtotal - discount);
  const tax = round(taxable * (input.taxRate / 100));
  const total = round(taxable + tax);

  return { subtotal, discount, taxable, tax, total };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(amount);
  } catch {
    // An unrecognised currency code should not stop somebody producing an
    // invoice — show the number with the code beside it.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export const WORDS: Record<
  DocumentKind,
  {
    title: string;
    number: string;
    dateLabel: string;
    dueLabel: string;
    totalLabel: string;
    termsLabel: string;
    termsDefault: string;
    filePrefix: string;
  }
> = {
  invoice: {
    title: 'INVOICE',
    number: 'Invoice number',
    dateLabel: 'Date issued',
    dueLabel: 'Payment due',
    totalLabel: 'Amount due',
    termsLabel: 'How to pay',
    termsDefault: 'Payment due within 14 days of the date above.',
    filePrefix: 'invoice',
  },
  quote: {
    title: 'QUOTE',
    number: 'Quote number',
    dateLabel: 'Date issued',
    dueLabel: 'Valid until',
    totalLabel: 'Estimated total',
    termsLabel: 'Terms',
    termsDefault: 'This quote is valid until the date above. Prices may change after that.',
    filePrefix: 'quote',
  },
};

/** Hex to the 0–1 triples a PDF wants. */
function pdfColour(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join('') : clean;
  const value = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(value)) return [0.1, 0.12, 0.16];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

const INK: [number, number, number] = [0.13, 0.15, 0.19];
const QUIET: [number, number, number] = [0.35, 0.38, 0.44];
const RULE: [number, number, number] = [0.85, 0.85, 0.87];

const MARGIN = 46;
const RIGHT = A4.width - MARGIN;

export async function buildDocumentPdf(input: DocumentInput): Promise<Blob> {
  const doc = new PdfDocument();
  const totals = calculateTotals(input);
  const words = WORDS[input.kind];
  const accent = pdfColour(input.accent);

  let image: PdfImage | null = null;
  if (input.logo) {
    try {
      image = await canvasToPdfImage(input.logo);
    } catch {
      // A logo that will not encode must not stop the invoice. Better a plain
      // document than an error message where the document should be.
    }
  }

  // ── Header ───────────────────────────────────────────────────────────────
  let y = MARGIN;

  if (image) {
    const height = 46;
    const width = Math.min(150, (image.width / image.height) * height);
    doc.drawImage(image, MARGIN, y, width, height);
  }

  doc.text(words.title, RIGHT, y, { size: 26, font: 'bold', align: 'right', colour: accent });
  y += image ? 52 : 34;

  doc.text(input.from.name || 'Your business', MARGIN, y, { size: 12, font: 'bold' });
  let fromY = y + 17;
  if (input.from.address) {
    fromY += doc.paragraph(input.from.address, MARGIN, fromY, 200, { size: 9.5, colour: QUIET });
  }
  for (const line of [input.from.email, input.from.phone, input.from.taxId].filter(Boolean)) {
    doc.text(line, MARGIN, fromY, { size: 9.5, colour: QUIET });
    fromY += 13;
  }

  // The reference block, right-aligned opposite the sender.
  let metaY = y;
  const meta: [string, string][] = [
    [words.number, input.number || '—'],
    [words.dateLabel, input.issuedOn || '—'],
    [words.dueLabel, input.dueOn || '—'],
  ];
  for (const [label, value] of meta) {
    doc.text(label, RIGHT - 110, metaY, { size: 9, colour: QUIET, align: 'right' });
    doc.text(value, RIGHT, metaY, { size: 9.5, font: 'bold', align: 'right' });
    metaY += 15;
  }

  y = Math.max(fromY, metaY) + 20;

  // ── Who it is for ────────────────────────────────────────────────────────
  doc.text(input.kind === 'invoice' ? 'Billed to' : 'Prepared for', MARGIN, y, {
    size: 9,
    colour: QUIET,
  });
  y += 14;
  doc.text(input.to.name || '—', MARGIN, y, { size: 11, font: 'bold' });
  y += 16;
  if (input.to.address)
    y += doc.paragraph(input.to.address, MARGIN, y, 240, { size: 9.5, colour: QUIET });
  if (input.to.email) {
    doc.text(input.to.email, MARGIN, y, { size: 9.5, colour: QUIET });
    y += 14;
  }

  y += 18;

  // ── The table ────────────────────────────────────────────────────────────
  const COL_QTY = RIGHT - 210;
  const COL_UNIT = RIGHT - 110;

  doc.rect(MARGIN, y, RIGHT - MARGIN, 24, [0.97, 0.96, 0.965]);
  doc.text('Description', MARGIN + 10, y + 7, { size: 9, font: 'bold' });
  doc.text('Qty', COL_QTY, y + 7, { size: 9, font: 'bold', align: 'right' });
  doc.text('Unit price', COL_UNIT, y + 7, { size: 9, font: 'bold', align: 'right' });
  doc.text('Amount', RIGHT - 10, y + 7, { size: 9, font: 'bold', align: 'right' });
  y += 30;

  const descriptionWidth = COL_QTY - MARGIN - 24;
  for (const item of input.items) {
    if (!item.description && item.quantity === 0) continue;

    // Long descriptions wrap, and the row grows to fit. A single line clipped at
    // the column edge is how an invoice ends up saying "Supply and fit of
    // replacement kitchen wor".
    const lines = wrapText(item.description || '—', descriptionWidth, 10);
    const amount = Math.round(item.quantity * item.unitPrice * 100) / 100;

    lines.forEach((line, i) => doc.text(line, MARGIN + 10, y + i * 14, { size: 10 }));
    doc.text(String(item.quantity), COL_QTY, y, { size: 10, align: 'right' });
    doc.text(formatMoney(item.unitPrice, input.currency), COL_UNIT, y, {
      size: 10,
      align: 'right',
    });
    doc.text(formatMoney(amount, input.currency), RIGHT - 10, y, {
      size: 10,
      align: 'right',
      font: 'bold',
    });

    y += Math.max(lines.length * 14, 14) + 8;
    doc.line(MARGIN, y - 4, RIGHT, y - 4, RULE, 0.4);

    // A very long list runs off the page. Rather than silently losing rows, stop
    // and say so — a truncated invoice that looks complete is far worse than one
    // that admits it.
    if (y > A4.height - 220) {
      doc.text(
        '… more items than fit on one page. Shorten the list or split the job.',
        MARGIN,
        y + 6,
        {
          size: 9,
          colour: [0.7, 0.2, 0.2],
        }
      );
      y += 22;
      break;
    }
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  y += 12;
  const totalRow = (label: string, value: string, bold = false, size = 10) => {
    doc.text(label, RIGHT - 110, y, {
      size,
      align: 'right',
      colour: bold ? INK : QUIET,
      font: bold ? 'bold' : 'regular',
    });
    doc.text(value, RIGHT - 10, y, { size, align: 'right', font: bold ? 'bold' : 'regular' });
    y += size + 8;
  };

  totalRow('Subtotal', formatMoney(totals.subtotal, input.currency));
  if (input.discountPercent > 0) {
    totalRow(
      `Discount (${input.discountPercent}%)`,
      `−${formatMoney(totals.discount, input.currency)}`
    );
  }
  if (input.taxRate > 0) {
    totalRow(
      `${input.taxLabel || 'Tax'} (${input.taxRate}%)`,
      formatMoney(totals.tax, input.currency)
    );
  }

  y += 4;
  doc.line(RIGHT - 190, y, RIGHT, y, RULE, 0.8);
  y += 12;

  const totalText = formatMoney(totals.total, input.currency);
  const boxWidth = Math.max(
    190,
    textWidth(totalText, 15, 'bold') + textWidth(words.totalLabel, 11, 'bold') + 40
  );
  doc.rect(RIGHT - boxWidth, y - 6, boxWidth, 34, accent);
  doc.text(words.totalLabel, RIGHT - boxWidth + 12, y + 4, {
    size: 11,
    font: 'bold',
    colour: [1, 1, 1],
  });
  doc.text(totalText, RIGHT - 12, y + 1, {
    size: 15,
    font: 'bold',
    align: 'right',
    colour: [1, 1, 1],
  });
  y += 48;

  // ── Terms and notes ──────────────────────────────────────────────────────
  const terms = input.paymentTerms || words.termsDefault;
  if (terms) {
    doc.text(words.termsLabel, MARGIN, y, { size: 9, font: 'bold', colour: QUIET });
    y += 14;
    y += doc.paragraph(terms, MARGIN, y, RIGHT - MARGIN - 200, { size: 9.5, colour: INK });
    y += 10;
  }
  if (input.notes) {
    doc.text('Notes', MARGIN, y, { size: 9, font: 'bold', colour: QUIET });
    y += 14;
    doc.paragraph(input.notes, MARGIN, y, RIGHT - MARGIN - 200, { size: 9.5, colour: INK });
  }

  // A quiet line at the very bottom. Not a watermark and not a logo — a credit
  // small enough that nobody would ask to remove it, on a document going to
  // somebody else's accounts department.
  doc.text('Made with the free invoice maker at meetpiggles.com/tools', MARGIN, A4.height - 34, {
    size: 7.5,
    colour: [0.62, 0.62, 0.66],
  });

  return doc.build();
}

/** A sensible starting document, so the page is never an empty form. Somebody
 *  arriving here wants to see the shape of the thing before they type. */
export function blankDocument(kind: DocumentKind): DocumentInput {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + (kind === 'invoice' ? 14 : 30));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return {
    kind,
    from: { name: '', address: '', email: '', phone: '', taxId: '' },
    to: { name: '', address: '', email: '' },
    number: kind === 'invoice' ? '0001' : 'Q-0001',
    issuedOn: iso(today),
    dueOn: iso(due),
    items: [
      { id: 'a', description: '', quantity: 1, unitPrice: 0 },
      { id: 'b', description: '', quantity: 1, unitPrice: 0 },
    ],
    currency: 'USD',
    taxRate: 0,
    taxLabel: 'Tax',
    discountPercent: 0,
    notes: '',
    paymentTerms: '',
    // Deep charcoal, NOT the Piggles pink.
    //
    // The pink is our brand, and this document goes out under somebody else's
    // name to somebody else's accounts department. Defaulting to it would put
    // our identity on every invoice made here by anybody who never opened the
    // colour picker — which is most people — and pink is also simply the wrong
    // register for a document about money. Charcoal is neutral, prints well, and
    // is the right thing to leave alone.
    accent: '#2D3443',
    logo: null,
  };
}

export const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'NZD',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'JPY',
  'CNY',
  'INR',
  'SGD',
  'HKD',
  'ZAR',
  'MXN',
  'BRL',
  'PLN',
  'AED',
];
