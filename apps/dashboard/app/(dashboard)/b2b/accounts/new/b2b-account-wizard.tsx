'use client';

// B2B account creation form (docs/68 Phase B-5, docs/86 SurfaceFrame).
// SINGLE-PAGE (WS1, docs/105 §"Strategy & workstreams"): one scroll with three
// grouped module cards —
//   Company  — name (required), tax ID, website, status, tags
//   Pricing  — credit limit, discount %, payment terms, fleet size, tier, notes
//   Fleet    — optional engine variants (make/model/year/engine/count)
// Collapsed from the former 3-step wizard: a single-page form renders well in a
// drawer / modal / full-page alike, which is exactly what makes the user's
// `defaultDetailView` surface preference pay off (a stepper only works full-page).
//
// Presentation: the `/new` route renders the full-screen `page` variant; the B2B
// accounts list opens it inside the dashboard's drawer/modal detail chrome
// (`overlay` → SurfaceFrame `inline`), picked by the user's `defaultDetailView`.
// On finish: createB2bAccountAction → navigates to the new account's detail.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ModuleProvider,
  SchemaFieldRenderer,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  type SurfaceStepDef,
} from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  FieldStatus,
  Input,
  Label,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
import { Plus, Trash2 } from 'lucide-react';

import { createB2bAccountAction } from '../../../crm/b2b-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// Single-page form = one step, so SurfaceFrame's MiniProgress auto-hides (its
// `steps.length > 1` gate) and the toolbar is Cancel + Create (no Back/Continue).
const SINGLE_STEP: SurfaceStepDef[] = [{ key: 'account', label: 'Account' }];

// ─── Field schemas ──────────────────────────────────────────────────────────────

const COMPANY_FIELDS = [
  {
    key: 'companyName',
    label: 'Company name',
    type: 'text' as const,
    required: true,
    placeholder: 'Acme Manufacturing',
  },
  { key: 'taxId', label: 'Tax ID', type: 'text' as const, placeholder: '12-3456789' },
  { key: 'website', label: 'Website', type: 'url' as const, placeholder: 'https://example.com' },
  {
    key: 'status',
    label: 'Account status',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'credit_hold', label: 'Credit hold' },
      { value: 'suspended', label: 'Suspended' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  {
    key: 'tags',
    label: 'Tags',
    type: 'text' as const,
    placeholder: 'fleet, vip, midwest',
    helpText: 'Comma-separated. Used by segments and reports.',
  },
];

const PRICING_FIELDS = [
  {
    key: 'pricingTier',
    label: 'Pricing tier',
    type: 'text' as const,
    placeholder: 'bronze, silver, gold…',
    helpText: 'Tier key that drives catalog price overrides once Commerce is active.',
  },
  {
    key: 'creditLimit',
    label: 'Credit limit ($)',
    type: 'number' as const,
    min: 0,
    helpText: 'Maximum outstanding balance before orders are held.',
  },
  {
    key: 'discountPercent',
    label: 'Discount %',
    type: 'number' as const,
    min: 0,
    max: 100,
    helpText: 'Flat percentage off list price applied across all orders.',
  },
  {
    key: 'paymentTerms',
    label: 'Payment terms',
    type: 'select' as const,
    options: [
      { value: '', label: '(unspecified)' },
      { value: 'prepay', label: 'Prepay' },
      { value: 'net15', label: 'Net 15' },
      { value: 'net30', label: 'Net 30' },
      { value: 'net60', label: 'Net 60' },
      { value: 'net90', label: 'Net 90' },
    ],
  },
  {
    key: 'fleetSize',
    label: 'Fleet size',
    type: 'number' as const,
    min: 0,
    helpText: 'Total number of vehicles/units. Each engine variant is added below.',
  },
  {
    key: 'notes',
    label: 'Internal notes',
    type: 'textarea' as const,
    helpText: 'Visible to team members only. Not shared with the account.',
  },
];

// ─── Engine profile types ─────────────────────────────────────────────────────

interface EngineProfileDraft {
  id: string;
  make: string;
  model: string;
  year: string;
  engine: string;
  count: string;
}

function emptyProfile(): EngineProfileDraft {
  return { id: crypto.randomUUID(), make: '', model: '', year: '', engine: '', count: '' };
}

// The optional fleet engine-profile editor — a self-contained repeating-row card.
// Controlled by the parent (which owns `engineProfiles` for the dirty check,
// submit payload, and summary count); this just renders + edits the rows.
function FleetProfilesCard({
  profiles,
  setProfiles,
  disabled,
}: {
  profiles: EngineProfileDraft[];
  setProfiles: React.Dispatch<React.SetStateAction<EngineProfileDraft[]>>;
  disabled: boolean;
}) {
  const update = (id: string, field: keyof EngineProfileDraft, value: string) =>
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  const remove = (id: string) => setProfiles((prev) => prev.filter((p) => p.id !== id));

  return (
    <Card>
      <CardBody>
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Fleet engine profiles</h3>
            <p className="text-base-content/70 text-sm">
              Optional — the engine variants this fleet runs, used by fitment-aware catalog
              filtering.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconStart={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setProfiles((prev) => [...prev, emptyProfile()])}
            disabled={disabled}
          >
            Add engine
          </Button>
        </div>
        {profiles.length === 0 ? (
          <p className="text-base-content/70 text-sm">
            No engine profiles. Click “Add engine” to record the make, model, and count for each
            engine variant the fleet runs.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-row gap-2 px-1">
              {['Year', 'Make', 'Model', 'Engine code', 'Count'].map((h) => (
                <Label key={h} className="flex-1 text-xs first:w-20 last:w-20">
                  {h}
                </Label>
              ))}
              <div className="w-8" />
            </div>
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="border-base-300 flex flex-row items-center gap-2 rounded-md border p-2"
              >
                <Input
                  type="number"
                  min="1900"
                  max="2100"
                  className="w-20"
                  placeholder="2022"
                  value={profile.year}
                  onChange={(e) => update(profile.id, 'year', e.target.value)}
                  disabled={disabled}
                />
                <Input
                  className="flex-1"
                  placeholder="Cummins"
                  value={profile.make}
                  onChange={(e) => update(profile.id, 'make', e.target.value)}
                  disabled={disabled}
                />
                <Input
                  className="flex-1"
                  placeholder="ISX15"
                  value={profile.model}
                  onChange={(e) => update(profile.id, 'model', e.target.value)}
                  disabled={disabled}
                />
                <Input
                  className="flex-1"
                  placeholder="optional"
                  value={profile.engine}
                  onChange={(e) => update(profile.id, 'engine', e.target.value)}
                  disabled={disabled}
                />
                <Input
                  type="number"
                  min="0"
                  className="w-20"
                  placeholder="3"
                  value={profile.count}
                  onChange={(e) => update(profile.id, 'count', e.target.value)}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove engine profile"
                  onClick={() => remove(profile.id)}
                  disabled={disabled}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface B2bAccountWizardProps {
  /** `'page'` = full-screen `/new` route; `'overlay'` = inside the dashboard
   *  drawer/modal detail chrome (the `defaultDetailView` preference picks which). */
  presentation?: 'page' | 'overlay';
}

export function B2bAccountWizard(props: B2bAccountWizardProps = {}) {
  return (
    <ModuleProvider module="b2b" className="h-full">
      <B2bAccountWizardInner {...props} />
    </ModuleProvider>
  );
}

function B2bAccountWizardInner({ presentation = 'page' }: B2bAccountWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [company, setCompany] = React.useState<Record<string, unknown>>({ status: 'active' });
  const [pricing, setPricing] = React.useState<Record<string, unknown>>({
    creditLimit: 0,
    discountPercent: 0,
  });
  const [engineProfiles, setEngineProfiles] = React.useState<EngineProfileDraft[]>([]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Only the company name is required. Drive the shared Field/FieldStatus engine
  // over it and feed the resolved message into SchemaFieldRenderer's `errors` map,
  // which renders the field-level status the same way the rest of the platform does.
  const companyName = typeof company.companyName === 'string' ? company.companyName : '';
  const v = useFieldValidation(
    { companyName },
    { companyName: rule.required('Company name is required.') }
  );
  const companyNameError = v.visibleError('companyName');

  // Unsaved-changes guard. A create form starts blank, so "dirty" is "the user
  // entered or changed anything" — company identity, a changed status, any
  // pricing/credit term, or an added engine profile. Guards a Cancel / Close /
  // backdrop so a half-built account isn't silently discarded.
  const filled = (v: unknown) => typeof v === 'string' && v.trim() !== '';
  const dirty =
    filled(company.companyName) ||
    filled(company.taxId) ||
    filled(company.website) ||
    filled(company.tags) ||
    (company.status ?? 'active') !== 'active' ||
    filled(pricing.pricingTier) ||
    Number(pricing.creditLimit ?? 0) !== 0 ||
    Number(pricing.discountPercent ?? 0) !== 0 ||
    filled(pricing.paymentTerms) ||
    filled(pricing.notes) ||
    (pricing.fleetSize != null && pricing.fleetSize !== '' && Number(pricing.fleetSize) !== 0) ||
    engineProfiles.length > 0;
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'B2B account' });

  const close = React.useCallback(() => {
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/b2b/accounts');
    }
  }, [presentation, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work. The create path (router.push) leaves on its own, unguarded.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!v.validate()) return;
    setError(null);
    setSubmitting(true);
    try {
      const rawTags =
        typeof company.tags === 'string'
          ? company.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined;

      const validProfiles = engineProfiles
        .filter((p) => p.make.trim() && p.model.trim())
        .map((p) => ({
          make: p.make.trim(),
          model: p.model.trim(),
          ...(p.year.trim() ? { year: Number(p.year) } : {}),
          ...(p.engine.trim() ? { engine: p.engine.trim() } : {}),
          ...(p.count.trim() ? { count: Number(p.count) } : {}),
        }));

      const input = {
        companyName: ((company.companyName as string | undefined) ?? '').trim(),
        taxId: company.taxId ? (company.taxId as string).trim() || undefined : undefined,
        website: company.website ? (company.website as string).trim() || undefined : undefined,
        status: company.status ?? 'active',
        tags: rawTags,
        pricingTier: pricing.pricingTier
          ? (pricing.pricingTier as string).trim() || undefined
          : undefined,
        creditLimit: Number(pricing.creditLimit ?? 0),
        discountPercent: Number(pricing.discountPercent ?? 0),
        paymentTerms:
          pricing.paymentTerms && pricing.paymentTerms !== '' ? pricing.paymentTerms : undefined,
        fleetSize:
          pricing.fleetSize != null && pricing.fleetSize !== ''
            ? Number(pricing.fleetSize)
            : undefined,
        notes: pricing.notes ? (pricing.notes as string).trim() || undefined : undefined,
        engineProfiles: validProfiles,
      };

      const result = await createB2bAccountAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      router.push(`/b2b/accounts/${result.data.id}`);
      router.refresh();
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Live draft summary (the F layout's right column, docs/86) ─────────────────
  // Mirrors the account identity plus the pricing/credit terms and fleet size as
  // they fill in.
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const accountName = str(company.companyName);
  const statusLabel =
    { active: 'Active', credit_hold: 'Credit hold', suspended: 'Suspended', inactive: 'Inactive' }[
      str(company.status)
    ] ?? 'Active';
  const tier = str(pricing.pricingTier);
  const creditLimit = Number(pricing.creditLimit ?? 0) || 0;
  const discount = Number(pricing.discountPercent ?? 0) || 0;
  const termsLabel = {
    prepay: 'Prepay',
    net15: 'Net 15',
    net30: 'Net 30',
    net60: 'Net 60',
    net90: 'Net 90',
  }[str(pricing.paymentTerms)];
  const validEngineCount = engineProfiles.filter((p) => p.make.trim() && p.model.trim()).length;
  const money0 = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const summary = (
    <SurfaceSummary
      title="Draft summary"
      footer={
        <Badge color="module" variant="soft" size="sm">
          Editable after create
        </Badge>
      }
    >
      <SurfaceSummaryRow label="Account" value={accountName || '—'} strong />
      <SurfaceSummaryRow label="Status" value={statusLabel} />
      {tier && <SurfaceSummaryRow label="Tier" value={tier} />}
      <SurfaceSummaryDivider />
      {creditLimit > 0 && <SurfaceSummaryRow label="Credit limit" value={money0(creditLimit)} />}
      {discount > 0 && <SurfaceSummaryRow label="Discount" value={`${discount}%`} />}
      {termsLabel && <SurfaceSummaryRow label="Terms" value={termsLabel} />}
      <SurfaceSummaryRow label="Engine profiles" value={String(validEngineCount)} />
    </SurfaceSummary>
  );

  // ── Frame ──────────────────────────────────────────────────────────────────
  // One single-page frame for both presentations: `embedded` fills the dashboard
  // content area at `/new` (sidebar + header stay); `inline` fills the drawer/
  // modal detail panel, which supplies its own chrome. Only the company name is
  // required, so the primary stays disabled until it's entered.
  const companyNameMissing =
    typeof company.companyName !== 'string' || company.companyName.trim() === '';

  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New B2B account"
      steps={SINGLE_STEP}
      current={0}
      onCancel={cancel}
      summary={summary}
    >
      <SurfaceStep
        actions={{
          onNext: () => void handleSubmit(),
          nextLabel: 'Create account',
          nextLoading: submitting,
          nextDisabled: submitting || companyNameMissing,
        }}
      >
        <div className="flex flex-col gap-5">
          {/* Company — the only required group */}
          <Card>
            <CardBody>
              <h3 className="text-xl font-semibold">Company</h3>
              <p className="text-base-content/70 text-sm">
                The account’s company details. Only the company name is required to create the
                account.
              </p>
              <SchemaFieldRenderer
                fields={COMPANY_FIELDS}
                values={company}
                onChange={(key, value) => setCompany((prev) => ({ ...prev, [key]: value }))}
                errors={companyNameError ? { companyName: companyNameError } : undefined}
                disabled={submitting}
              />
            </CardBody>
          </Card>

          {/* Pricing & credit — all optional */}
          <Card>
            <CardBody>
              <h3 className="text-xl font-semibold">Pricing &amp; credit</h3>
              <p className="text-base-content/70 text-sm">
                Pricing tier, credit limit, and payment terms — all optional, and editable anytime.
              </p>
              <SchemaFieldRenderer
                fields={PRICING_FIELDS}
                values={pricing}
                onChange={(key, value) => setPricing((prev) => ({ ...prev, [key]: value }))}
                disabled={submitting}
              />
            </CardBody>
          </Card>

          {/* Fleet engine profiles — optional repeating rows */}
          <FleetProfilesCard
            profiles={engineProfiles}
            setProfiles={setEngineProfiles}
            disabled={submitting}
          />

          {error && (
            <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
              {error}
            </FieldStatus>
          )}
        </div>
      </SurfaceStep>
    </SurfaceFrame>
  );
}
