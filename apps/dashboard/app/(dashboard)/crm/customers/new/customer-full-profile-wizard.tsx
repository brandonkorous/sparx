'use client';

// Customer full-profile creation wizard (docs/68 Phase B-5).
// 3 steps:
//   1. Contact   — name, email (required), phone, company, job title
//   2. Classify  — type, preferred contact method, do-not-contact, tags
//   3. Address   — optional billing/shipping address
//
// On finish: creates the customer, optionally adds address, navigates to detail.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Heading,
  SchemaFieldRenderer,
  Stack,
  Stepper,
  Text,
} from '@sparx/ui';
import { UserPlus } from 'lucide-react';

import { addCustomerAddressAction, createCustomerAction } from '../../customer-actions';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [{ label: 'Contact' }, { label: 'Classify' }, { label: 'Address' }];

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

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerFullProfileWizard() {
  const router = useRouter();

  const [step, setStep] = React.useState(0);

  const [contact, setContact] = React.useState<Record<string, unknown>>({ type: 'prospect' });
  const [classify, setClassify] = React.useState<Record<string, unknown>>({ type: 'prospect' });
  const [address, setAddress] = React.useState<Record<string, unknown>>({ type: 'shipping' });
  const [skipAddress, setSkipAddress] = React.useState(false);

  const [contactErrors, setContactErrors] = React.useState<Record<string, string>>({});
  const [addressErrors, setAddressErrors] = React.useState<Record<string, string>>({});

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ── Validation ─────────────────────────────────────────────────────────

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

  // ── Navigation ─────────────────────────────────────────────────────────

  function goNext() {
    setError(null);
    if (step === 0 && !validateContact()) return;
    setStep((s) => s + 1);
  }

  function goBack() {
    setError(null);
    setContactErrors({});
    setAddressErrors({});
    setStep((s) => s - 1);
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!skipAddress && !validateAddress()) return;
    setError(null);
    setSubmitting(true);
    try {
      // Build customer input — convert tags string to array
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

      // Optionally create address
      if (!skipAddress && address.line1 && address.city && address.country) {
        const countryUpper =
          typeof address.country === 'string' ? address.country.toUpperCase() : address.country;
        const addrInput = {
          ...address,
          country: countryUpper,
          isDefault: true,
        };
        const addrResult = await addCustomerAddressAction(customerId, addrInput);
        if (!addrResult.ok) {
          // Address failed — customer was created; navigate to detail with a note
          router.push(`/crm/customers/${customerId}?notice=address_failed`);
          router.refresh();
          return;
        }
      }

      router.push(`/crm/customers/${customerId}`);
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

      {/* Step 1 — Contact info */}
      {step === 0 && (
        <Stack gap={4}>
          <Text variant="muted">
            Enter the contact&apos;s basic information. Only email is required — you can fill in the
            rest after creation.
          </Text>
          <SchemaFieldRenderer
            fields={CONTACT_FIELDS}
            values={contact}
            onChange={(key, value) => setContact((prev) => ({ ...prev, [key]: value }))}
            errors={contactErrors}
            disabled={submitting}
          />
          <Stack direction="row" gap={3}>
            <Button variant="ghost" asChild>
              <Link href="/crm/customers">Cancel</Link>
            </Button>
            <Button color="module" onClick={goNext}>
              Continue
            </Button>
          </Stack>
        </Stack>
      )}

      {/* Step 2 — Classification */}
      {step === 1 && (
        <Stack gap={4}>
          <Text variant="muted">
            Set the customer type, contact preferences, and tags. These drive segment membership and
            campaign eligibility.
          </Text>
          <SchemaFieldRenderer
            fields={CLASSIFY_FIELDS}
            values={classify}
            onChange={(key, value) => setClassify((prev) => ({ ...prev, [key]: value }))}
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

      {/* Step 3 — Address */}
      {step === 2 && (
        <Stack gap={4}>
          <Text variant="muted">
            Add a primary address now, or skip and add one later from the customer&apos;s profile.
          </Text>

          {!skipAddress ? (
            <>
              <Card variant="module">
                <CardHeader>
                  <Heading level={3}>Primary address</Heading>
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
              <button
                type="button"
                className="text-sm text-[var(--color-fg-muted)] underline-offset-4 hover:underline"
                onClick={() => {
                  setSkipAddress(true);
                  setAddressErrors({});
                }}
              >
                Skip — I&apos;ll add an address later
              </button>
            </>
          ) : (
            <Card padding="sm" className="bg-[var(--color-bg-subtle)]">
              <Stack direction="row" align="center" gap={3}>
                <UserPlus className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
                <Text size="sm" variant="muted">
                  No address will be added. You can add one from the customer&apos;s profile.
                </Text>
                <button
                  type="button"
                  className="ml-auto shrink-0 text-xs text-[var(--color-module-active)] hover:underline"
                  onClick={() => setSkipAddress(false)}
                >
                  Add address
                </button>
              </Stack>
            </Card>
          )}

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
              Create customer
            </Button>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
