'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { toast } from '@sparx/ui';
import { Button, Textarea, Loading } from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel } from './ui-kit';
import { DocumentFields } from './document-fields';
import { InvoiceItems } from './invoice-items';
import { InvoicePreview } from './invoice-preview';
import { type InvoiceData } from './lib/invoice';
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
          <p className="text-caption text-ink-subtle m-0 font-sans">
            Your details are saved on this device only, ready for the next one. The PDF is built
            entirely in your browser.
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
