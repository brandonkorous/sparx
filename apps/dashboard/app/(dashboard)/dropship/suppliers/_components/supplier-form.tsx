'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, toast, type SurfaceStepDef } from '@sparx/ui';
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Select,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { createSupplier, updateSupplier } from '../_lib/actions';
import { VendorPicker } from './vendor-picker';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

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

// Dropship-supplier connect/edit on the standard form surface (docs/86 F layout).
// ONE component drives page / overlay / modal. CREATE is a two-step flow (pick a
// vendor from the catalog → configure the connection); EDIT is single-step config
// and rides a self-owned modal. The picker is the first SurfaceFrame step.

type Presentation = 'page' | 'overlay' | 'modal';

interface SupplierFormProps {
  presentation: Presentation;
  /** Edit flow: the existing supplier. */
  supplier?: Supplier;
  /** Edit flow: the resolved vendor spec (for the credential fields). */
  vendor?: Vendor;
  /** Create flow: the connectable vendor catalog. */
  vendors?: Vendor[];
  /** The tenant's sites, for per-site enablement. */
  sites: SiteOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

const CREATE_STEPS: SurfaceStepDef[] = [
  { key: 'vendor', label: 'Supplier' },
  { key: 'configure', label: 'Configure' },
];
const EDIT_STEPS: SurfaceStepDef[] = [{ key: 'configure', label: 'Configure' }];

export function SupplierForm({
  presentation,
  supplier,
  vendor,
  vendors,
  sites,
  open,
  onOpenChange,
}: SupplierFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEdit = Boolean(supplier);

  const [step, setStep] = useState(isEdit ? 1 : 0);
  const [chosenVendor, setChosenVendor] = useState<Vendor | null>(null);
  const activeVendor = supplier ? vendor : chosenVendor;

  const fields: VendorCredentialField[] =
    supplier?.credentialFields ?? activeVendor?.credentialFields ?? [];
  const hasStoredCreds = supplier?.credentialsSet ?? false;

  const [name, setName] = useState(supplier?.name ?? '');
  const [creds, setCreds] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of supplier?.credentialFields ?? []) init[f.key] = '';
    return init;
  });
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

  const multiSite = sites.length > 1;
  const [limitSites, setLimitSites] = useState((supplier?.siteScope?.length ?? 0) > 0);
  const [selectedSites, setSelectedSites] = useState<Set<string>>(
    () => new Set(supplier?.siteScope ?? [])
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real field rules: name is always required; the pricing amount must be a
  // number when a pricing rule is enabled. Dynamic credential + per-site checks
  // stay form-level (they depend on the chosen vendor's field set).
  const v = useFieldValidation(
    { name, pricingValue },
    {
      name: rule.required('Name is required.'),
      pricingValue: (val) =>
        hasPricingRule && Number.isNaN(parseFloat(String(val)))
          ? 'Pricing rule value must be a number.'
          : null,
    }
  );

  // Create is dirty once a vendor is chosen (the work begins at selection); edit
  // is dirty once any field changes from the loaded record.
  const editSnapshot = () =>
    JSON.stringify({
      name,
      creds,
      notes,
      hasPricingRule,
      pricingType,
      pricingValue,
      roundTo,
      capAtMsrp,
      limitSites,
      sites: [...selectedSites],
    });
  const [initial] = useState(editSnapshot);
  const dirty = isEdit ? editSnapshot() !== initial : chosenVendor !== null;

  const guardLeave = useUnsavedGuard(
    dirty,
    isEdit ? { kind: 'edit', noun: 'supplier' } : { kind: 'create', noun: 'supplier' }
  );

  const close = useCallback(() => {
    if (presentation === 'modal') {
      onOpenChange?.(false);
      return;
    }
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
      return;
    }
    router.push('/dropship/suppliers');
  }, [presentation, onOpenChange, pathname, searchParams, router]);

  const cancel = useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function onRequestClose(): boolean {
    if (saving) return false;
    if (!dirty) return true;
    void Promise.resolve(guardLeave()).then((ok) => ok && close());
    return false;
  }
  function onCancelClick() {
    if (saving) return;
    void Promise.resolve(guardLeave()).then((ok) => ok && close());
  }

  function chooseVendor(v: Vendor) {
    setChosenVendor(v);
    setName(v.label);
    setCreds(Object.fromEntries(v.credentialFields.map((f) => [f.key, ''])));
    setStep(1);
  }

  function backToPicker() {
    setStep(0);
    setChosenVendor(null);
    setName('');
    setCreds({});
    setError(null);
  }

  function toggleSite(id: string) {
    setSelectedSites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (!v.validate()) return;
    if (!isEdit) {
      for (const f of fields) {
        if (f.required && !creds[f.key]?.trim()) {
          setError(`${f.label} is required.`);
          return;
        }
      }
    }
    const value = parseFloat(pricingValue);
    if (multiSite && limitSites && selectedSites.size === 0) {
      setError('Select at least one site, or switch back to all sites.');
      return;
    }

    setSaving(true);
    // On edit, send ONLY the fields the user re-entered; the backend merges them
    // over the stored secrets so blanks keep their value. On create, send all.
    const credentials: Record<string, string> = {};
    for (const f of fields) {
      const v = (creds[f.key] ?? '').trim();
      if (!isEdit || v) credentials[f.key] = v;
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

    const { error: err } = supplier
      ? await updateSupplier(supplier.id, {
          name: name.trim(),
          credentials,
          pricingRule,
          notes: notes.trim() || null,
          siteScope,
        })
      : await createSupplier({
          name: name.trim(),
          type: chosenVendor!.slug,
          credentials,
          pricingRule,
          notes: notes.trim() || null,
          siteScope,
        });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    toast.success(supplier ? 'Supplier updated' : 'Supplier connected');
    close();
    router.refresh();
  }

  const heading = supplier
    ? 'Edit supplier'
    : activeVendor
      ? `Connect ${activeVendor.label}`
      : 'Connect a supplier';

  const pickerStep = (
    <SurfaceStep
      header={{
        title: 'Connect a supplier',
        supporting: 'Choose a supplier to source and import products from.',
      }}
    >
      <VendorPicker vendors={vendors ?? []} onSelect={chooseVendor} />
    </SurfaceStep>
  );

  const configStep = (
    <SurfaceStep
      header={{
        title: heading,
        supporting: activeVendor?.description ?? 'Connection settings, pricing, and availability.',
      }}
      actions={{
        ...(isEdit ? {} : { onBack: backToPicker }),
        onNext: () => void submit(),
        nextLabel: supplier ? 'Save changes' : 'Connect supplier',
        nextLoading: saving,
        nextDisabled: saving,
      }}
    >
      <Card>
        <CardBody className="py-6">
          <div className="flex flex-col gap-5">
            <Field {...v.field('name')}>
              <FieldLabel required>Name</FieldLabel>
              <FieldControl
                id="sup-name"
                placeholder="e.g. Printify — Main shop"
                value={name}
                onChange={(e) => setName(e.target.value)}
                {...v.control('name')}
              />
            </Field>

            {fields.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Connection credentials</p>

                {isEdit && hasStoredCreds && !credsOpen && (
                  <div className="border-base-300 flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                    <div className="flex flex-row items-center gap-2">
                      <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
                      <p className="text-base-content/70 text-sm">
                        Saved — you don&apos;t need to re-enter it to make changes.
                      </p>
                    </div>
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
                  <div className="flex flex-col gap-4">
                    {isEdit && !hasStoredCreds && (
                      <p className="text-warning text-xs">
                        No credentials on file — enter the token below to reconnect this supplier.
                      </p>
                    )}
                    {fields.map((f) => (
                      <Field key={f.key}>
                        <FieldLabel required={f.required && !isEdit}>{f.label}</FieldLabel>
                        <FieldControl
                          id={`sup-cred-${f.key}`}
                          type={
                            f.type === 'password' ? 'password' : f.type === 'url' ? 'url' : 'text'
                          }
                          placeholder={f.placeholder}
                          value={creds[f.key] ?? ''}
                          onChange={(e) => setCreds((p) => ({ ...p, [f.key]: e.target.value }))}
                          autoComplete="off"
                        />
                        {f.help && <FieldDescription>{f.help}</FieldDescription>}
                      </Field>
                    ))}

                    {activeVendor?.credentialsHelpUrl && (
                      <p className="text-base-content/70 text-xs">
                        Need help finding these?{' '}
                        <a
                          href={activeVendor.credentialsHelpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {activeVendor.label} credentials guide
                        </a>
                      </p>
                    )}

                    {isEdit && hasStoredCreds && replacingCreds && (
                      <button
                        type="button"
                        className="text-base-content/60 self-start text-xs underline"
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
                  </div>
                )}
              </div>
            )}

            {multiSite && (
              <div className="flex flex-col gap-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    color="module"
                    checked={limitSites}
                    onChange={(e) => setLimitSites(e.target.checked)}
                  />
                  <p className="text-sm font-medium">Limit this connection to specific sites</p>
                </label>
                {!limitSites && (
                  <p className="text-base-content/70 text-xs">Available on all of your sites.</p>
                )}
                {limitSites && (
                  <div className="border-base-300 flex flex-col gap-2 border-l-2 pl-6">
                    {sites.map((s) => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          color="module"
                          checked={selectedSites.has(s.id)}
                          onChange={() => toggleSite(s.id)}
                        />
                        <p className="text-sm">
                          {s.name}
                          {s.isPrimary && <span className="text-base-content/60"> (primary)</span>}
                        </p>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  color="module"
                  checked={hasPricingRule}
                  onChange={(e) => setHasPricingRule(e.target.checked)}
                />
                <p className="text-sm font-medium">Apply pricing rule to imported products</p>
              </label>

              {hasPricingRule && (
                <div className="border-base-300 flex flex-col gap-3 border-l-2 pl-6">
                  <Field>
                    <FieldLabel>Rule type</FieldLabel>
                    <FieldControl
                      render={
                        <Select
                          value={pricingType}
                          onValueChange={(val) => setPricingType(val as string)}
                          items={PRICING_TYPES}
                        />
                      }
                    />
                  </Field>

                  <Field {...v.field('pricingValue')}>
                    <FieldLabel>
                      {pricingType === 'percentage_markup' || pricingType === 'fixed_margin'
                        ? 'Percentage (%)'
                        : pricingType === 'multiplier'
                          ? 'Multiplier'
                          : 'Flat amount (cents)'}
                    </FieldLabel>
                    <FieldControl
                      id="sup-pricing-value"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={pricingType === 'multiplier' ? '1.5' : '30'}
                      value={pricingValue}
                      onChange={(e) => setPricingValue(e.target.value)}
                      {...v.control('pricingValue')}
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Round retail price to</FieldLabel>
                    <FieldControl
                      render={
                        <Select
                          value={roundTo}
                          onValueChange={(val) => setRoundTo(val as string)}
                          items={ROUND_OPTIONS}
                        />
                      }
                    />
                  </Field>

                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      color="module"
                      checked={capAtMsrp}
                      onChange={(e) => setCapAtMsrp(e.target.checked)}
                    />
                    <p className="text-sm">Cap retail price at supplier MSRP</p>
                  </label>
                </div>
              )}
            </div>

            <Field>
              <FieldLabel>Internal notes</FieldLabel>
              <FieldControl
                id="sup-notes"
                placeholder="Optional notes about this supplier"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                render={<Textarea rows={2} />}
              />
            </Field>

            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}
          </div>
        </CardBody>
      </Card>
    </SurfaceStep>
  );

  const steps = isEdit ? EDIT_STEPS : CREATE_STEPS;
  const body = !isEdit && step === 0 ? pickerStep : configStep;

  if (presentation === 'modal') {
    return (
      <ModuleProvider module="dropship">
        <SurfaceFrame
          variant="modal"
          title={heading}
          steps={steps}
          current={isEdit ? 0 : step}
          open={open}
          onOpenChange={(next) => {
            if (!next) close();
          }}
          onRequestClose={onRequestClose}
          footer={
            <Button variant="ghost" color="neutral" size="sm" onClick={onCancelClick}>
              Cancel
            </Button>
          }
        >
          {body}
        </SurfaceFrame>
      </ModuleProvider>
    );
  }

  return (
    <ModuleProvider module="dropship" className="h-full">
      <SurfaceFrame
        variant={presentation === 'overlay' ? 'inline' : 'embedded'}
        title={heading}
        steps={steps}
        current={isEdit ? 0 : step}
        onCancel={cancel}
      >
        {body}
      </SurfaceFrame>
    </ModuleProvider>
  );
}
