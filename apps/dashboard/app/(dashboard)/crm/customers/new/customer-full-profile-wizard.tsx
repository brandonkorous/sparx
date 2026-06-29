'use client';

// Customer full-profile creation form (docs/68 Phase B-5, docs/86 SurfaceFrame).
// SINGLE-PAGE (WS1, docs/105): the "one swipe" form — create the contact AND
// everything that usually follows a first touch, in one scroll:
//   • Contact      — name, email (required), phone, company, job title
//   • Classify     — type, preferred contact method, do-not-contact, tags
//   • Address      — optional billing/shipping address
//   • Get a head start (optional) — first-interaction note + follow-up task,
//     and an opportunity: open a deal on a pipeline + start a draft quote.
//
// Everything after Contact is optional and uses a "fill to create" rule: a deal
// is created only if you name it, a draft quote only if you add a starter line —
// so someone who just wants a contact scrolls to the bottom and clicks Create.
// (Collapsed from the former 5-step wizard so the form renders well in a drawer /
// modal / full-page — what makes the user's `defaultDetailView` preference pay off.)
//
// Presentation: the `/new` route renders the `embedded` full page inside the
// dashboard chrome; the CRM list opens it inside the drawer/modal detail chrome
// (`overlay` → SurfaceFrame `inline`), picked by the user's `defaultDetailView`.
// On finish: creates the customer, then best-effort applies the address, note,
// task, deal, and quote, and navigates to the new detail with a `?notice=` listing
// anything that failed (the contact is saved regardless).

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Heading,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  SchemaFieldRenderer,
  Stack,
  Text,
  Textarea,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  type SurfaceStepDef,
} from '@sparx/ui';
import { UserPlus } from 'lucide-react';

import { addCustomerAddressAction, createCustomerAction } from '../../customer-actions';
import { createTaskAction, recordActivityAction } from '../../activity-task-actions';
import { createDealAction } from '../../deal-actions';
import { createQuoteAction } from '../../quote-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

type ActivityKind = 'note' | 'call' | 'meeting';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type QuoteTerms = '' | 'prepay' | 'net15' | 'net30' | 'net60' | 'net90';

// Single-page form = one step, so SurfaceFrame's MiniProgress auto-hides and the
// toolbar is Cancel + Create (no Back/Continue).
const SINGLE_STEP: SurfaceStepDef[] = [{ key: 'customer', label: 'Customer' }];

// ─── Field schemas ──────────────────────────────────────────────────────────────

const CONTACT_FIELDS = [
  { key: 'firstName', label: 'First name', type: 'text' as const, placeholder: 'Jane' },
  { key: 'lastName', label: 'Last name', type: 'text' as const, placeholder: 'Doe' },
  {
    key: 'email',
    label: 'Email',
    type: 'email' as const,
    required: true,
    placeholder: 'jane@example.com',
  },
  { key: 'phone', label: 'Phone', type: 'tel' as const, placeholder: '+1 (555) 000-0000' },
  { key: 'company', label: 'Company', type: 'text' as const, placeholder: 'Acme Corp' },
  { key: 'jobTitle', label: 'Job title', type: 'text' as const, placeholder: 'Operations Manager' },
];

const CLASSIFY_FIELDS = [
  {
    key: 'type',
    label: 'Customer type',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'prospect', label: 'Prospect — lead not yet converted' },
      { value: 'retail', label: 'Retail — direct consumer' },
      { value: 'b2b', label: 'B2B — wholesale or fleet account' },
    ],
  },
  {
    key: 'preferredContactMethod',
    label: 'Preferred contact method',
    type: 'select' as const,
    options: [
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Phone' },
      { value: 'sms', label: 'SMS' },
    ],
  },
  {
    key: 'doNotContact',
    label: 'Do not contact',
    type: 'boolean' as const,
    helpText: 'Suppresses outbound emails and campaign inclusions for this contact.',
  },
  {
    key: 'tags',
    label: 'Tags',
    type: 'text' as const,
    placeholder: 'vip, newsletter, midwest',
    helpText: 'Comma-separated. Used by segments and reports.',
  },
];

