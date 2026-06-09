'use client';

// B2B account creation wizard (docs/68 Phase B-5).
// 3 steps:
//   1. Company info  — name (required), tax ID, website, status, tags
//   2. Pricing        — credit limit, discount %, payment terms, fleet size, pricing tier, notes
//   3. Engine profiles — optional fleet engine variants (make/model/year/engine/count)
//
// On finish: calls createB2bAccountAction → navigates to the new account's detail.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Heading,
  Input,
  Label,
  SchemaFieldRenderer,
  Stack,
  Stepper,
  Text,
} from '@sparx/ui';
import { Plus, Trash2 } from 'lucide-react';

import { createB2bAccountAction } from '../../../crm/b2b-actions';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [{ label: 'Company' }, { label: 'Pricing' }, { label: 'Fleet' }];

const COMPANY_FIELDS = [
  {
    key: 'companyName',
    label: 'Company name',
    type: 'text' as const,
    required: true,
    placeholder: 'Gillett Diesel Service',
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

export function B2bAccountWizard() {
  const router = useRouter();

  const [step, setStep] = React.useState(0);

  const [company, setCompany] = React.useState<Record<string, unknown>>({ status: 'active' });
  const [pricing, setPricing] = React.useState<Record<string, unknown>>({
    creditLimit: 0,
    discountPercent: 0,
  });
  const [engineProfiles, setEngineProfiles] = React.useState<EngineProfileDraft[]>([]);

  const [companyErrors, setCompanyErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ── Validation ─────────────────────────────────────────────────────────

  function validateCompany(): boolean {
    const errs: Record<string, string> = {};
    if (!company.companyName || String(company.companyName).trim() === '') {
      errs.companyName = 'Company name is required.';
    }
    setCompanyErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  function goNext() {
    setError(null);
    if (step === 0 && !validateCompany()) return;
    setStep((s) => s + 1);
  }

  function goBack() {
    setError(null);
    setCompanyErrors({});
    setStep((s) => s - 1);
  }

  // ── Engine profile helpers ──────────────────────────────────────────────

  function updateProfile(id: string, field: keyof EngineProfileDraft, value: string) {
    setEngineProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  function removeProfile(id: string) {
    setEngineProfiles((prev) => prev.filter((p) => p.id !== id));
  }

  // ── Submit ─────────────────────────────────────────────────────────────

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
        companyName: String(company.companyName ?? '').trim(),
        taxId: company.taxId ? String(company.taxId).trim() || undefined : undefined,
        website: company.website ? String(company.website).trim() || undefined : undefined,
        status: company.status ?? 'active',
        tags: rawTags,
        pricingTier: pricing.pricingTier
          ? String(pricing.pricingTier).trim() || undefined
          : undefined,
        creditLimit: Number(pricing.creditLimit ?? 0),
        discountPercent: Number(pricing.discountPercent ?? 0),
        paymentTerms:
          pricing.paymentTerms && pricing.paymentTerms !== '' ? pricing.paymentTerms : undefined,
        fleetSize:
          pricing.fleetSize != null && pricing.fleetSize !== ''
            ? Number(pricing.fleetSize)
            : undefined,
        notes: pricing.notes ? String(pricing.notes).trim() || undefined : undefined,
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

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Stack gap={6}>
      <Stepper steps={STEPS} current={step} />

      {/* Step 1 — Company info */}
      {step === 0 && (
        <Stack gap={4}>
          <Text variant="muted">
            Enter the account&apos;s company details. Pricing tiers and credit terms are set in the
            next step.
          </Text>
          <SchemaFieldRenderer
            fields={COMPANY_FIELDS}
            values={company}
            onChange={(key, value) => setCompany((prev) => ({ ...prev, [key]: value }))}
            errors={companyErrors}
            disabled={submitting}
          />
          <Stack direction="row" gap={3}>
            <Button variant="ghost" asChild>
              <Link href="/b2b/accounts">Cancel</Link>
            </Button>
            <Button color="module" onClick={goNext}>
              Continue
            </Button>
          </Stack>
        </Stack>
      )}

      {/* Step 2 — Pricing & credit */}
      {step === 1 && (
        <Stack gap={4}>
          <Text variant="muted">
            Set the account&apos;s pricing tier, credit limit, and payment terms. All fields are
            optional and can be updated later.
          </Text>
          <SchemaFieldRenderer
            fields={PRICING_FIELDS}
            values={pricing}
            onChange={(key, value) => setPricing((prev) => ({ ...prev, [key]: value }))}
            disabled={submitting}
          />
          <Stack direction="row" gap={3}>
            <Button variant="ghost" onClick={goBack} disabled={submitting}>
              Back
            </Button>
            <Button color="module" onClick={goNext} disabled={submitting}>
              Continue
            </Button>
          </Stack>
        </Stack>
      )}

      {/* Step 3 — Engine profiles */}
      {step === 2 && (
        <Stack gap={4}>
          <Text variant="muted">
            Optionally add the engine variants this fleet runs. Each row is one engine type — used
            by fitment-aware catalog filtering once Commerce is active. Skip if not applicable.
          </Text>

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
                  No engine profiles. Click &ldquo;Add engine&rdquo; to record the make, model, and
                  count for each engine variant the fleet runs.
                </Text>
              ) : (
                <Stack gap={2}>
                  {/* Column headers */}
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

          <Stack direction="row" gap={3}>
            <Button variant="ghost" onClick={goBack} disabled={submitting}>
              Back
            </Button>
            <Button
              color="module"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              loading={submitting}
            >
              Create account
            </Button>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
