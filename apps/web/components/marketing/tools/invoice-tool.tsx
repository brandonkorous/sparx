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

const DEFAULT: InvoiceData = {
  businessName: 'Acme Co.',
  businessAddress: '123 Market St\nSan Francisco, CA 94103',
  businessEmail: 'billing@acme.co',
  logo: null,
  clientName: '',
  clientAddress: '',
  invoiceNumber: 'INV-0001',
  issueDate: '',
  dueDate: '',
  currency: 'USD',
  taxRate: 0,
  discount: 0,
  accent: '#6366F1',
  notes: 'Thank you for your business.',
  items: [{ id: 'item-1', description: '', quantity: 1, unitPrice: 0 }],
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function InvoiceTool() {
  const [data, setData] = useLocalStorageState<InvoiceData>('sparx-invoice', DEFAULT);
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
      const blob = await generateInvoicePdf(data);
      downloadBlob(blob, `${data.invoiceNumber || 'invoice'}.pdf`);
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
          <Field label="Business name" htmlFor="inv-bn">
            <Input
              id="inv-bn"
              value={data.businessName}
              onChange={(e) => set({ businessName: e.target.value })}
            />
          </Field>
          <Field label="Address" htmlFor="inv-ba">
            <Textarea
              id="inv-ba"
              rows={2}
              value={data.businessAddress}
              onChange={(e) => set({ businessAddress: e.target.value })}
            />
          </Field>
          <div className="tool-fieldgrid">
            <Field label="Email" htmlFor="inv-be">
              <Input
                id="inv-be"
                type="email"
                value={data.businessEmail}
                onChange={(e) => set({ businessEmail: e.target.value })}
              />
            </Field>
            <Field label="Logo">
              {data.logo ? (
                <Button
                  type="button"
                  variant="outline"
                  color="neutral"
                  size="sm"
                  onClick={() => set({ logo: null })}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              ) : (
                <FileUpload accept="image/*" maxSize={4 * 1024 * 1024} onFilesChange={handleLogo} />
              )}
            </Field>
          </div>
        </Panel>

        <Panel title="Bill to">
          <Field label="Client name" htmlFor="inv-cn">
            <Input
              id="inv-cn"
              value={data.clientName}
              onChange={(e) => set({ clientName: e.target.value })}
            />
          </Field>
          <Field label="Client address" htmlFor="inv-ca">
            <Textarea
              id="inv-ca"
              rows={2}
              value={data.clientAddress}
              onChange={(e) => set({ clientAddress: e.target.value })}
            />
          </Field>
        </Panel>

        <Panel title="Details">
          <div className="tool-fieldgrid">
            <Field label="Invoice number" htmlFor="inv-no">
              <Input
                id="inv-no"
                value={data.invoiceNumber}
                onChange={(e) => set({ invoiceNumber: e.target.value })}
              />
            </Field>
            <Field label="Currency" htmlFor="inv-cur">
              <NativeSelect
                id="inv-cur"
                value={data.currency}
                onChange={(e) => set({ currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Issue date" htmlFor="inv-issue">
              <Input
                id="inv-issue"
                type="date"
                value={data.issueDate}
                onChange={(e) => set({ issueDate: e.target.value })}
              />
            </Field>
            <Field label="Due date" htmlFor="inv-due">
              <Input
                id="inv-due"
                type="date"
                value={data.dueDate}
                onChange={(e) => set({ dueDate: e.target.value })}
              />
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Tax rate (%)" htmlFor="inv-tax">
              <Input
                id="inv-tax"
                type="number"
                min={0}
                step="0.1"
                value={data.taxRate}
                onChange={(e) => set({ taxRate: Number(e.target.value) })}
              />
            </Field>
            <Field label="Discount" htmlFor="inv-disc" hint="Flat amount.">
              <Input
                id="inv-disc"
                type="number"
                min={0}
                step="0.01"
                value={data.discount}
                onChange={(e) => set({ discount: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Accent color">
            <ColorPicker
              value={data.accent}
              onChange={(c) => set({ accent: c })}
              ariaLabel="Accent color"
            />
          </Field>
        </Panel>

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
            placeholder="Payment terms, thank-you note…"
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
              {busy ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              Download PDF
            </Button>
          }
        >
          <InvoicePreview data={data} />
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12.5px',
              color: 'var(--color-text-tertiary)',
              margin: 0,
            }}
          >
            Your details are saved on this device only, ready for the next invoice. The PDF is built
            entirely in your browser.
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