const ADDRESS_FIELDS = [
  {
    key: 'type',
    label: 'Address type',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'shipping', label: 'Shipping' },
      { value: 'billing', label: 'Billing' },
      { value: 'both', label: 'Both' },
    ],
  },
  { key: 'recipientName', label: 'Recipient name', type: 'text' as const },
  {
    key: 'line1',
    label: 'Address line 1',
    type: 'text' as const,
    required: true,
    placeholder: '123 Main St',
  },
  { key: 'line2', label: 'Address line 2', type: 'text' as const, placeholder: 'Suite 400' },
  { key: 'city', label: 'City', type: 'text' as const, required: true },
  { key: 'region', label: 'State / Province', type: 'text' as const, placeholder: 'CA' },
  { key: 'postalCode', label: 'Postal code', type: 'text' as const, placeholder: '90210' },
  {
    key: 'country',
    label: 'Country',
    type: 'text' as const,
    required: true,
    placeholder: 'US',
    helpText: 'ISO 3166-1 alpha-2 (e.g. US, CA, GB).',
  },
  { key: 'phone', label: 'Address phone', type: 'tel' as const },
];

// ─── Parsing helpers (the Opportunity section's free-text → typed values) ─────────

/** A monetary amount string → a non-negative number rounded to cents (Money
 *  is `multipleOf(0.01)`; an un-rounded float like 19.999 would fail Zod). */
