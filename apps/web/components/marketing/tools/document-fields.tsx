'use client';

import { Trash2 } from 'lucide-react';
import {
  Button,
  ColorPicker,
  FileUpload,
  Input,
  Textarea,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { Panel, Field } from './ui-kit';
import { CURRENCIES, type InvoiceData } from './lib/invoice';
import type { DocConfig } from './document-tool';

/**
 * The three data-entry panels of the invoice/quote generator — business, client,
 * and document details. Split out of `document-tool` so that file stays a
 * readable orchestrator (state + PDF handoff + layout) rather than a 275-line
 * wall of fields.
 *
 * Every control is a silica primitive; this file contributes layout only.
 */
export function DocumentFields({
  config,
  data,
  set,
  onLogo,
}: {
  config: DocConfig;
  data: InvoiceData;
  set: (patch: Partial<InvoiceData>) => void;
  onLogo: (files: File[]) => void;
}) {
  return (
    <>
      <Panel title="Your business">
        <Field label="Business name" htmlFor="doc-bn">
          <Input
            id="doc-bn"
            value={data.businessName}
            onChange={(e) => set({ businessName: e.target.value })}
          />
        </Field>
        <Field label="Address" htmlFor="doc-ba">
          <Textarea
            id="doc-ba"
            rows={2}
            value={data.businessAddress}
            onChange={(e) => set({ businessAddress: e.target.value })}
          />
        </Field>
        <div className="tool-fieldgrid">
          <Field label="Email" htmlFor="doc-be">
            <Input
              id="doc-be"
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
              <FileUpload accept="image/*" maxSize={4 * 1024 * 1024} onFilesChange={onLogo} />
            )}
          </Field>
        </div>
      </Panel>

      <Panel title={config.docTitle === 'QUOTE' ? 'Quote for' : 'Bill to'}>
        <Field label="Client name" htmlFor="doc-cn">
          <Input
            id="doc-cn"
            value={data.clientName}
            onChange={(e) => set({ clientName: e.target.value })}
          />
        </Field>
        <Field label="Client address" htmlFor="doc-ca">
          <Textarea
            id="doc-ca"
            rows={2}
            value={data.clientAddress}
            onChange={(e) => set({ clientAddress: e.target.value })}
          />
        </Field>
      </Panel>

      <Panel title="Details">
        <div className="tool-fieldgrid">
          <Field label={config.numberLabel} htmlFor="doc-no">
            <Input
              id="doc-no"
              value={data.invoiceNumber}
              onChange={(e) => set({ invoiceNumber: e.target.value })}
            />
          </Field>
          <Field label="Currency" htmlFor="doc-cur">
            <NativeSelect
              id="doc-cur"
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
          <Field label="Issue date" htmlFor="doc-issue">
            <Input
              id="doc-issue"
              type="date"
              value={data.issueDate}
              onChange={(e) => set({ issueDate: e.target.value })}
            />
          </Field>
          <Field label={config.dateFieldLabel} htmlFor="doc-due">
            <Input
              id="doc-due"
              type="date"
              value={data.dueDate}
              onChange={(e) => set({ dueDate: e.target.value })}
            />
          </Field>
        </div>
        <div className="tool-fieldgrid">
          <Field label="Tax rate (%)" htmlFor="doc-tax">
            <Input
              id="doc-tax"
              type="number"
              min={0}
              step="0.1"
              value={data.taxRate}
              onChange={(e) => set({ taxRate: Number(e.target.value) })}
            />
          </Field>
          <Field label="Discount" htmlFor="doc-disc" hint="Flat amount.">
            <Input
              id="doc-disc"
              type="number"
              min={0}
              step="0.01"
              value={data.discount}
              onChange={(e) => set({ discount: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="Accent color" hint="Tints the document's header rule and totals.">
          {/* silica's ColorPicker is OKLCH-native, so `format="hex"` is required:
              the PDF/preview writes this straight into a hex-only color slot.
              `variant="swatch"` keeps it a chip that opens the full editor in a
              popover — the full `panel` variant is a three-slider editor, far too
              heavy for the narrow controls column. */}
          <ColorPicker
            aria-label="Accent color"
            variant="swatch"
            format="hex"
            value={data.accent}
            onValueChange={(c) => set({ accent: c })}
          />
        </Field>
      </Panel>
    </>
  );
}
