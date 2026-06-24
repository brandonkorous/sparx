'use client';

// B2B account creation wizard (docs/68 Phase B-5, docs/86 SurfaceFrame).
// 3 steps:
//   1. Company  — name (required), tax ID, website, status, tags
//   2. Pricing  — credit limit, discount %, payment terms, fleet size, tier, notes
//   3. Fleet    — optional engine variants (make/model/year/engine/count)
//
// Presentation: the `/new` route renders the full-screen `page` variant; the B2B
// accounts list opens it inside the dashboard's drawer/modal detail chrome
// (`overlay` → SurfaceFrame `inline`), picked by the user's `defaultDetailView`.
// On finish: createB2bAccountAction → navigates to the new account's detail.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Heading,
  Input,
  Label,
  ModuleProvider,
  SchemaFieldRenderer,
  Stack,
  Text,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  type SurfaceStepDef,
} from '@sparx/ui';
import { Plus, Trash2 } from 'lucide-react';

import { createB2bAccountAction } from '../../../crm/b2b-actions';

// ─── Steps & rail copy ──────────────────────────────────────────────────────────

type StepKey = 'company' | 'pricing' | 'fleet';

const ALL_STEPS: Record<StepKey, SurfaceStepDef> = {
  company: { key: 'company', label: 'Company', sublabel: 'Name & status' },
  pricing: { key: 'pricing', label: 'Pricing', sublabel: 'Credit & terms' },
  fleet: { key: 'fleet', label: 'Fleet', sublabel: 'Engine profiles' },
};

const STEP_ORDER: StepKey[] = ['company', 'pricing', 'fleet'];

