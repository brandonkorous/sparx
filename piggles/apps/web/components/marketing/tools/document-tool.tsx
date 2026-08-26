'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, CardBody, Dropzone } from '@wizeworks/silicaui-react';
import {
  blankDocument,
  buildDocumentPdf,
  calculateTotals,
  CURRENCIES,
  formatMoney,
  WORDS,
  type DocumentInput,
  type DocumentKind,
  type LineItem,
} from './lib/document';
import { drawSquare, loadImageFile, type LoadedImage } from './lib/canvas';
import { downloadBlob, safeFilename } from './lib/download';
import { useLocalStorage } from './lib/use-local-storage';
import {
  Aside,
  AreaField,
  ColorField,
  Panel,
  Problem,
  SelectField,
  TextField,
  ToolLayout,
} from './ui-kit';
import { useReportToolResult } from './tool-result-context';
import { documentHasContent, documentLines } from './lib/document-email';

/**
 * The invoice maker and the quote maker.
 *
 * ONE component for both. They are the same document with different words — see
 * the note at the top of lib/document.ts. The two pages pass a different `kind`
 * and everything else follows from `WORDS`.
 *
 * ── YOUR OWN DETAILS ARE REMEMBERED; THE CUSTOMER'S ARE NOT ─────────────────
 *
 * Your business name and address are the same on every invoice you will ever
 * send, and retyping them is the single most annoying thing about every free
 * invoice tool. The customer's details are different every time, and — more to
 * the point — they are somebody else's information sitting in a browser on a
 * shared computer. So one half persists and the other half does not, and the
 * page says which.
 */
