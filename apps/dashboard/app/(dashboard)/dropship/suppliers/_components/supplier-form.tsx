'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  Stack,
  Text,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sparx/ui';
import { createSupplier, updateSupplier } from '../_lib/actions';

// ── Shared shapes (mirror @sparx/dropship/vendors, delivered via the API) ──────

export interface VendorCredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder?: string;
  help?: string;
  required: boolean;
}

export interface Vendor {
  slug: string;
  label: string;
  tagline: string;
  description: string;
  connectionMethod: 'api' | 'manual';
  pod: boolean;
  credentialFields: VendorCredentialField[];
  capabilities: {
    catalogSync: boolean;
    orderSubmission: boolean;
    trackingSync: boolean;
    inventorySync: boolean;
  };
  credentialsHelpUrl?: string;
}

export interface SiteOption {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface Supplier {
  id: string;
  name: string;
  type: string;
  // The credential field spec for this vendor type and whether a token is
  // already on file — both come from the API (toSupplierView). Secrets are
  // write-only, so the form never receives the values themselves.
  credentialFields?: VendorCredentialField[];
  credentialsSet?: boolean;
  pricingRule: {
    type: string;
    value: number;
    roundTo?: string;
    maxMsrp?: string;
  } | null;
  notes: string | null;
  siteScope?: string[];
}

interface Props {
  /** The chosen vendor (create flow). */
  vendor?: Vendor;
  /** The existing supplier (edit flow). */
  supplier?: Supplier;
  /** The tenant's sites, for per-site enablement. */
  sites: SiteOption[];
  onSuccess: () => void;
  onCancel: () => void;
}

const PRICING_TYPES = [
  { value: 'percentage_markup', label: 'Percentage markup (cost × (1 + %))' },
  { value: 'multiplier', label: 'Multiplier (cost × x)' },
  { value: 'flat_markup', label: 'Flat markup (cost + fixed)' },
  { value: 'fixed_margin', label: 'Fixed margin (cost / (1 – %))' },
];

const ROUND_OPTIONS = [
  { value: 'cent', label: 'Nearest cent' },
  { value: 'dollar', label: 'Nearest dollar' },
  { value: 'five_dollar', label: 'Nearest $5' },
];

export function SupplierForm({ vendor, supplier, sites, onSuccess, onCancel }: Props) {
  const isEdit = Boolean(supplier);
  // Credential field spec comes from the supplier (edit, via the API) or the
  // chosen vendor (create). Secrets are write-only — the API never echoes them
  // back — so on edit the inputs always start blank and a blank field means
  // "keep the stored value". `credentialsSet` tells us whether a token is on
  // file, which drives the "saved / replace" vs "needs credentials" UI below.
  const fields: VendorCredentialField[] =
    supplier?.credentialFields ?? vendor?.credentialFields ?? [];
  const hasStoredCreds = supplier?.credentialsSet ?? false;

  const [name, setName] = useState(supplier?.name ?? vendor?.label ?? '');
  const [creds, setCreds] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = '';
    return init;
  });
  // On edit with a token already on file, the credential inputs stay hidden
  // behind a "Replace" affordance so a routine edit (pricing, sites, notes)
  // never requires the token. When there are no stored creds (e.g. a wiped
  // connection being recovered), the inputs show immediately.
  const [replacingCreds, setReplacingCreds] = useState(false);
  const credsOpen = !isEdit || !hasStoredCreds || replacingCreds;
  const [notes, setNotes] = useState(supplier?.notes ?? '');

  const [hasPricingRule, setHasPricingRule] = useState(supplier?.pricingRule != null);
  const [pricingType, setPricingType] = useState(
    supplier?.pricingRule?.type ?? 'percentage_markup'
  );
  const [pricingValue, setPricingValue] = useState(String(supplier?.pricingRule?.value ?? '30'));
  const [roundTo, setRoundTo] = useState(supplier?.pricingRule?.roundTo ?? 'cent');
  const [capAtMsrp, setCapAtMsrp] = useState(
    supplier?.pricingRule?.maxMsrp === 'use_supplier_msrp'
  );

  // Per-site enablement. Empty siteScope = all sites. Only relevant when the
  // tenant has more than one site.
  const multiSite = sites.length > 1;
  const [limitSites, setLimitSites] = useState((supplier?.siteScope?.length ?? 0) > 0);
  const [selectedSites, setSelectedSites] = useState<Set<string>>(
    () => new Set(supplier?.siteScope ?? [])
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSite(id: string) {
    setSelectedSites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    // On edit, blank credential fields mean "keep current", so required only
    // applies when connecting (create).
    if (!isEdit) {
      for (const f of fields) {
        if (f.required && !creds[f.key]?.trim()) {
          setError(`${f.label} is required.`);
          return;
        }
      }
    }
    const value = parseFloat(pricingValue);
    if (hasPricingRule && isNaN(value)) {
      setError('Pricing rule value must be a number.');
      return;
    }
    if (multiSite && limitSites && selectedSites.size === 0) {
      setError('Select at least one site, or switch back to all sites.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // On edit, send ONLY the fields the user actually re-entered; the backend
      // merges them over the stored secrets so blanks keep their value (and an
      // untouched edit never wipes credentials). On create, send everything.
      const credentials: Record<string, string> = {};
      for (const f of fields) {
        const value = (creds[f.key] ?? '').trim();
        if (!isEdit || value) credentials[f.key] = value;
      }

      const pricingRule = hasPricingRule
        ? {
            type: pricingType,
            value,
            roundTo,
            ...(capAtMsrp && { maxMsrp: 'use_supplier_msrp' as const }),
          }
        : null;

      const siteScope = multiSite && limitSites ? [...selectedSites] : [];

      if (supplier) {
        const { error: err } = await updateSupplier(supplier.id, {
          name: name.trim(),
          credentials,
          pricingRule,
          notes: notes.trim() || null,
          siteScope,
        });
        if (err) throw new Error(err);
      } else {
        const { error: err } = await createSupplier({
          name: name.trim(),
          type: vendor!.slug,
          credentials,
          pricingRule,
          notes: notes.trim() || null,
          siteScope,
        });
        if (err) throw new Error(err);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <Stack gap={5}>
        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Name <span className="text-[var(--color-danger)]">*</span>
          </Text>
          <Input
            placeholder="e.g. Printify — Main shop"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Stack>

        {fields.length > 0 && (
          <Stack gap={2}>
            <Text size="sm" className="font-medium">
              Connection credentials
            </Text>

            {/* Token is on file and the user hasn't chosen to rotate it — show a
                reassuring "saved" row so routine edits never demand the secret. */}
            {isEdit && hasStoredCreds && !credsOpen && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] px-3 py-2.5">
                <Stack direction="row" align="center" gap={2}>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-success)]" />
                  <Text size="sm" className="text-[var(--color-muted-foreground)]">
                    Saved — you don&apos;t need to re-enter it to make changes.
                  </Text>
                </Stack>
                <Button
                  type="button"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  onClick={() => setReplacingCreds(true)}
                >
                  Replace
                </Button>
              </div>
            )}

            {credsOpen && (
              <Stack gap={4}>
                {isEdit && !hasStoredCreds && (
                  <Text size="xs" className="text-[var(--color-warning)]">
                    No credentials on file — enter the token below to reconnect this supplier.
                  </Text>
                )}
                {fields.map((f) => (
                  <Stack key={f.key} gap={2}>
                    <Text size="sm" className="font-medium">
                      {f.label}
                      {f.required && !isEdit && (
                        <span className="text-[var(--color-danger)]"> *</span>
                      )}
                    </Text>
                    <Input
                      type={f.type === 'password' ? 'password' : f.type === 'url' ? 'url' : 'text'}
                      placeholder={f.placeholder}
                      value={creds[f.key] ?? ''}
                      onChange={(e) => setCreds((p) => ({ ...p, [f.key]: e.target.value }))}
                      autoComplete="off"
                    />
                    {f.help && (
                      <Text size="xs" className="text-[var(--color-muted-foreground)]">
                        {f.help}
                      </Text>
                    )}
                  </Stack>
                ))}

                {vendor?.credentialsHelpUrl && (
                  <Text size="xs" className="text-[var(--color-muted-foreground)]">
                    Need help finding these?{' '}
                    <a
                      href={vendor.credentialsHelpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {vendor.label} credentials guide
                    </a>
                  </Text>
                )}

                {/* Let the user back out of a rotation without wiping the stored
                    token (blank submit keeps it, but this avoids the inputs
                    lingering and reassures them nothing changed). */}
                {isEdit && hasStoredCreds && replacingCreds && (
                  <button
                    type="button"
                    className="self-start text-xs text-[var(--color-muted-foreground)] underline"
                    onClick={() => {
                      setReplacingCreds(false);
                      setCreds((p) => {
                        const cleared: Record<string, string> = {};
                        for (const k of Object.keys(p)) cleared[k] = '';
                        return cleared;
                      });
                    }}
                  >
                    Cancel — keep the saved credentials
                  </button>
                )}
              </Stack>
            )}
          </Stack>
        )}

        {/* Per-site enablement — only for multi-site tenants. */}
        {multiSite && (
          <Stack gap={3}>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                color="module"
                checked={limitSites}
                onCheckedChange={(v) => setLimitSites(v === true)}
              />
              <Text size="sm" className="font-medium">
                Limit this connection to specific sites
              </Text>
            </label>
            {!limitSites && (
              <Text size="xs" className="text-[var(--color-muted-foreground)]">
                Available on all of your sites.
              </Text>
            )}
            {limitSites && (
              <Stack gap={2} className="border-l-2 border-[var(--color-border)] pl-6">
                {sites.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      color="module"
                      checked={selectedSites.has(s.id)}
                      onCheckedChange={() => toggleSite(s.id)}
                    />
                    <Text size="sm">
                      {s.name}
                      {s.isPrimary && (
                        <span className="text-[var(--color-muted-foreground)]"> (primary)</span>
                      )}
                    </Text>
                  </label>
                ))}
              </Stack>
            )}
          </Stack>
        )}

        <Stack gap={3}>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              color="module"
              checked={hasPricingRule}
              onCheckedChange={(v) => setHasPricingRule(v === true)}
            />
            <Text size="sm" className="font-medium">
              Apply pricing rule to imported products
            </Text>
          </label>

          {hasPricingRule && (
            <Stack gap={3} className="border-l-2 border-[var(--color-border)] pl-6">
              <Stack gap={2}>
                <Text size="sm" className="font-medium">
                  Rule type
                </Text>
                <Select value={pricingType} onValueChange={setPricingType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Stack>

              <Stack gap={2}>
                <Text size="sm" className="font-medium">
                  {pricingType === 'percentage_markup' || pricingType === 'fixed_margin'
                    ? 'Percentage (%)'
                    : pricingType === 'multiplier'
                      ? 'Multiplier'
                      : 'Flat amount (cents)'}
                </Text>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={pricingType === 'multiplier' ? '1.5' : '30'}
                  value={pricingValue}
                  onChange={(e) => setPricingValue(e.target.value)}
                />
              </Stack>

              <Stack gap={2}>
                <Text size="sm" className="font-medium">
                  Round retail price to
                </Text>
                <Select value={roundTo} onValueChange={setRoundTo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUND_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Stack>

              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  color="module"
                  checked={capAtMsrp}
                  onCheckedChange={(v) => setCapAtMsrp(v === true)}
                />
                <Text size="sm">Cap retail price at supplier MSRP</Text>
              </label>
            </Stack>
          )}
        </Stack>

        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Internal notes
          </Text>
          <Textarea
            placeholder="Optional notes about this supplier"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Stack>

        {error && (
          <Text size="sm" className="text-[var(--color-danger)]">
            {error}
          </Text>
        )}

        <Stack direction="row" gap={2} className="justify-end">
          <Button type="button" color="neutral" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" color="primary" disabled={submitting}>
            {submitting ? 'Saving…' : supplier ? 'Save changes' : 'Connect supplier'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
