/**
 * Invoice domain model + money math. Kept framework-free so both the live HTML
 * preview and the pdf-lib PDF renderer compute identical totals from one place.
 */

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  businessName: string;
  businessAddress: string;
  businessEmail: string;
  logo: string | null;
  clientName: string;
  clientAddress: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxRate: number;
  /** Flat discount in the invoice currency. */
  discount: number;
  accent: string;
  notes: string;
  items: LineItem[];
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'MXN', 'BRL', 'ZAR'];

export function computeTotals(data: InvoiceData): InvoiceTotals {
  const subtotal = data.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );
  const discount = Math.min(Math.max(Number(data.discount) || 0, 0), subtotal);
  const taxable = subtotal - discount;
  const taxAmount = taxable * ((Number(data.taxRate) || 0) / 100);
  return { subtotal, discount, taxAmount, total: taxable + taxAmount };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

let counter = 0;
/** Stable-enough id for a new line item (React key + dnd not needed here). */
export function newLineItem(): LineItem {
  counter += 1;
  return {
    id: `li-${counter}-${Math.round(performance.now())}`,
    description: '',
    quantity: 1,
    unitPrice: 0,
  };
}
