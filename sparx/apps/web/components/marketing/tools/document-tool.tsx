'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { toast } from '@wizeworks/ui';
import { Button, Textarea, Loading } from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel } from './ui-kit';
import { DocumentFields } from './document-fields';
import { InvoiceItems } from './invoice-items';
import { InvoicePreview } from './invoice-preview';
import { computeTotals, formatMoney, type InvoiceData } from './lib/invoice';
import { useReportToolResult, type ToolResultLine } from './tool-result-context';
import { generateInvoicePdf } from './lib/invoice-pdf';
import { useLocalStorageState } from './lib/use-local-storage';
import { downloadBlob, readAsDataUrl } from './lib/download';

/** Config that turns the shared document tool into an invoice or a quote. */
export interface DocConfig {
  storageKey: string;
  docTitle: string;
  pdfDateLabel: string;
  dateFieldLabel: string;
  numberLabel: string;
  defaultNumber: string;
  defaultNotes: string;
  filenameBase: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** How many line items the email repeats before it stops and says so.
 *
 *  The delivery gate accepts fifty lines in total and the header, dates and
 *  totals claim some of those. A long invoice is summarized rather than silently
 *  cut: the count is stated so nobody reconciles against a partial list. */
const MAX_ITEM_LINES = 30;

/** The document's contents as email lines.
 *
 *  Item labels are numbered because two items can legitimately share a
 *  description ("Consulting" twice at different rates) and an unlabeled item is
 *  possible while someone is still typing — the number keeps every label present
 *  and distinct, which is what both the gate and the email's own markup need. */
function documentLines(data: InvoiceData, config: DocConfig): ToolResultLine[] {
  const totals = computeTotals(data);
  const money = (n: number) => formatMoney(n, data.currency);
  const shown = data.items.slice(0, MAX_ITEM_LINES);

  return [
    { label: config.numberLabel, value: data.invoiceNumber || 'Not numbered yet' },
    ...(data.clientName.trim() ? [{ label: 'Billed to', value: data.clientName }] : []),
    ...(data.issueDate ? [{ label: 'Issued', value: data.issueDate }] : []),
    ...(data.dueDate ? [{ label: config.dateFieldLabel, value: data.dueDate }] : []),
    ...shown.map((item, i) => ({
      label: `${i + 1}. ${item.description.trim() || 'Untitled item'}`,
      value: `${item.quantity} × ${money(Number(item.unitPrice) || 0)} = ${money(
        (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
      )}`,
    })),
    ...(data.items.length > shown.length
      ? [
          {
            label: 'More items',
            value: `${data.items.length - shown.length} further items are on the document but not listed here.`,
          },
        ]
      : []),
    { label: 'Subtotal', value: money(totals.subtotal) },
    ...(totals.discount > 0 ? [{ label: 'Discount', value: `-${money(totals.discount)}` }] : []),
    ...(totals.taxAmount > 0
      ? [{ label: `Tax (${data.taxRate}%)`, value: money(totals.taxAmount) }]
      : []),
    { label: 'Total', value: money(totals.total) },
  ];
}

export function DocumentTool({ config }: { config: DocConfig }) {
  const initial: InvoiceData = React.useMemo(
    () => ({
      businessName: 'Acme Co.',
      businessAddress: '123 Market St\nSan Francisco, CA 94103',
      businessEmail: 'billing@acme.co',
      logo: null,
      clientName: '',
      clientAddress: '',
      invoiceNumber: config.defaultNumber,
      issueDate: '',
      dueDate: '',
      currency: 'USD',
      taxRate: 0,
      discount: 0,
      accent: '#6366F1',
      notes: config.defaultNotes,
      items: [{ id: 'item-1', description: '', quantity: 1, unitPrice: 0 }],
    }),
    [config]
  );

  const [data, setData] = useLocalStorageState<InvoiceData>(config.storageKey, initial);
  const [busy, setBusy] = React.useState(false);
  const set = (patch: Partial<InvoiceData>) => setData((prev) => ({ ...prev, ...patch }));

  React.useEffect(() => {
    setData((prev) => {
      if (prev.issueDate) return prev;
      const today = new Date();
      return {
        ...prev,
        issueDate: iso(today),
        dueDate: iso(new Date(today.getTime() + 14 * 86400000)),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogo = async (files: File[]) => {
    const file = files[0];
    if (file) set({ logo: await readAsDataUrl(file) });
  };

  // One wiring covers both documents this component becomes. The PDF is built in
  // the browser and stays there — the logo especially, which came off the
  // visitor's own disk. What travels is what the document SAYS, which is the half
  // worth having in an inbox when someone wants to check a total on their phone.
  const hasContent = data.items.some(
    (item) => item.description.trim() !== '' || Number(item.unitPrice) > 0
  );
  useReportToolResult(
    hasContent
      ? {
          lines: documentLines(data, config),
          note: `Open the tool again to download the ${config.docTitle.toLowerCase()} as a PDF. Your details are still saved in that browser, so it opens exactly as you left it.`,
        }
      : null
  );

  const download = async () => {
    setBusy(true);
    try {
      const blob = await generateInvoicePdf(data, {
        title: config.docTitle,
        dateLabel: config.pdfDateLabel,
      });
      downloadBlob(blob, `${data.invoiceNumber || config.filenameBase}.pdf`);
    } catch {
      toast.error('Could not generate the PDF — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Workbench>
      <ControlsPane>
        <DocumentFields config={config} data={data} set={set} onLogo={handleLogo} />
        <Panel title="Line items">
          <InvoiceItems
            items={data.items}
            currency={data.currency}
            onChange={(items) => set({ items })}
          />
        </Panel>

        <Panel title="Notes">
          <Textarea
            rows={2}
            value={data.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Terms, thank-you note…"
          />
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel
          title="Preview"
          action={
            <Button
              type="button"
              color="module"
              variant="solid"
              size="sm"
              onClick={download}
              disabled={busy}
            >
              {busy ? <Loading className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              Download PDF
            </Button>
          }
        >
          <InvoicePreview data={data} title={config.docTitle} dateLabel={config.pdfDateLabel} />
          <p className="m-0 font-sans text-sm">
            Your details are saved on this device only, ready for the next one. The PDF is built
            entirely in your browser.
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
