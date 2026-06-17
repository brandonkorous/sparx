'use client';

import * as React from 'react';
import { Download, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  NativeSelect,
  ColorPicker,
  FileUpload,
  Spinner,
  toast,
} from '@sparx/ui';
import { Workbench, ControlsPane, OutputPane, Panel, Field } from './ui-kit';
import { InvoiceItems } from './invoice-items';
import { InvoicePreview } from './invoice-preview';
import { CURRENCIES, type InvoiceData } from './lib/invoice';
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
      return { ...prev, issueDate: iso(today), dueDate: iso(new Date(today.getTime() + 14 * 86400000)) };
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
        <Panel title="Your business">
          <Field label="Business name" htmlFor="doc-bn">
            <Input id="doc-bn" value={data.businessName} onChange={(e) => set({ businessName: e.target.value })} />
          </Field>
          <Field label="Address" htmlFor="doc-ba">
            <Textarea id="doc-ba" rows={2} value={data.businessAddress} onChange={(e) => set({ businessAddress: e.target.value })} />
          </Field>
          <div className="tool-fieldgrid">
            <Field label="Email" htmlFor="doc-be">
              <Input id="doc-be" type="email" value={data.businessEmail} onChange={(e) => set({ businessEmail: e.target.value })} />
            </Field>
            <Field label="Logo">
              {data.logo ? (
                <Button type="button" variant="outline" color="neutral" size="sm" onClick={() => set({ logo: null })}>
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              ) : (
                <FileUpload accept="image/*" maxSize={4 * 1024 * 1024} onFilesChange={handleLogo} />
              )}
            </Field>
          </div>
        </Panel>

        <Panel title={config.docTitle === 'QUOTE' ? 'Quote for' : 'Bill to'}>
          <Field label="Client name" htmlFor="doc-cn">
            <Input id="doc-cn" value={data.clientName} onChange={(e) => set({ clientName: e.target.value })} />
          </Field>
          <Field label="Client address" htmlFor="doc-ca">
            <Textarea id="doc-ca" rows={2} value={data.clientAddress} onChange={(e) => set({ clientAddress: e.target.value })} />
          </Field>
        </Panel>

        <Panel title="Details">
          <div className="tool-fieldgrid">
            <Field label={config.numberLabel} htmlFor="doc-no">
              <Input id="doc-no" value={data.invoiceNumber} onChange={(e) => set({ invoiceNumber: e.target.value })} />
            </Field>
            <Field label="Currency" htmlFor="doc-cur">
              <NativeSelect id="doc-cur" value={data.currency} onChange={(e) => set({ currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Issue date" htmlFor="doc-issue">
              <Input id="doc-issue" type="date" value={data.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
            </Field>
            <Field label={config.dateFieldLabel} htmlFor="doc-due">
              <Input id="doc-due" type="date" value={data.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Tax rate (%)" htmlFor="doc-tax">
              <Input id="doc-tax" type="number" min={0} step="0.1" value={data.taxRate} onChange={(e) => set({ taxRate: Number(e.target.value) })} />
            </Field>
            <Field label="Discount" htmlFor="doc-disc" hint="Flat amount.">
              <Input id="doc-disc" type="number" min={0} step="0.01" value={data.discount} onChange={(e) => set({ discount: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Accent color">
            <ColorPicker value={data.accent} onChange={(c) => set({ accent: c })} ariaLabel="Accent color" />
          </Field>
        </Panel>

        <Panel title="Line items">
          <InvoiceItems items={data.items} currency={data.currency} onChange={(items) => set({ items })} />
        </Panel>

        <Panel title="Notes">
          <Textarea rows={2} value={data.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Terms, thank-you note…" />
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel
          title="Preview"
          action={
            <Button type="button" color="module" variant="solid" size="sm" onClick={download} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              Download PDF
            </Button>
          }
        >
          <InvoicePreview data={data} title={config.docTitle} dateLabel={config.pdfDateLabel} />
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12.5px', color: 'var(--color-text-tertiary)', margin: 0 }}>
            Your details are saved on this device only, ready for the next one. The PDF is built
            entirely in your browser.
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