export function DocumentTool({ kind }: { kind: DocumentKind }) {
  const words = WORDS[kind];

  // Only the sender half is stored, keyed per kind so an invoice and a quote can
  // legitimately carry different addresses if somebody wants that.
  const [sender, setSender] = useLocalStorage(
    `piggles.tools.${kind}.from`,
    blankDocument(kind).from
  );
  const [doc, setDoc] = useState<DocumentInput>(() => blankDocument(kind));
  const [logo, setLogo] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const logoCanvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    logoCanvas.current = logo ? drawSquare(logo, { size: 256, fit: 'contain' }) : null;
  }, [logo]);

  // Memoised so the totals are not recomputed on every keystroke anywhere in the
  // form — and, more to the point, so `full` is a stable object rather than a new
  // one each render, which would defeat the memo entirely.
  const full: DocumentInput = useMemo(
    () => ({ ...doc, from: sender, logo: logoCanvas.current }),
    [doc, sender]
  );
  const totals = useMemo(() => calculateTotals(full), [full]);

  const set = <K extends keyof DocumentInput>(key: K, value: DocumentInput[K]) =>
    setDoc((prev) => ({ ...prev, [key]: value }));

  const setItem = (id: string, patch: Partial<LineItem>) =>
    setDoc((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));

  const addItem = () =>
    setDoc((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        // A random suffix, not `items.length` — deleting the middle row and
        // adding one would otherwise re-mint an id that is already in use, and
        // React would reconcile two different rows as the same one.
        {
          id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          description: '',
          quantity: 1,
          unitPrice: 0,
        },
      ],
    }));

  const removeItem = (id: string) =>
    setDoc((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));

  // One wiring covers both documents this becomes. The PDF stays here, the logo
  // especially — what travels is what the document SAYS, which is the half worth
  // having in an inbox when somebody checks a total from their phone.
  useReportToolResult(
    documentHasContent(full)
      ? {
          lines: documentLines(full),
          note: `Open the tool again to download the ${kind} as a PDF. Your own details are still saved in that browser, so it opens ready to go — the customer's are not, which is deliberate if you are on a shared computer.`,
        }
      : null
  );

  const download = async () => {
    setBuilding(true);
    setError(null);
    try {
      const blob = await buildDocumentPdf(full);
      downloadBlob(
        blob,
        `${words.filePrefix}-${safeFilename(doc.number || '1', '1')}-${safeFilename(doc.to.name, 'customer')}.pdf`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The PDF could not be made.');
    } finally {
      setBuilding(false);
    }
  };

  const ready = Boolean(sender.name && doc.to.name && doc.items.some((i) => i.description));

  return (
    <ToolLayout
      outputWidth="wide"
      form={
        <>
          <Panel
            title="You"
            description="Kept on this device, so you only type it once."
            actions={
              sender.name ? (
                <button
                  type="button"
                  className="text-base font-semibold underline underline-offset-4"
                  onClick={() => setSender(blankDocument(kind).from)}
                >
                  Forget my details
                </button>
              ) : undefined
            }
          >
            <TextField
              label="Business name"
              value={sender.name}
              onChange={(v) => setSender({ ...sender, name: v })}
            />
            <AreaField
              label="Address"
              value={sender.address}
              onChange={(v) => setSender({ ...sender, address: v })}
              rows={3}
            />
            <TextField
              label="Email"
              value={sender.email}
              onChange={(v) => setSender({ ...sender, email: v })}
              inputMode="email"
              spellCheck={false}
            />
            <TextField
              label="Phone"
              value={sender.phone}
              onChange={(v) => setSender({ ...sender, phone: v })}
              inputMode="tel"
            />
            <TextField
              label="Tax number (optional)"
              hint="If you are registered for VAT or sales tax, most authorities require it on the document."
              value={sender.taxId}
              onChange={(v) => setSender({ ...sender, taxId: v })}
            />

            <Dropzone
              className="border-module"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              multiple={false}
              onFiles={async (files) => {
                const file = files[0];
                if (!file) return;
                try {
                  setError(null);
                  setLogo(await loadImageFile(file));
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'That image could not be opened.');
                }
              }}
              title={logo ? 'Drop a different logo' : 'Your logo (optional)'}
              hint="Appears at the top of the document."
            />
          </Panel>

          <Panel title={kind === 'invoice' ? 'Who you are billing' : 'Who it is for'}>
            <TextField
              label="Name"
              value={doc.to.name}
              onChange={(v) => set('to', { ...doc.to, name: v })}
            />
            <AreaField
              label="Address"
              value={doc.to.address}
              onChange={(v) => set('to', { ...doc.to, address: v })}
              rows={3}
            />
            <TextField
              label="Email"
              value={doc.to.email}
              onChange={(v) => set('to', { ...doc.to, email: v })}
              inputMode="email"
              spellCheck={false}
            />
            {/* `{' '}` after the bold, NOT a plain space. A space that sits at
 the end of a wrapped JSX line is eaten by the compiler, so"remembered.They" is what actually renders — see the note on
 `Aside` in ui-kit.tsx. */}
            <Aside>
              <strong>Your customer&rsquo;s details are deliberately not remembered.</strong> They
              are somebody else&rsquo;s information, and this may not be your only computer.
            </Aside>
          </Panel>

          <Panel title="Reference">
            <TextField
              label={words.number}
              hint={
                kind === 'invoice'
                  ? 'Unique, and never going backwards — most tax authorities expect a sequence with no gaps. Starting at 001 tells every customer you have never invoiced anybody before.'
                  : 'Any format you like, as long as you can find it again when they accept.'
              }
              value={doc.number}
              onChange={(v) => set('number', v)}
            />
            <TextField
              label={words.dateLabel}
              type="date"
              value={doc.issuedOn}
              onChange={(v) => set('issuedOn', v)}
            />
            <TextField
              label={words.dueLabel}
              type="date"
              hint={
                kind === 'invoice'
                  ? 'An invoice with no due date gets paid whenever. Fourteen days, stated plainly, is the single most effective change most businesses make.'
                  : 'Without one, a customer can accept a price you gave before your costs went up. Thirty days is the usual convention.'
              }
              value={doc.dueOn}
              onChange={(v) => set('dueOn', v)}
            />
          </Panel>

          <Panel
            title={kind === 'invoice' ? 'What you did' : 'The work'}
            description="More detail invites better questions. One line saying “kitchen refit” invites only one."
            actions={
              <button
                type="button"
                className="text-base font-semibold underline underline-offset-4"
                onClick={addItem}
              >
                Add a line
              </button>
            }
          >
            {doc.items.map((item, index) => (
              <div
                key={item.id}
                className="border-base-300 flex flex-col gap-4 border-b pb-5 last:border-0 last:pb-0"
              >
                <TextField
                  label={`Line ${index + 1}`}
                  value={item.description}
                  onChange={(v) => setItem(item.id, { description: v })}
                  placeholder="Supply and fit of replacement worktop"
                />
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    label="Quantity"
                    value={String(item.quantity)}
                    onChange={(v) => setItem(item.id, { quantity: Number(v) || 0 })}
                    inputMode="decimal"
                  />
                  <TextField
                    label="Price each"
                    value={String(item.unitPrice)}
                    onChange={(v) => setItem(item.id, { unitPrice: Number(v) || 0 })}
                    inputMode="decimal"
                  />
                </div>
                {doc.items.length > 1 ? (
                  <button
                    type="button"
                    className="self-start text-base font-semibold underline underline-offset-4"
                    onClick={() => removeItem(item.id)}
                  >
                    Remove this line
                  </button>
                ) : null}
              </div>
            ))}
          </Panel>

          <Panel title="Money">
            <SelectField
              label="Currency"
              value={doc.currency}
              onChange={(v) => set('currency', v)}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Tax rate %"
                value={String(doc.taxRate)}
                onChange={(v) => set('taxRate', Number(v) || 0)}
                inputMode="decimal"
              />
              <TextField
                label="Called"
                value={doc.taxLabel}
                onChange={(v) => set('taxLabel', v)}
                placeholder="VAT"
              />
            </div>
            <TextField
              label="Discount %"
              hint="Taken off before tax — tax is owed on what you actually charge."
              value={String(doc.discountPercent)}
              onChange={(v) => set('discountPercent', Number(v) || 0)}
              inputMode="decimal"
            />
            <ColorField
              label="Accent color"
              value={doc.accent}
              onChange={(v) => set('accent', v)}
            />
          </Panel>

          <Panel title="The bottom of the page">
            <AreaField
              label={words.termsLabel}
              hint={
                kind === 'invoice'
                  ? 'Your bank details, a payment link, or how you would like to be paid.'
                  : undefined
              }
              value={doc.paymentTerms}
              onChange={(v) => set('paymentTerms', v)}
              rows={3}
              placeholder={words.termsDefault}
            />
            <AreaField
              label="Notes (optional)"
              value={doc.notes}
              onChange={(v) => set('notes', v)}
              rows={2}
            />
          </Panel>
        </>
      }
      output={
        <>
          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">The totals</h3>
              <dl className="mt-4 flex flex-col gap-3">
                <Row label="Subtotal" value={formatMoney(totals.subtotal, doc.currency)} />
                {doc.discountPercent > 0 ? (
                  <Row
                    label={`Discount (${doc.discountPercent}%)`}
                    value={`−${formatMoney(totals.discount, doc.currency)}`}
                  />
                ) : null}
                {doc.taxRate > 0 ? (
                  <Row
                    label={`${doc.taxLabel || 'Tax'} (${doc.taxRate}%)`}
                    value={formatMoney(totals.tax, doc.currency)}
                  />
                ) : null}
              </dl>

              <div className="border-module mt-5 flex items-baseline justify-between gap-4 border-t-2 pt-4">
                <span className="text-lg font-bold">{words.totalLabel}</span>
                <span className="font-mono text-3xl font-extrabold">
                  {formatMoney(totals.total, doc.currency)}
                </span>
              </div>

              {error ? (
                <div className="mt-4">
                  <Problem>{error}</Problem>
                </div>
              ) : null}

              <Button
                color="module"
                size="lg"
                block
                className="mt-6"
                disabled={!ready || building}
                onClick={download}
              >
                {building
                  ? 'Making the PDF…'
                  : `Download the ${kind === 'invoice' ? 'invoice' : 'quote'}`}
              </Button>

              {!ready ? (
                <p className="mt-3 text-base">
                  Needs your business name,{' '}
                  {kind === 'invoice' ? 'who you are billing' : 'who it is for'}, and at least one
                  line with a description.
                </p>
              ) : (
                <p className="mt-3 text-base">
                  A print-ready PDF, made in this page. Nothing is uploaded and nothing is stamped
                  across it.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">Roughly how it will look</h3>
              <div className="rounded-box border-base-300 mt-4 border bg-white p-6 text-[#202631]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-bold">{sender.name || 'Your business'}</p>
                    <p className="mt-1 text-sm whitespace-pre-line">{sender.address}</p>
                  </div>
                  <p className="text-xl font-extrabold" style={{ color: doc.accent }}>
                    {words.title}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap justify-between gap-4 text-sm">
                  <div>
                    <p className="font-bold">{kind === 'invoice' ? 'Billed to' : 'Prepared for'}</p>
                    <p>{doc.to.name || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p>
                      {words.number}: <span className="font-bold">{doc.number || '—'}</span>
                    </p>
                    <p>
                      {words.dueLabel}: <span className="font-bold">{doc.dueOn || '—'}</span>
                    </p>
                  </div>
                </div>

                <table className="mt-6 w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#d8d4d6] text-left">
                      <th className="pb-2 font-bold">Description</th>
                      <th className="pb-2 text-right font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.items
                      .filter((i) => i.description || i.unitPrice > 0)
                      .map((item) => (
                        <tr key={item.id} className="border-b border-[#eae7e8]">
                          <td className="py-2">{item.description || '—'}</td>
                          <td className="py-2 text-right font-mono">
                            {formatMoney(item.quantity * item.unitPrice, doc.currency)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                <div className="mt-4 flex justify-end">
                  <div
                    className="rounded px-4 py-2 text-sm font-bold text-white"
                    style={{ backgroundColor: doc.accent }}
                  >
                    {words.totalLabel}: {formatMoney(totals.total, doc.currency)}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-base">
                The PDF is laid out properly with your logo, wrapped descriptions and the full
                addresses — this is just the shape of it.
              </p>
            </CardBody>
          </Card>
        </>
      }
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-base">{label}</dt>
      <dd className="font-mono text-base">{value}</dd>
    </div>
  );
}
