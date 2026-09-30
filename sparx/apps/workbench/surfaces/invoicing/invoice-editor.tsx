'use client';

// The invoice editor — and the clearest example of what this app changes.
//
// The dashboard's version of this screen renders the form and a live preview
// side by side, permanently, because someone had to decide and that was the
// decision. It costs every operator half their screen whether or not they care
// about the preview, and it can't be undone without the layout feeling broken.
//
// Here the editor is just the editor. "Preview" opens a pane. Put it beside the
// form, on a second monitor, behind the form as a tab you check occasionally, or
// never open it at all. The editor doesn't know which you chose and has no
// opinion about it — it publishes its draft to the shared store and moves on.
//
// Saving is genuinely two-phase (header, then lines); the mechanics and the
// reasons live in ./save.ts.

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import {
  Alert,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Select,
  Textarea,
} from '@wizeworks/silicaui-react';
import { Eye, Save } from 'lucide-react';
import { EditorLayout } from '../../components/editor-layout';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { api } from '../../lib/api/client';
import { clearDraft, draftKey, publishDraft } from '../../lib/drafts';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { BillTo } from './bill-to';
import { LineItems } from './line-items';
import { InvoiceSummary } from './invoice-summary';
import { HistorySection } from './history';
import { DocumentActions, SendButton, StageControl, useDocumentWorkflow } from './lifecycle';
import { PaymentsSection } from './payments';
import { SignaturesSection } from './signatures';
import { InvoiceValidationError, listDocumentWorkflows, saveInvoice } from './save';
import { newLineKey, type DraftLine } from './totals';
import { EMPTY_DRAFT, previewDraft, type DraftShape } from './preview-draft';
import type { LineTypeOption } from './line-editor-modal';
import type { MarkupRuleSummary } from './line-markup';
import { documentNoun, isPriceOffer, newDocumentTitle } from './document-words';
import { normalizeDocument, type BillingDocument } from './types';

interface LineTypeApi extends LineTypeOption {
  isActive: boolean;
}

/** A markup rule as GET /v1/markup-rules returns it — with the scope flag we use
 *  to keep only the ones a document line may apply. */
interface MarkupRuleApi extends MarkupRuleSummary {
  appliesTo: string;
  isActive: boolean;
}

/** Server lines carry ids; local rows need a key too. */
function toDraftLines(doc: BillingDocument | undefined): DraftLine[] {
  return (doc?.lines ?? []).map((line) => ({
    key: newLineKey(),
    ...(line.id ? { id: line.id } : {}),
    lineTypeId: line.lineTypeId ?? null,
    description: line.description,
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice ?? 0),
    discountAmount: Number(line.discountAmount ?? 0),
    taxable: line.taxable ?? true,
    productId: line.productId ?? null,
    variantId: line.variantId ?? null,
    costCents: line.costCents ?? null,
    appliedMarkup: line.appliedMarkup ?? null,
  }));
}

