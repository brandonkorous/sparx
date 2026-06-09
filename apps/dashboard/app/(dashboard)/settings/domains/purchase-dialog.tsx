'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  NativeSelect,
  Spinner,
  Stack,
  Text,
  toast,
} from '@sparx/ui';
import { CheckCircle2, Globe, Lock } from 'lucide-react';
import type { Property } from '@/lib/sites';
import { purchaseDomain, type DomainSuggestion, type PurchaseResult } from './actions';

export interface PurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  suggestion: DomainSuggestion | null;
  properties: Property[];
  onSuccess: (result: PurchaseResult) => void;
}

type Step = 'form' | 'purchasing' | 'success';

// Cosmetic progress labels shown during the ~5-second purchase operation.
const PURCHASE_STEPS = ['Reserving domain', 'Configuring DNS', 'Finalising'];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PurchaseDialog({
  open,
  onClose,
  suggestion,
  properties,
  onSuccess,
}: PurchaseDialogProps) {
  const [step, setStep] = React.useState<Step>('form');
  const [activeStep, setActiveStep] = React.useState(0);
  const [result, setResult] = React.useState<PurchaseResult | null>(null);

  // Reset state when dialog opens with a new suggestion
  React.useEffect(() => {
    if (open) {
      setStep('form');
      setActiveStep(0);
      setResult(null);
    }
  }, [open, suggestion?.domain]);

  // Animate through progress steps during purchase
  React.useEffect(() => {
    if (step !== 'purchasing') return;
    if (activeStep >= PURCHASE_STEPS.length - 1) return;
    const t = setTimeout(() => setActiveStep((s) => s + 1), 2000);
    return () => clearTimeout(t);
  }, [step, activeStep]);

  const defaultPropertyId = properties[0]?.id ?? '';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStep('purchasing');
    setActiveStep(0);

    const fd = new FormData(e.currentTarget);
    const res = await purchaseDomain(fd);

    if (!res.ok) {
      setStep('form');
      toast.error(res.error ?? 'Purchase failed. Please try again.');
      return;
    }

    setResult(res.data ?? null);
    setStep('success');
    if (res.data) onSuccess(res.data);
  }

  const priceLabel = suggestion
    ? `${formatPrice(suggestion.displayPrice)}/yr`
    : '';

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v && step !== 'purchasing') onClose(); }}>
      <ModalContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <Globe className="size-5 text-[var(--color-primary)]" />
            {step === 'success' ? 'Domain registered!' : `Purchase ${suggestion?.domain ?? ''}`}
          </ModalTitle>
        </ModalHeader>

        {/* ── Success state ──────────────────────────────────────────────────── */}
        {step === 'success' && result && (
          <div className="px-6 pb-2">
            <Stack gap={4} align="center" className="py-6 text-center">
              <CheckCircle2 className="size-12 text-[var(--color-success-text)]" />
              <div>
                <Text weight="medium" className="text-lg">{result.domain.host}</Text>
                <Text size="sm" variant="muted" className="mt-1">
                  Registered through {new Date(result.expiresAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}. DNS is propagating — your domain will be active within a few minutes.
                </Text>
              </div>
            </Stack>
          </div>
        )}

        {/* ── Purchasing progress ────────────────────────────────────────────── */}
        {step === 'purchasing' && (
          <div className="px-6 pb-2">
            <Stack gap={5} className="py-8">
              {PURCHASE_STEPS.map((label, i) => {
                const done = i < activeStep;
                const current = i === activeStep;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)]">
                      {done ? (
                        <CheckCircle2 className="size-4 text-[var(--color-success-text)]" />
                      ) : current ? (
                        <Spinner className="size-4" />
                      ) : (
                        <span className="size-2 rounded-full bg-[var(--border)]" />
                      )}
                    </span>
                    <Text
                      size="sm"
                      weight={current ? 'medium' : 'normal'}
                      variant={done ? 'muted' : 'default'}
                    >
                      {label}
                      {done ? '  ✓' : current ? '…' : ''}
                    </Text>
                  </div>
                );
              })}
            </Stack>
          </div>
        )}

        {/* ── Purchase form ──────────────────────────────────────────────────── */}
        {step === 'form' && suggestion && (
          <form id="purchase-form" onSubmit={handleSubmit}>
            <div className="px-6 pb-2">
              <Stack gap={6}>
                {/* Pricing summary */}
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <Stack gap={0.5}>
                    <Text weight="medium">{suggestion.domain}</Text>
                    <Text size="sm" variant="muted">
                      {suggestion.available ? 'Available' : 'Taken'}
                    </Text>
                  </Stack>
                  <Badge color={suggestion.available ? 'success' : 'danger'} variant="soft">
                    {priceLabel}
                  </Badge>
                </div>

                {/* Hidden domain */}
                <input type="hidden" name="domain" value={suggestion.domain} />

                {/* Years + privacy */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pd-years">Registration period</Label>
                    <NativeSelect id="pd-years" name="years" defaultValue="1">
                      {[1, 2, 3, 5].map((y) => (
                        <option key={y} value={y}>
                          {y} year{y > 1 ? 's' : ''} — {formatPrice(suggestion.displayPrice * y)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  {properties.length > 1 && (
                    <div>
                      <Label htmlFor="pd-property">Attach to site</Label>
                      <NativeSelect id="pd-property" name="propertyId" defaultValue={defaultPropertyId}>
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </NativeSelect>
                    </div>
                  )}
                  {properties.length === 1 && (
                    <input type="hidden" name="propertyId" value={defaultPropertyId} />
                  )}
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox id="pd-privacy" name="privacy-check" defaultChecked />
                  <input type="hidden" name="privacy" id="pd-privacy-hidden" value="true" />
                  <div>
                    <Label htmlFor="pd-privacy" className="flex items-center gap-1.5">
                      <Lock className="size-3.5" /> WHOIS privacy protection
                    </Label>
                    <Text size="sm" variant="muted">
                      Hides your personal details from the public WHOIS database.
                    </Text>
                  </div>
                </div>

                {/* Registrant contact */}
                <div>
                  <Text weight="medium" className="mb-3">
                    Registrant contact
                  </Text>
                  <Text size="sm" variant="muted" className="mb-4">
                    Required by ICANN for domain registration. This information may appear in the
                    public WHOIS record if privacy protection is disabled.
                  </Text>
                  <Stack gap={3}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="pd-first">First name</Label>
                        <Input id="pd-first" name="firstName" placeholder="Jane" required />
                      </div>
                      <div>
                        <Label htmlFor="pd-last">Last name</Label>
                        <Input id="pd-last" name="lastName" placeholder="Smith" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="pd-email">Email</Label>
                        <Input
                          id="pd-email"
                          name="email"
                          type="email"
                          placeholder="jane@example.com"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="pd-phone">Phone</Label>
                        <Input
                          id="pd-phone"
                          name="phone"
                          type="tel"
                          placeholder="+1 555 000 0000"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="pd-addr1">Address</Label>
                      <Input
                        id="pd-addr1"
                        name="address1"
                        placeholder="123 Main St"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="pd-addr2">Address line 2 (optional)</Label>
                      <Input id="pd-addr2" name="address2" placeholder="Suite 400" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="pd-city">City</Label>
                        <Input id="pd-city" name="city" placeholder="Anytown" required />
                      </div>
                      <div>
                        <Label htmlFor="pd-state">State / region</Label>
                        <Input id="pd-state" name="state" placeholder="CA" required />
                      </div>
                      <div>
                        <Label htmlFor="pd-zip">Postal code</Label>
                        <Input id="pd-zip" name="postalCode" placeholder="90210" required />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="pd-country">Country (2-letter code)</Label>
                      <Input
                        id="pd-country"
                        name="country"
                        placeholder="US"
                        maxLength={2}
                        className="uppercase"
                        defaultValue="US"
                        required
                      />
                    </div>
                  </Stack>
                </div>

                {/* Payment notice (Stripe stubbed) */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <Text size="sm" variant="muted">
                    <strong className="font-medium text-[var(--color-text)]">Billing:</strong>{' '}
                    This charge will be added to your next invoice. Payment processing via Stripe is
                    coming soon — purchases are free during the beta.
                  </Text>
                </div>
              </Stack>
            </div>

            <ModalFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" color="primary" form="purchase-form">
                Purchase &amp; connect — {priceLabel}
              </Button>
            </ModalFooter>
          </form>
        )}

        {/* ── Success footer ─────────────────────────────────────────────────── */}
        {step === 'success' && (
          <ModalFooter>
            <Button color="primary" onClick={onClose}>
              Done
            </Button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}