const RAIL: Record<StepKey, { title: string; blurb: string; context?: string }> = {
  company: {
    title: 'Set up the account',
    blurb: 'The company’s details. Pricing tiers and credit terms come in the next step.',
    context: 'Only the company name is required to create the account.',
  },
  pricing: {
    title: 'Pricing & credit',
    blurb: 'Pricing tier, credit limit, and payment terms. All optional — tune them anytime.',
    context: 'All optional — these can change later from the account.',
  },
  fleet: {
    title: 'Fleet engine profiles',
    blurb: 'The engine variants this fleet runs — used by fitment-aware catalog filtering.',
    context: 'Optional — skip if not applicable.',
  },
};

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
    helpText: 'Total number of vehicles/units. Each engine variant is added in step 3.',
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

  const [stepKey, setStepKey] = React.useState<StepKey>('company');

  const [company, setCompany] = React.useState<Record<string, unknown>>({ status: 'active' });
  const [pricing, setPricing] = React.useState<Record<string, unknown>>({
    creditLimit: 0,
    discountPercent: 0,
  });
  const [engineProfiles, setEngineProfiles] = React.useState<EngineProfileDraft[]>([]);

  const [companyErrors, setCompanyErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const steps: SurfaceStepDef[] = STEP_ORDER.map((k) => ALL_STEPS[k]);
  const current = Math.max(
    0,
    steps.findIndex((s) => s.key === stepKey)
  );

  function goToStep(key: StepKey) {
    setError(null);
    setStepKey(key);
  }

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

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateCompany(): boolean {
    const errs: Record<string, string> = {};
    if (!company.companyName || (company.companyName as string).trim() === '') {
      errs.companyName = 'Company name is required.';
    }
    setCompanyErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function commitCompany() {
    if (!validateCompany()) return;
    goToStep('pricing');
  }

  // ── Engine profile helpers ──────────────────────────────────────────────────

  function updateProfile(id: string, field: keyof EngineProfileDraft, value: string) {
    setEngineProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  function removeProfile(id: string) {
    setEngineProfiles((prev) => prev.filter((p) => p.id !== id));
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
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

  // ── Step bodies ──────────────────────────────────────────────────────────────

  const companyStep = (
    <SurfaceStep
      header={{
        title: 'Company details',
        supporting: 'The account’s company info. Pricing and credit terms come next.',
      }}
      actions={{
        onNext: commitCompany,
        nextLabel: 'Continue',
        nextDisabled:
          typeof company.companyName !== 'string' ||
          company.companyName.trim() === '' ||
          submitting,
      }}
    >
      <SchemaFieldRenderer
        fields={COMPANY_FIELDS}
        values={company}
        onChange={(key, value) => setCompany((prev) => ({ ...prev, [key]: value }))}
        errors={companyErrors}
        disabled={submitting}
      />
    </SurfaceStep>
  );

  const pricingStep = (
    <SurfaceStep
      header={{
        title: 'Pricing & credit',
        supporting: 'Pricing tier, credit limit, and payment terms — all optional.',
      }}
      actions={{
        onBack: () => goToStep('company'),
        onNext: () => goToStep('fleet'),
        nextLabel: 'Continue',
        nextDisabled: submitting,
      }}
    >
      <SchemaFieldRenderer
        fields={PRICING_FIELDS}
        values={pricing}
        onChange={(key, value) => setPricing((prev) => ({ ...prev, [key]: value }))}
        disabled={submitting}
      />
    </SurfaceStep>
  );

  const fleetStep = (
    <SurfaceStep
      header={{
        title: 'Fleet engine profiles',
        supporting:
          'Optionally record the engine variants this fleet runs. Each row is one engine type.',
      }}
      actions={{
        onBack: () => goToStep('pricing'),
        onNext: () => void handleSubmit(),
        nextLabel: 'Create account',
        nextLoading: submitting,
        nextDisabled: submitting,
      }}
    >
      <div className="flex flex-col gap-4">
        <Card variant="module">
          <CardHeader>
            <Stack direction="row" align="center" justify="between">
              <Heading level={3}>Engine profiles</Heading>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setEngineProfiles((prev) => [...prev, emptyProfile()])}
                disabled={submitting}
              >
                Add engine
              </Button>
            </Stack>
          </CardHeader>
          <CardContent>
            {engineProfiles.length === 0 ? (
              <Text size="sm" variant="muted">
                No engine profiles. Click “Add engine” to record the make, model, and count for each
                engine variant the fleet runs.
              </Text>
            ) : (
              <Stack gap={2}>
                <Stack direction="row" gap={2} className="px-1">
                  {['Year', 'Make', 'Model', 'Engine code', 'Count'].map((h) => (
                    <Label key={h} className="flex-1 text-xs first:w-20 last:w-20">
                      {h}
                    </Label>
                  ))}
                  <div className="w-8" />
                </Stack>
                {engineProfiles.map((profile) => (
                  <Stack
                    key={profile.id}
                    direction="row"
                    gap={2}
                    align="center"
                    className="rounded-md border border-[var(--color-border-default)] p-2"
                  >
                    <Input
                      type="number"
                      min="1900"
                      max="2100"
                      className="w-20"
                      placeholder="2022"
                      value={profile.year}
                      onChange={(e) => updateProfile(profile.id, 'year', e.target.value)}
                      disabled={submitting}
                    />
                    <Input
                      className="flex-1"
                      placeholder="Cummins"
                      value={profile.make}
                      onChange={(e) => updateProfile(profile.id, 'make', e.target.value)}
                      disabled={submitting}
                    />
                    <Input
                      className="flex-1"
                      placeholder="ISX15"
                      value={profile.model}
                      onChange={(e) => updateProfile(profile.id, 'model', e.target.value)}
                      disabled={submitting}
                    />
                    <Input
                      className="flex-1"
                      placeholder="optional"
                      value={profile.engine}
                      onChange={(e) => updateProfile(profile.id, 'engine', e.target.value)}
                      disabled={submitting}
                    />
                    <Input
                      type="number"
                      min="0"
                      className="w-20"
                      placeholder="3"
                      value={profile.count}
                      onChange={(e) => updateProfile(profile.id, 'count', e.target.value)}
                      disabled={submitting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Remove engine profile"
                      onClick={() => removeProfile(profile.id)}
                      disabled={submitting}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </SurfaceStep>
  );

  let body: React.ReactNode;
  if (stepKey === 'company') body = companyStep;
  else if (stepKey === 'pricing') body = pricingStep;
  else body = fleetStep;

  // ── Frame ──────────────────────────────────────────────────────────────────

  const onStepSelect = (key: string) => {
    const target = steps.findIndex((s) => s.key === key);
    if (target >= 0 && target <= current) goToStep(key as StepKey);
  };
  const canSelectStep = (_key: string, index: number) => index <= current;

  // The live draft summary — the F layout's right-hand column (docs/86). Mirrors
  // the account identity plus the pricing/credit terms and fleet size as they fill in.
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

  // One top-stepper frame for both presentations: `embedded` fills the dashboard
  // content area at `/new` (sidebar + header stay); `inline` fills the drawer/
  // modal detail panel, which supplies its own chrome.
  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New B2B account"
      steps={steps}
      current={current}
      context={RAIL[stepKey].context}
      onStepSelect={onStepSelect}
      canSelectStep={canSelectStep}
      onCancel={close}
      summary={summary}
    >
      {body}
    </SurfaceFrame>
  );
}