export function InvoiceEditorSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = ctx.params.id ?? 'new';
  const isNew = id === 'new';
  // The kind of document the caller came to make, as a workflow SLUG.
  //
  // This screen is the one editor for every document the billing engine knows
  // about, so "make a quote" and "make an invoice" are the same screen with a
  // different workflow chosen. Without this param the only way to reach a quote
  // was to press New invoice and then change a dropdown, which asks a person to
  // already know that a quote IS an invoice underneath (issue 761).
  const wantedWorkflowSlug = typeof ctx.params.workflow === 'string' ? ctx.params.workflow : null;
  const key = draftKey('invoice', id);
  const queryClient = useQueryClient();

  const { data: doc } = useQuery({
    queryKey: ['invoicing', 'document', id],
    queryFn: () =>
      api.get<BillingDocument>(`/v1/invoicing/documents/${id}`).then(normalizeDocument),
    enabled: !isNew,
  });

  // Only a brand-new invoice needs a workflow resolved; an existing one already
  // belongs to whichever workflow created it.
  const { data: workflows } = useQuery({
    queryKey: ['invoicing', 'workflows'],
    queryFn: listDocumentWorkflows,
    enabled: isNew,
    staleTime: 300_000,
  });

  // The line composer's vocabulary: the tenant's line types (each carries a
  // pricing mode + tax default) and the markup rules a document line may use.
  // Both are small, change rarely, and are needed the moment the modal opens.
  const { data: lineTypes = [] } = useQuery({
    queryKey: ['invoicing', 'line-types'],
    queryFn: () => api.get<LineTypeApi[]>('/v1/invoicing/line-types'),
    staleTime: 300_000,
  });
  const activeLineTypes: LineTypeOption[] = lineTypes.filter((type) => type.isActive);

  // Commerce may be off on a services-only tenant, in which case /v1/markup-rules
  // 404s — degrade to ad-hoc markup only rather than failing the editor.
  const { data: markupRules = [] } = useQuery({
    queryKey: ['invoicing', 'markup-rules'],
    queryFn: () =>
      api
        .get<MarkupRuleApi[]>('/v1/markup-rules', { is_active: true })
        .catch(() => [] as MarkupRuleApi[]),
    staleTime: 300_000,
  });
  const documentMarkupRules: MarkupRuleSummary[] = markupRules.filter(
    (rule) => rule.appliesTo === 'document' || rule.appliesTo === 'both'
  );

  const [draft, setDraft] = useState<DraftShape>(EMPTY_DRAFT);
  const [original, setOriginal] = useState<DraftLine[]>([]);
  // The form as it was last loaded or saved, serialized alongside the workflow
  // it belonged to. Dirty is the comparison against it: a sticky boolean meant
  // "somebody touched something" rather than "this differs from what is
  // stored", so undoing an edit still left the pane claiming unsaved work,
  // still confirmed on close, and still lit the Save button (issue 507).
  const baselineRef = useRef<string>(JSON.stringify({ draft: EMPTY_DRAFT, workflowId: null }));
  // null until the operator chooses; falls back to the first workflow so a
  // single-workflow tenant never sees a decision it doesn't have.
  const [workflowId, setWorkflowId] = useState<string | null>(null);

  // A caller that named a kind of document gets it chosen for them, once the
  // workflows arrive. Only while the field is still untouched: this must seed
  // the choice, never overrule one the operator has since made.
  useEffect(() => {
    if (!isNew || !wantedWorkflowSlug || workflowId !== null) return;
    const wanted = workflows?.find((w) => w.slug === wantedWorkflowSlug);
    // No match is not an error worth a message. The workflow can be archived or
    // never seeded, and the editor still works — it opens on the default and
    // the "Document type" field is right there.
    if (!wanted) return;
    setWorkflowId(wanted.id);
    // The baseline moves with it, or the form is dirty before anybody has typed
    // anything: closing an untouched pane would ask to confirm losing work that
    // does not exist. That is issue 507's bug, and seeding a field is exactly
    // how it comes back.
    baselineRef.current = JSON.stringify({ draft: EMPTY_DRAFT, workflowId: wanted.id });
  }, [isNew, wantedWorkflowSlug, workflowId, workflows]);

  // Seed the form once the document arrives, and remember the lines it came
  // with — that snapshot is the only way to tell later that one was deleted.
  useEffect(() => {
    if (!doc) return;
    const lines = toDraftLines(doc);
    const seeded: DraftShape = {
      customerId: doc.customerId ?? null,
      billTo: {
        name: doc.billTo?.name ?? '',
        email: doc.billTo?.email ?? '',
        address: doc.billTo?.address ?? '',
      },
      taxRate: doc.taxRate,
      // The note the customer reads, as stored. It used to be hardcoded to `''`,
      // which made the box look empty on every load AND wiped the stored note on
      // the next save (`headerBody` sends `notes || null`). So a note could be
      // written, saved, and was gone the moment the pane reloaded, with the save
      // reporting success both times (issue 512).
      notes: doc.notes ?? '',
      // Seeded from the document for the same reason `notes` is: a field the
      // editor does not read is a field the next save WIPES, and the save
      // reports success while doing it.
      // Whichever column this kind of document keeps its date in. Reading only
      // `dueAt` showed an empty box on every quote that HAD an expiry, and the
      // next save then wrote that emptiness back over it.
      dueAt: (doc.validUntil ?? doc.dueAt)?.slice(0, 10) ?? '',
      lines,
    };
    setDraft(seeded);
    setOriginal(lines.filter((line) => line.id));
    baselineRef.current = JSON.stringify({ draft: seeded, workflowId: doc.workflowId ?? null });
  }, [doc]);

  // The document's own workflow — stage names, entry effects, and whether the
  // current stage locks editing. Not fetched for a new document (it has no
  // stage yet; it enters the chosen workflow's first stage on save).
  const { data: docWorkflow } = useDocumentWorkflow(doc?.workflowId);
  const currentStage = docWorkflow?.stages.find((stage) => stage.id === doc?.stageId);

  // Which KIND of document this is, once for the whole screen. An existing one
  // is whatever its workflow says; a new one is the kind the caller asked for,
  // or the kind chosen in "Document type", or the default. Everything that has
  // to name the thing reads this — the tab, the field help, the save messages,
  // and which date column the date goes in.
  const activeWorkflowSlug = doc
    ? (docWorkflow?.slug ?? null)
    : (workflows?.find((w) => w.id === (workflowId ?? workflows[0]?.id))?.slug ?? null);
  const noun = documentNoun(activeWorkflowSlug);
  const priceOffer = isPriceOffer(activeWorkflowSlug);

  const currency = doc?.currency ?? 'USD';
  // Locked is a STAGE fact, not a status fact: a finalized invoice is locked
  // long before it is void. Status stays as the fallback for the moment between
  // the document arriving and its workflow arriving.
  const readOnly = currentStage ? currentStage.locksEditing : doc?.status === 'void';

  // Publish on every change so any open preview — in this window or another —
  // follows along. Cleared when the pane closes so a stale draft can't outlive
  // it. WHAT goes in the payload, and why leaving a field out is not the same
  // as leaving it unchanged, is `./preview-draft`.
  useEffect(() => {
    publishDraft(
      key,
      previewDraft({ draft, doc, currency, workflowSlug: activeWorkflowSlug, priceOffer })
    );
  }, [draft, doc, key, currency, activeWorkflowSlug, priceOffer]);

  useEffect(() => () => clearDraft(key), [key]);

  // Registers with the pane so closing, replacing, or tearing it off confirms
  // first — and, in a detached window, so does the browser's own close button.
  //
  // This covers the HEADER form only. The line composer holds its own
  // uncommitted state and registers separately (line-editor-modal.tsx), which
  // is why a pane can be dirty while everything on this screen looks saved.
  // The same fallback the save uses, so choosing the workflow the document
  // already had reads clean rather than as a change.
  const dirty =
    JSON.stringify({ draft, workflowId: workflowId ?? doc?.workflowId ?? null }) !==
    baselineRef.current;
  useDirtySource(dirty, `This ${noun} has unsaved changes. Close it anyway?`);

  useEffect(() => {
    ctx.setTitle(
      isNew
        ? newDocumentTitle(activeWorkflowSlug)
        : (doc?.number ?? noun.charAt(0).toUpperCase() + noun.slice(1))
    );
  }, [ctx, isNew, doc?.number, activeWorkflowSlug, noun]);

  const save = useMutation({
    mutationFn: () =>
      saveInvoice({
        id,
        workflowId: workflowId ?? workflows?.[0]?.id ?? null,
        workflowSlug: activeWorkflowSlug,
        header: { ...draft, currency },
        lines: draft.lines,
        original,
      }),
    onSuccess: (saved) => {
      // The refetch that follows re-seeds the form and moves the baseline with
      // it; this covers the moment in between.
      baselineRef.current = JSON.stringify({
        draft,
        workflowId: workflowId ?? doc?.workflowId ?? null,
      });
      void queryClient.invalidateQueries({ queryKey: ['invoicing'] });
      // A new document has a real id now — retarget this pane at it so the
      // preview and any subsequent save address the saved document.
      if (isNew) ctx.open('invoicing.invoice.edit', { id: saved.id }, { target: 'replace' });
    },
  });

  const update = (patch: Partial<DraftShape>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  // A validation error is the operator's to fix and says so in their words; any
  // other failure is ours and shouldn't pretend to be actionable.
  const failure = save.error
    ? save.error instanceof InvoiceValidationError
      ? save.error.message
      : `This ${noun} could not be saved. It may be a temporary problem. Try again in a moment.`
    : null;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Editor actions"
        primary={
          <Button
            color="module"
            size="sm"
            disabled={!dirty || save.isPending || readOnly}
            onClick={() => {
              save.mutate();
            }}
          >
            <Save className="size-4" aria-hidden />
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        }
        controls={
          <>
            <Button
              color="neutral"
              variant="outline"
              size="sm"
              onClick={() => {
                // 'beside' is a suggestion, not a layout: it splits the current group
                // once. The operator can move it anywhere afterwards and it stays put.
                ctx.open('invoicing.invoice.preview', { id }, { target: 'beside' });
              }}
            >
              <Eye className="size-4" aria-hidden />
              Preview
            </Button>
            <div className="flex-1" />
            {/* Lifecycle lives in the header (docs/86 §5.1): the stage control IS
            the document's status and its actions, one control. Only for saved
            documents — a new draft has no stage until it enters its workflow. */}
            {/* Giving the document to the customer is the other half of making
            one, so it sits beside the stage control rather than behind the
            overflow menu. Saved documents only — an unsaved draft would send a
            different invoice from the one on screen. */}
            {doc ? (
              <SendButton doc={doc} dirty={dirty} noun={noun} priceOffer={priceOffer} />
            ) : null}
            {doc && docWorkflow ? <StageControl doc={doc} stages={docWorkflow.stages} /> : null}
            {doc ? (
              <DocumentActions
                doc={doc}
                stage={currentStage}
                ctx={ctx}
                noun={noun}
                priceOffer={priceOffer}
              />
            ) : null}
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* A bento, laid out by container width — never viewport. A narrow
            pane collapses to one column even on a wide monitor, because pane
            width and screen width are unrelated here (EditorLayout owns the
            @container + the collapse). */}
        <div className="p-4">
          <EditorLayout
            banner={
              failure || readOnly ? (
                <div className="flex flex-col gap-3">
                  {failure ? (
                    <Alert color="danger" variant="soft">
                      {failure}
                    </Alert>
                  ) : null}
                  {readOnly ? (
                    <Alert color="neutral" variant="soft">
                      {currentStage
                        ? `This document is at "${currentStage.customerLabel}", which locks it from edits. Recording a payment still works.`
                        : 'This document has been voided, so it can no longer be changed.'}
                    </Alert>
                  ) : null}
                </div>
              ) : null
            }
            main={
              <>
                {/* Only offered while the document is new: the workflow decides
                    the stages it moves through, and changing that under a
                    document that has already entered one of them is not a
                    form field. */}
                {isNew && workflows && workflows.length > 1 ? (
                  <FormSection
                    title="Document type"
                    description="Decides the stages this document moves through, and how it gets numbered."
                  >
                    <Select
                      items={Object.fromEntries(workflows.map((w) => [w.id, w.name]))}
                      value={workflowId ?? workflows[0]?.id}
                      aria-label="Document type"
                      className="max-w-sm"
                      onValueChange={(next) => {
                        setWorkflowId(next as string);
                      }}
                    />
                  </FormSection>
                ) : null}

                <FormSection title="Bill to">
                  <BillTo
                    customerId={draft.customerId}
                    value={draft.billTo}
                    dueAt={draft.dueAt}
                    noun={noun}
                    priceOffer={priceOffer}
                    readOnly={readOnly}
                    onChange={update}
                    onAddCustomer={(typed) => {
                      ctx.open(
                        'crm.customer.detail',
                        { id: 'new', name: typed },
                        { target: 'beside' }
                      );
                    }}
                  />
                </FormSection>

                <FormSection
                  title="Line items"
                  description="What is being charged for. The summary updates as you type."
                >
                  <LineItems
                    lines={draft.lines}
                    taxRate={draft.taxRate}
                    currency={currency}
                    lineTypes={activeLineTypes}
                    markupRules={documentMarkupRules}
                    readOnly={readOnly}
                    onChange={(lines) => {
                      update({ lines });
                    }}
                  />
                </FormSection>

                <FormSection title="Notes">
                  <Field>
                    <FieldLabel className="sr-only">Notes</FieldLabel>
                    <FieldControl
                      render={
                        <Textarea
                          color="module"
                          rows={3}
                          value={draft.notes}
                          disabled={readOnly}
                          placeholder="Payment terms, a thank you, anything the customer should read."
                          onChange={(event) => {
                            update({ notes: event.target.value });
                          }}
                        />
                      }
                    />
                    <FieldDescription>{`Shown on the ${noun} the customer receives`}</FieldDescription>
                  </Field>
                </FormSection>
              </>
            }
            rail={
              <>
                <InvoiceSummary
                  lines={draft.lines}
                  taxRate={draft.taxRate}
                  currency={currency}
                  readOnly={readOnly}
                  onTaxRateChange={(taxRate) => {
                    update({ taxRate });
                  }}
                  shippingTotal={doc?.shippingTotal ?? 0}
                  surchargeTotal={doc?.surchargeTotal ?? 0}
                  {...(doc
                    ? {
                        saved: {
                          total: doc.total,
                          balance: doc.balance,
                          amountPaid: doc.amountPaid,
                        },
                      }
                    : {})}
                />

                {/* Only for saved documents — you can't take money against a
                    draft that doesn't exist yet. Deliberately OUTSIDE the
                    read-only rule: a locked/finalized invoice is exactly the
                    one getting paid. */}
                {/* Asking the customer to accept it, and what came back
                    (docs/144 §12). Saved documents only — there is nothing to
                    sign until the thing exists, and a link to a draft that is
                    still being edited is a link to a moving target. */}
                {doc ? (
                  <SignaturesSection doc={doc} isDraft={currentStage?.stageType === 'draft'} />
                ) : null}

                {doc ? <PaymentsSection doc={doc} noun={noun} priceOffer={priceOffer} /> : null}

                {/* Frozen records — an appendix about the past. Renders
                    nothing until the first stage move freezes one. */}
                {doc ? <HistorySection doc={doc} /> : null}
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
