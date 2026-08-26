import { calculateTotals, formatMoney, WORDS, type DocumentInput } from './document';
import type { ToolResultLine } from '../tool-result-context';

/** How many line items the email repeats before it stops and says so. The
 *  delivery gate takes fifty lines and the header and totals claim some; a long
 *  document is summarized with its remainder counted, never quietly cut. */
const MAX_ITEM_LINES = 30;

/** Whether there is anything worth sending yet. */
export function documentHasContent(input: DocumentInput): boolean {
  return input.items.some((item) => item.description.trim() !== '' || item.unitPrice > 0);
}

/** What the document SAYS, as email lines — never the PDF and never the logo,
 *  which came off the visitor's own machine. Items are numbered because two
 *  lines can legitimately read the same and a line can still be blank. */
export function documentLines(input: DocumentInput): ToolResultLine[] {
  const words = WORDS[input.kind];
  const totals = calculateTotals(input);
  const money = (n: number) => formatMoney(n, input.currency);
  const shown = input.items.slice(0, MAX_ITEM_LINES);

  return [
    { label: words.number, value: input.number || 'Not numbered yet' },
    ...(input.to.name.trim() ? [{ label: 'For', value: input.to.name }] : []),
    ...(input.issuedOn ? [{ label: words.dateLabel, value: input.issuedOn }] : []),
    ...(input.dueOn ? [{ label: words.dueLabel, value: input.dueOn }] : []),
    ...shown.map((item, i) => ({
      label: `${i + 1}. ${item.description.trim() || 'Not described yet'}`,
      value: `${item.quantity} × ${money(item.unitPrice)} = ${money(item.quantity * item.unitPrice)}`,
    })),
    ...(input.items.length > shown.length
      ? [
          {
            label: 'And more',
            value: `${input.items.length - shown.length} further lines are on the document but not listed here.`,
          },
        ]
      : []),
    { label: 'Before tax', value: money(totals.subtotal) },
    ...(totals.discount > 0
      ? [{ label: `Discount (${input.discountPercent}%)`, value: `-${money(totals.discount)}` }]
      : []),
    ...(totals.tax > 0
      ? [{ label: `${input.taxLabel || 'Tax'} (${input.taxRate}%)`, value: money(totals.tax) }]
      : []),
    { label: words.totalLabel, value: money(totals.total) },
  ];
}