function parseMoney(value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/** A quantity string → a positive integer (LineItemInput requires `> 0`). */
function parseQuantity(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

/** Derive a SKU from a line name when the user doesn't supply one — a draft
 *  quote needs a SKU per line; it's editable later on the quote detail. */
function deriveSku(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 127);
  return slug || 'ITEM';
}

// ─── Component ────────────────────────────────────────────────────────────────

/** A pipeline + its ordered stages, fetched server-side and passed in so the
 *  Opportunity section can offer pipeline → stage selection without a client fetch. */
export interface PipelineOption {
  id: string;
  name: string;
  stages: { id: string; name: string; probability: number }[];
}

export interface CustomerWizardProps {
  /** `'page'` = the in-app full-page `/new` route (embedded, inside the dashboard
   *  chrome); `'overlay'` = the drawer/modal detail chrome (the `defaultDetailView`
   *  preference picks which). */
  presentation?: 'page' | 'overlay';
  /** Current user id — the optional follow-up task is assigned to them. Supplied
   *  by the server surface (the form is a client component); when absent, a typed
   *  task is skipped on submit (the note still records). */
  currentUserId?: string;
  /** The tenant's CRM pipelines (with stages) for the optional deal. Empty when
   *  none exist yet — the deal card then points the user to create one first. */
  pipelines?: PipelineOption[];
}

export function CustomerFullProfileWizard(props: CustomerWizardProps = {}) {
  // Both presentations are full-height frames (embedded fills the dashboard
  // content area; inline fills the drawer/modal body), so the wrapping
  // ModuleProvider carries the height through (h-full).
  return (
    <ModuleProvider module="crm" className="h-full">
      <CustomerWizardInner {...props} />
    </ModuleProvider>
  );
}

function CustomerWizardInner({
  presentation = 'page',
  currentUserId,
  pipelines = [],
}: CustomerWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [contact, setContact] = React.useState<Record<string, unknown>>({});
  const [classify, setClassify] = React.useState<Record<string, unknown>>({ type: 'prospect' });
  const [address, setAddress] = React.useState<Record<string, unknown>>({ type: 'shipping' });
  const [skipAddress, setSkipAddress] = React.useState(false);

  // Follow-up — an optional first interaction note + a follow-up task.
  const [noteKind, setNoteKind] = React.useState<ActivityKind>('note');
  const [noteDescription, setNoteDescription] = React.useState('');
  const [taskTitle, setTaskTitle] = React.useState('');
  const [taskDueAt, setTaskDueAt] = React.useState('');
  const [taskPriority, setTaskPriority] = React.useState<TaskPriority>('medium');

  // Opportunity — an optional deal on a pipeline + an optional draft quote.
  const firstPipeline = pipelines[0];
  const [dealPipelineId, setDealPipelineId] = React.useState<string>(firstPipeline?.id ?? '');
  const [dealStageId, setDealStageId] = React.useState<string>(firstPipeline?.stages[0]?.id ?? '');
  const [dealTitle, setDealTitle] = React.useState('');
  const [dealValue, setDealValue] = React.useState('');

  const [quoteItemName, setQuoteItemName] = React.useState('');
  const [quoteSku, setQuoteSku] = React.useState('');
  const [quoteQuantity, setQuoteQuantity] = React.useState('1');
  const [quoteUnitPrice, setQuoteUnitPrice] = React.useState('');
  const [quoteValidUntil, setQuoteValidUntil] = React.useState('');
  const [quoteTerms, setQuoteTerms] = React.useState<QuoteTerms>('');

  const [contactErrors, setContactErrors] = React.useState<Record<string, string>>({});
  const [addressErrors, setAddressErrors] = React.useState<Record<string, string>>({});

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedPipeline = pipelines.find((p) => p.id === dealPipelineId);
  const dealStages = selectedPipeline?.stages ?? [];

  // Unsaved-changes guard. A create form starts blank, so "dirty" is "the user
  // entered or changed anything" — any contact field, a changed classification,
  // an address, a follow-up note/task, or an opportunity. Guards a Cancel / Close
  // / backdrop so a half-built profile isn't silently discarded.
  const filled = (v: unknown) => typeof v === 'string' && v.trim() !== '';
  const dirty =
    filled(contact.firstName) ||
    filled(contact.lastName) ||
    filled(contact.email) ||
    filled(contact.phone) ||
    filled(contact.company) ||
    filled(contact.jobTitle) ||
    classify.type !== 'prospect' ||
    filled(classify.preferredContactMethod) ||
    classify.doNotContact === true ||
    filled(classify.tags) ||
    filled(address.line1) ||
    filled(address.city) ||
    filled(address.region) ||
    filled(address.postalCode) ||
    filled(address.country) ||
    filled(address.recipientName) ||
    filled(address.line2) ||
    filled(address.phone) ||
    noteDescription.trim() !== '' ||
    taskTitle.trim() !== '' ||
    taskDueAt.trim() !== '' ||
    dealTitle.trim() !== '' ||
    dealValue.trim() !== '' ||
    quoteItemName.trim() !== '' ||
    quoteSku.trim() !== '' ||
    quoteUnitPrice.trim() !== '' ||
    quoteValidUntil.trim() !== '';
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'customer' });

  function onPipelineChange(id: string) {
    setDealPipelineId(id);
    const pipeline = pipelines.find((p) => p.id === id);
    setDealStageId(pipeline?.stages[0]?.id ?? '');
  }

  // Where "leave the form" goes. In the overlay it clears the detail token so the
  // drawer/modal closes in place; the page route returns to the list.
  const close = React.useCallback(() => {
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/crm/customers');
    }
  }, [presentation, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work. The create path (router.push) leaves on its own, unguarded.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // ── Validation (run as submit backstops) ─────────────────────────────────────

  function validateContact(): boolean {
    const errs: Record<string, string> = {};
    if (!contact.email || typeof contact.email !== 'string' || !contact.email.includes('@')) {
      errs.email = 'A valid email address is required.';
    }
    setContactErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateAddress(): boolean {
    if (skipAddress) return true;
    // The address section is fully optional — only validate it when the user has
    // actually started one (any required field touched); an untouched address
    // shouldn't block creating a contact-only customer.
    const started = filled(address.line1) || filled(address.city) || filled(address.country);
    if (!started) return true;
    const errs: Record<string, string> = {};
    if (!address.line1) errs.line1 = 'Address line 1 is required.';
    if (!address.city) errs.city = 'City is required.';
    if (!address.country) {
      errs.country = 'Country is required.';
    } else if (
      typeof address.country === 'string' &&
      !/^[A-Z]{2}$/.test(address.country.toUpperCase())
    ) {
      errs.country = 'Country must be a 2-letter ISO code (e.g. US).';
    }
    setAddressErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validateContact() || !validateAddress()) return;
    setError(null);
    setSubmitting(true);
    try {
      const rawTags =
        typeof classify.tags === 'string'
          ? classify.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined;

      const customerInput = {
        ...contact,
        type: classify.type ?? 'prospect',
        preferredContactMethod: classify.preferredContactMethod ?? undefined,
        doNotContact: classify.doNotContact === true,
        tags: rawTags,
      };

      const result = await createCustomerAction(customerInput);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      const customerId = result.data.id;

      // Everything past the contact is best-effort: the customer is already
      // saved, so a failure on any extra is recorded in `notice` rather than
      // aborting the rest. The user lands on the new profile either way.
      const failed: string[] = [];

      if (!skipAddress && address.line1 && address.city && address.country) {
        const countryUpper =
          typeof address.country === 'string' ? address.country.toUpperCase() : address.country;
        const addrInput = { ...address, country: countryUpper, isDefault: true };
        const addrResult = await addCustomerAddressAction(customerId, addrInput);
        if (!addrResult.ok) failed.push('address');
      }

      // Optional: log the first interaction as an activity (note / call / meeting).
      const noteText = noteDescription.trim();
      if (noteText) {
        const noteResult = await recordActivityAction({
          type: noteKind,
          description: noteText,
          actorType: 'staff',
          customerId,
        });
        if (!noteResult.ok) failed.push('note');
      }

      // Optional: create a follow-up task assigned to the current user. Skipped
      // when no current user is available (the note still records).
      const title = taskTitle.trim();
      if (title && currentUserId) {
        const taskResult = await createTaskAction({
          title,
          priority: taskPriority,
          assignedToUserId: currentUserId,
          customerId,
          ...(taskDueAt ? { dueAt: new Date(`${taskDueAt}T00:00:00Z`).toISOString() } : {}),
        });
        if (!taskResult.ok) failed.push('task');
      }

      // Optional: open a deal on the chosen pipeline + stage. Created only when
      // it's been named and a pipeline/stage is available; probability is
      // seeded from the stage so the forecast is right from the start.
      const dealName = dealTitle.trim();
      if (dealName && dealPipelineId && dealStageId) {
        const stage = dealStages.find((s) => s.id === dealStageId);
        const dealResult = await createDealAction({
          pipelineId: dealPipelineId,
          stageId: dealStageId,
          customerId,
          title: dealName,
          value: parseMoney(dealValue),
          currency: 'USD',
          probability: stage?.probability ?? 0,
        });
        if (!dealResult.ok) failed.push('deal');
      }

      // Optional: start a draft quote with a first line item. The merchant adds
      // more lines and sends it from the quote detail; created only when a line
      // is named (a quote requires at least one item).
      const lineName = quoteItemName.trim();
      if (lineName) {
        const quoteResult = await createQuoteAction({
          customerId,
          currency: 'USD',
          ...(quoteTerms ? { paymentTerms: quoteTerms } : {}),
          ...(quoteValidUntil
            ? { validUntil: new Date(`${quoteValidUntil}T00:00:00Z`).toISOString() }
            : {}),
          items: [
            {
              sku: quoteSku.trim() || deriveSku(lineName),
              name: lineName,
              quantity: parseQuantity(quoteQuantity),
              unitPrice: parseMoney(quoteUnitPrice),
            },
          ],
        });
        if (!quoteResult.ok) failed.push('quote');
      }

      const qs = failed.length ? `?notice=partial&failed=${failed.join(',')}` : '';
      router.push(`/crm/customers/${customerId}${qs}`);
      router.refresh();
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Live draft summary (the F layout's right column, docs/86) ─────────────────
  // Shows the identity being built plus the "fill to create" extras that will be
  // applied on finish, so the optional work is visible the whole way down.
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const fullName = [str(contact.firstName), str(contact.lastName)].filter(Boolean).join(' ');
  const email = str(contact.email);
  const company = str(contact.company);
  const typeLabel =
    { prospect: 'Prospect', retail: 'Retail', b2b: 'B2B' }[str(classify.type)] ?? '—';
  const noteKindLabel = { note: 'Note', call: 'Call', meeting: 'Meeting' }[noteKind];
  const addressIncluded = !skipAddress && !!str(address.line1) && !!str(address.city);
  const noteIncluded = !!noteDescription.trim();
  const taskIncluded = !!taskTitle.trim() && !!currentUserId;
  const dealIncluded = !!dealTitle.trim() && !!dealPipelineId && !!dealStageId;
  const quoteIncluded = !!quoteItemName.trim();
  const anyExtra = addressIncluded || noteIncluded || taskIncluded || dealIncluded || quoteIncluded;

  const summary = (
    <SurfaceSummary
      title="Draft summary"
      footer={
        <Badge color="module" variant="soft" size="sm">
          Editable after create
        </Badge>
      }
    >
      <SurfaceSummaryRow label="Name" value={fullName || '—'} />
      <SurfaceSummaryRow label="Email" value={email || '—'} strong />
      {company && <SurfaceSummaryRow label="Company" value={company} />}
      <SurfaceSummaryRow label="Type" value={typeLabel} />
      <SurfaceSummaryDivider />
      {anyExtra ? (
        <>
          {addressIncluded && (
            <SurfaceSummaryRow label="Address" value={str(address.city) || 'Included'} />
          )}
          {noteIncluded && <SurfaceSummaryRow label="Activity" value={noteKindLabel} />}
          {taskIncluded && <SurfaceSummaryRow label="Task" value={taskTitle.trim()} />}
          {dealIncluded && <SurfaceSummaryRow label="Deal" value={dealTitle.trim()} />}
          {quoteIncluded && <SurfaceSummaryRow label="Draft quote" value={quoteItemName.trim()} />}
        </>
      ) : (
        <SurfaceSummaryRow label="On create" value="Contact only" />
      )}
    </SurfaceSummary>
  );

  // ── Frame ──────────────────────────────────────────────────────────────────
  // Single-page: one SurfaceStep stacking the core (contact / classify / address)
  // and the optional "fill to create" sections. Only the email is required, so the
  // primary stays disabled until it's a valid address.
  const emailInvalid = typeof contact.email !== 'string' || !contact.email.includes('@');

  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New customer"
      steps={SINGLE_STEP}
      current={0}
      onCancel={cancel}
      summary={summary}
    >
      <SurfaceStep
        actions={{
          onNext: () => void handleSubmit(),
          nextLabel: 'Create customer',
          nextLoading: submitting,
          nextDisabled: submitting || emailInvalid,
        }}
      >
        <div className="flex flex-col gap-5">
          {/* Contact — the only required group */}
          <Card variant="default">
            <CardHeader>
              <Heading level={3}>Contact details</Heading>
              <Text size="sm" variant="muted">
                Only an email is required — fill in the rest now or after the contact exists.
              </Text>
            </CardHeader>
            <CardContent>
              <SchemaFieldRenderer
                fields={CONTACT_FIELDS}
                values={contact}
                onChange={(key, value) => setContact((prev) => ({ ...prev, [key]: value }))}
                errors={contactErrors}
                disabled={submitting}
              />
            </CardContent>
          </Card>

          {/* Classification */}
          <Card variant="default">
            <CardHeader>
              <Heading level={3}>Classification</Heading>
              <Text size="sm" variant="muted">
                Type, contact preferences, and tags — they drive segments and campaigns.
              </Text>
            </CardHeader>
            <CardContent>
              <SchemaFieldRenderer
                fields={CLASSIFY_FIELDS}
                values={classify}
                onChange={(key, value) => setClassify((prev) => ({ ...prev, [key]: value }))}
                disabled={submitting}
              />
            </CardContent>
          </Card>

          {/* Primary address (optional, skippable) */}
          {!skipAddress ? (
            <Card variant="default">
              <CardHeader>
                <Stack direction="row" align="center" justify="between">
                  <div className="flex flex-col gap-1">
                    <Heading level={3}>Primary address</Heading>
                    <Text size="sm" variant="muted">
                      Add a primary address now, or skip and add one later from the profile.
                    </Text>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-[var(--color-text-muted)] underline-offset-4 hover:underline"
                    onClick={() => {
                      setSkipAddress(true);
                      setAddressErrors({});
                    }}
                  >
                    Skip for now
                  </button>
                </Stack>
              </CardHeader>
              <CardContent>
                <SchemaFieldRenderer
                  fields={ADDRESS_FIELDS}
                  values={address}
                  onChange={(key, value) => setAddress((prev) => ({ ...prev, [key]: value }))}
                  errors={addressErrors}
                  disabled={submitting}
                />
              </CardContent>
            </Card>
          ) : (
            <Card padding="sm" className="bg-[var(--color-bg-subtle)]">
              <Stack direction="row" align="center" gap={3}>
                <UserPlus className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                <Text size="sm" variant="muted">
                  No address will be added. You can add one from the customer’s profile.
                </Text>
                <button
                  type="button"
                  className="ml-auto shrink-0 text-xs text-[var(--module-active)] hover:underline"
                  onClick={() => setSkipAddress(false)}
                >
                  Add address
                </button>
              </Stack>
            </Card>
          )}

          {/* Optional "fill to create" zone */}
          <div className="pt-1">
            <Heading level={3}>Get a head start</Heading>
            <Text size="sm" variant="muted">
              All optional — capture a first interaction, set a follow-up, or open a deal and draft
              quote now. Fill a section to create it; leave it blank to skip.
            </Text>
          </div>

          {/* Follow-up — note + task */}
          <Card variant="default">
            <CardHeader>
              <Heading level={3}>What just happened?</Heading>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="cw-note-kind">Interaction</Label>
                  <NativeSelect
                    id="cw-note-kind"
                    value={noteKind}
                    onChange={(e) => setNoteKind(e.target.value as ActivityKind)}
                  >
                    <option value="note">Note</option>
                    <option value="call">Call</option>
                    <option value="meeting">Meeting</option>
                  </NativeSelect>
                </div>
                <div>
                  <Label htmlFor="cw-note">Details</Label>
                  <Textarea
                    id="cw-note"
                    rows={3}
                    value={noteDescription}
                    onChange={(e) => setNoteDescription(e.target.value)}
                    placeholder="What did you discuss? Leave blank to skip."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <Heading level={3}>Follow-up task</Heading>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="cw-task">Task</Label>
                  <Input
                    id="cw-task"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Send a quote, schedule a call — leave blank to skip"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="cw-due">Due date</Label>
                    <Input
                      id="cw-due"
                      type="date"
                      value={taskDueAt}
                      onChange={(e) => setTaskDueAt(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cw-priority">Priority</Label>
                    <NativeSelect
                      id="cw-priority"
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </NativeSelect>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opportunity — deal + draft quote */}
          <Card variant="default">
            <CardHeader>
              <Heading level={3}>Start a deal</Heading>
            </CardHeader>
            <CardContent>
              {pipelines.length === 0 ? (
                <Text size="sm" variant="muted">
                  No pipelines yet. Create one in CRM → Pipelines to open deals from here.
                </Text>
              ) : (
                <div className="flex flex-col gap-3">
                  <Text size="sm" variant="muted">
                    Name the opportunity to open it on a pipeline. Leave the name blank to skip.
                  </Text>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="cw-deal-pipeline">Pipeline</Label>
                      <NativeSelect
                        id="cw-deal-pipeline"
                        value={dealPipelineId}
                        onChange={(e) => onPipelineChange(e.target.value)}
                      >
                        {pipelines.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div>
                      <Label htmlFor="cw-deal-stage">Stage</Label>
                      <NativeSelect
                        id="cw-deal-stage"
                        value={dealStageId}
                        onChange={(e) => setDealStageId(e.target.value)}
                        disabled={dealStages.length === 0}
                      >
                        {dealStages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="cw-deal-title">Deal name</Label>
                    <Input
                      id="cw-deal-title"
                      value={dealTitle}
                      onChange={(e) => setDealTitle(e.target.value)}
                      placeholder="e.g. 2026 fleet maintenance — leave blank to skip"
                    />
                  </div>
                  <div className="max-w-[12rem]">
                    <Label htmlFor="cw-deal-value">Value (USD)</Label>
                    <Input
                      id="cw-deal-value"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={dealValue}
                      onChange={(e) => setDealValue(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <Heading level={3}>Start a draft quote</Heading>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Text size="sm" variant="muted">
                  Add a first line item to open a draft quote. You can add more lines and send it
                  from the quote later. Leave the item blank to skip.
                </Text>
                <div>
                  <Label htmlFor="cw-quote-name">Item</Label>
                  <Input
                    id="cw-quote-name"
                    value={quoteItemName}
                    onChange={(e) => setQuoteItemName(e.target.value)}
                    placeholder="e.g. Annual service plan — leave blank to skip"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="cw-quote-sku">SKU</Label>
                    <Input
                      id="cw-quote-sku"
                      value={quoteSku}
                      onChange={(e) => setQuoteSku(e.target.value)}
                      placeholder="Auto from item"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cw-quote-qty">Quantity</Label>
                    <Input
                      id="cw-quote-qty"
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={quoteQuantity}
                      onChange={(e) => setQuoteQuantity(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cw-quote-price">Unit price (USD)</Label>
                    <Input
                      id="cw-quote-price"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={quoteUnitPrice}
                      onChange={(e) => setQuoteUnitPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="cw-quote-valid">Valid until</Label>
                    <Input
                      id="cw-quote-valid"
                      type="date"
                      value={quoteValidUntil}
                      onChange={(e) => setQuoteValidUntil(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cw-quote-terms">Payment terms</Label>
                    <NativeSelect
                      id="cw-quote-terms"
                      value={quoteTerms}
                      onChange={(e) => setQuoteTerms(e.target.value as QuoteTerms)}
                    >
                      <option value="">No terms</option>
                      <option value="prepay">Prepay</option>
                      <option value="net15">Net 15</option>
                      <option value="net30">Net 30</option>
                      <option value="net60">Net 60</option>
                      <option value="net90">Net 90</option>
                    </NativeSelect>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Text size="sm" variant="danger" role="alert">
              {error}
            </Text>
          )}
        </div>
      </SurfaceStep>
    </SurfaceFrame>
  );
}
