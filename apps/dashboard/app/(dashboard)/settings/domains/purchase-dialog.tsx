'use client';

import * as React from 'react';
import { toast } from '@sparx/ui';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Label,
  Loading,
  NativeSelect,
} from 'silicaui-react';
import { CheckCircle2, Globe, Lock } from 'lucide-react';
import type { Property } from '@/lib/sites';
import { purchaseDomain, type DomainSuggestion, type PurchaseResult } from './actions';

/** The domain choice captured in `select` mode — everything needed to register
 *  later (at the onboarding Launch step) WITHOUT charging or registering now. */
export interface DomainSelection {
  domain: string;
  displayPrice: number;
  renewalDisplayPrice: number;
  years: number;
  privacy: boolean;
  propertyId: string;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export interface PurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  suggestion: DomainSuggestion | null;
  properties: Property[];
  /** `purchase` (default, Settings): charge + register on submit. `select`
   *  (onboarding): capture the choice and hand it back via `onSelect` — the
   *  actual charge happens later at Launch, so nothing is billed here. */
  mode?: 'purchase' | 'select';
  /** Called after a successful registration in `purchase` mode. */
  onSuccess?: (result: PurchaseResult) => void;
  /** Called with the captured choice in `select` mode (no charge yet). */
  onSelect?: (selection: DomainSelection) => void;
}

type Step = 'form' | 'purchasing' | 'success';

/** Read a text field out of FormData (form inputs are always strings, never File). */
function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
}

/** Pull the structured selection out of the form (used by both modes). */
function readSelection(fd: FormData, suggestion: DomainSuggestion): DomainSelection {
  return {
    domain: suggestion.domain,
    displayPrice: suggestion.displayPrice,
    renewalDisplayPrice: suggestion.renewalDisplayPrice,
    years: Number(str(fd, 'years')) || 1,
    privacy: str(fd, 'privacy') === 'true',
    propertyId: str(fd, 'propertyId'),
    contact: {
      firstName: str(fd, 'firstName'),
      lastName: str(fd, 'lastName'),
      email: str(fd, 'email'),
      phone: str(fd, 'phone'),
      address1: str(fd, 'address1'),
      address2: str(fd, 'address2') || undefined,
      city: str(fd, 'city'),
      state: str(fd, 'state'),
      postalCode: str(fd, 'postalCode'),
      country: str(fd, 'country').toUpperCase(),
    },
  };
}

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
  mode = 'purchase',
  onSuccess,
  onSelect,
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

    // Select mode (onboarding): capture the choice and hand it back — no charge,
    // no registration. The purchase happens later, at the Launch step.
    if (mode === 'select') {
      if (!suggestion) return;
      const fd = new FormData(e.currentTarget);
      onSelect?.(readSelection(fd, suggestion));
      onClose();
      return;
    }

    // Purchase mode (Settings): charge + register now.
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
    if (res.data) onSuccess?.(res.data);
  }

  const priceLabel = suggestion ? `${formatPrice(suggestion.displayPrice)}/yr` : '';

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && step !== 'purchasing') onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <div>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="size-5 text-[var(--color-primary)]" />
            {step === 'success'
              ? 'Domain registered!'
              : `${mode === 'select' ? 'Add' : 'Purchase'} ${suggestion?.domain ?? ''}`}
          </DialogTitle>
        </div>

        {/* ── Success state ──────────────────────────────────────────────────── */}
        {step === 'success' && result && (
          <div className="px-6 pb-2">
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle2 className="size-12 text-[var(--color-success-text)]" />
              <div>
                <p className="text-lg font-medium">{result.domain.host}</p>
                <p className="text-base-content/70 mt-1 text-sm">
                  Registered through{' '}
                  {new Date(result.expiresAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  . DNS is propagating — your domain will be active within a few minutes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Purchasing progress ────────────────────────────────────────────── */}
        {step === 'purchasing' && (
          <div className="px-6 pb-2">
            <div className="flex flex-col gap-5 py-8">
              {PURCHASE_STEPS.map((label, i) => {
                const done = i < activeStep;
                const current = i === activeStep;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)]">
                      {done ? (
                        <CheckCircle2 className="size-4 text-[var(--color-success-text)]" />
                      ) : current ? (
                        <Loading className="size-4" />
                      ) : (
                        <span className="size-2 rounded-full bg-[var(--border)]" />
                      )}
                    </span>
                    <p
                      className={[
                        'text-sm',
                        current ? 'font-medium' : '',
                        done ? 'text-base-content/70' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {label}
                      {done ? '  ✓' : current ? '…' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Purchase form ──────────────────────────────────────────────────── */}
        {step === 'form' && suggestion && (
          <form id="purchase-form" onSubmit={handleSubmit}>
            <div className="px-6 pb-2">
              <div className="flex flex-col gap-6">
                {/* Pricing summary */}
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{suggestion.domain}</p>
                    <p className="text-base-content/70 text-sm">
                      {suggestion.available ? 'Available' : 'Taken'}
                    </p>
                  </div>
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
                      {[1, 2, 3, 5].map((y) => {
                        // Year one is the (possibly promo) registration price; each
                        // additional year is the renewal price.
                        const total =
                          suggestion.displayPrice + suggestion.renewalDisplayPrice * (y - 1);
                        return (
                          <option key={y} value={y}>
                            {y} year{y > 1 ? 's' : ''} — {formatPrice(total)}
                          </option>
                        );
                      })}
                    </NativeSelect>
                  </div>
                  {properties.length > 1 && (
                    <div>
                      <Label htmlFor="pd-property">Attach to site</Label>
                      <NativeSelect
                        id="pd-property"
                        name="propertyId"
                        defaultValue={defaultPropertyId}
                      >
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
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
                    <p className="text-base-content/70 text-sm">
                      Hides your personal details from the public WHOIS database.
                    </p>
                  </div>
                </div>

                {/* Registrant contact */}
                <div>
                  <p className="mb-3 font-medium">Registrant contact</p>
                  <p className="text-base-content/70 mb-4 text-sm">
                    Required by ICANN for domain registration. This information may appear in the
                    public WHOIS record if privacy protection is disabled.
                  </p>
                  <div className="flex flex-col gap-3">
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
                      <Input id="pd-addr1" name="address1" placeholder="123 Main St" required />
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
                  </div>
                </div>

                {/* Payment notice — mode-aware. Select mode (onboarding) charges
                    at Launch, not now; purchase mode (Settings) charges on submit. */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--color-bg-subtle)] px-4 py-3">
                  <p className="text-base-content/70 text-sm">
                    <strong className="font-medium text-[var(--color-text)]">Billing:</strong>{' '}
                    {mode === 'select' ? (
                      <>
                        You won&apos;t be charged now. This domain is registered and billed (
                        {priceLabel}) when you publish at the Launch step — your free address stays
                        free until then.
                      </>
                    ) : (
                      <>
                        Your card is charged {priceLabel} now to register this domain. It renews at{' '}
                        {suggestion ? formatPrice(suggestion.renewalDisplayPrice) : ''}/yr; turn off
                        auto-renew anytime.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2 px-6 pb-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" color="primary" form="purchase-form">
                {mode === 'select' ? 'Add to my site' : 'Purchase & connect'} — {priceLabel}
              </Button>
            </div>
          </form>
        )}

        {/* ── Success footer ─────────────────────────────────────────────────── */}
        {step === 'success' && (
          <div className="mt-4 flex justify-end gap-2 px-6 pb-2">
            <Button color="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
