/**
 * Renders an InvoiceData to a print-ready PDF with pdf-lib (dynamically imported
 * so it never enters the marketing bundle). Uses the standard Helvetica family,
 * so money is formatted with WinAnsi-safe symbols (or the currency code) to keep
 * any glyph from crashing the font encoder.
 */
import { loadImageFromUrl, canvasToPngBytes } from './canvas';
import { computeTotals, type InvoiceData } from './invoice';

const SAFE_SYMBOLS: Record<string, string> = {
  USD: '$',
  CAD: '$',
  AUD: '$',
  MXN: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  BRL: 'R$',
  ZAR: 'R',
};

function pdfMoney(amount: number, currency: string): string {
  const digits = currency === 'JPY' ? 0 : 2;
  const num = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  const sym = SAFE_SYMBOLS[currency];
  return sym ? `${sym}${num}` : `${currency} ${num}`;
}

async function toPngBytes(dataUrl: string): Promise<Uint8Array | null> {
  try {
    const img = await loadImageFromUrl(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return await canvasToPngBytes(canvas);
  } catch {
    return null;
  }
}

/** Build the invoice PDF and return it as a Blob. */
export async function generateInvoicePdf(data: InvoiceData): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const totals = computeTotals(data);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const m = 50;
  const right = 562;
  const ink = rgb(0.1, 0.1, 0.11);
  const muted = rgb(0.42, 0.42, 0.46);
  const hex = /^#?([0-9a-f]{6})$/i.exec(data.accent.trim());
  const n = hex ? parseInt(hex[1]!, 16) : 0x6366f1;
  const accent = rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);

  const text = (s: string, x: number, y: number, size: number, f = font, color = ink) =>
    page.drawText(s, { x, y, size, font: f, color });
  const rt = (s: string, xr: number, y: number, size: number, f = font, color = ink) =>
    page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y, size, font: f, color });

  let y = 742;

  // Header — logo or business name (left), INVOICE block (right)
  const logoBytes = data.logo ? await toPngBytes(data.logo) : null;
  if (logoBytes) {
    const png = await pdf.embedPng(logoBytes);
    const h = 46;
    const w = (png.width / png.height) * h;
    page.drawImage(png, { x: m, y: y - h + 10, width: Math.min(w, 200), height: h });
  } else {
    text(data.businessName || 'Your Business', m, y, 18, bold);
  }
  rt('INVOICE', right, y + 2, 26, bold, accent);
  rt(`# ${data.invoiceNumber || '0001'}`, right, y - 22, 11, font, muted);

  y -= 70;
  page.drawLine({ start: { x: m, y }, end: { x: right, y }, thickness: 1.5, color: accent });
  y -= 26;

  // From / Bill To
  const fromTop = y;
  text('FROM', m, y, 9, bold, muted);
  text('BILL TO', 320, y, 9, bold, muted);
  y -= 16;
  const fromLines = [
    data.businessName,
    ...data.businessAddress.split('\n'),
    data.businessEmail,
  ].filter(Boolean);
  const toLines = [data.clientName, ...data.clientAddress.split('\n')].filter(Boolean);
  const rows = Math.max(fromLines.length, toLines.length);
  for (let i = 0; i < rows; i++) {
    if (fromLines[i])
      text(
        fromLines[i]!,
        m,
        fromTop - 16 - i * 14,
        10.5,
        i === 0 ? bold : font,
        i === 0 ? ink : muted
      );
    if (toLines[i])
      text(
        toLines[i]!,
        320,
        fromTop - 16 - i * 14,
        10.5,
        i === 0 ? bold : font,
        i === 0 ? ink : muted
      );
  }
  y = fromTop - 16 - rows * 14 - 10;

  // Dates row
  text(`Issued: ${data.issueDate || '—'}`, m, y, 10, font, muted);
  text(`Due: ${data.dueDate || '—'}`, 320, y, 10, font, muted);
  y -= 26;

  // Table header
  page.drawRectangle({
    x: m,
    y: y - 6,
    width: right - m,
    height: 22,
    color: rgb(0.96, 0.96, 0.97),
  });
  text('DESCRIPTION', m + 8, y, 9, bold, muted);
  rt('QTY', 400, y, 9, bold, muted);
  rt('UNIT', 480, y, 9, bold, muted);
  rt('AMOUNT', right - 8, y, 9, bold, muted);
  y -= 24;

  // Items
  for (const item of data.items) {
    if (!item.description && !item.unitPrice) continue;
    const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    const descLines = wrap(font, item.description || '—', 10.5, 320);
    descLines.forEach((line, i) => text(line, m + 8, y - i * 13, 10.5));
    rt(String(item.quantity), 400, y, 10.5);
    rt(pdfMoney(Number(item.unitPrice) || 0, data.currency), 480, y, 10.5);
    rt(pdfMoney(amount, data.currency), right - 8, y, 10.5);
    y -= Math.max(descLines.length * 13, 13) + 9;
    page.drawLine({
      start: { x: m, y: y + 4 },
      end: { x: right, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.92),
    });
  }

  // Totals
  y -= 12;
  const totalsRows: [string, string, boolean][] = [
    ['Subtotal', pdfMoney(totals.subtotal, data.currency), false],
  ];
  if (totals.discount > 0)
    totalsRows.push(['Discount', `-${pdfMoney(totals.discount, data.currency)}`, false]);
  if (totals.taxAmount > 0)
    totalsRows.push([`Tax (${data.taxRate}%)`, pdfMoney(totals.taxAmount, data.currency), false]);
  totalsRows.push(['Total', pdfMoney(totals.total, data.currency), true]);
  for (const [label, value, isTotal] of totalsRows) {
    const size = isTotal ? 13 : 10.5;
    const f = isTotal ? bold : font;
    text(label, 400, y, size, f, isTotal ? ink : muted);
    rt(value, right - 8, y, size, f, isTotal ? accent : ink);
    y -= isTotal ? 8 : 18;
    if (isTotal)
      page.drawLine({
        start: { x: 392, y: y + 22 },
        end: { x: right, y: y + 22 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.88),
      });
  }

  // Notes
  if (data.notes.trim()) {
    y -= 30;
    text('NOTES', m, y, 9, bold, muted);
    wrap(font, data.notes, 10, right - m).forEach((line, i) =>
      text(line, m, y - 16 - i * 13, 10, font, muted)
    );
  }

  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

function wrap(
  font: { widthOfTextAtSize: (s: string, size: number) => number },
  str: string,
  size: number,
  maxWidth: number
): string[] {
  const out: string[] = [];
  for (const paragraph of str.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out.length ? out : [''];
}
