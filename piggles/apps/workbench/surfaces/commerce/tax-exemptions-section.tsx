'use client';

// Tax exemption certificates, on the page of the buyer they belong to.
//
// A reseller, a farm, a school district: each can hand the shop a certificate
// saying it does not pay sales tax on what it buys, for one state or for the
// whole country. Checkout has honored a certificate on file for a while; what
// was missing was any screen to put one on file. The tax page promised they
// were "managed from that record", and neither the customer page nor the
// wholesale customer page had a word about them (sparx persona issue 075).
//
// One section, two homes: the wholesale customer page (`{ companyId }`, where a
// trade business keeps its certificate) and the customer page (`{ customerId }`,
// for someone who buys as themselves). On a customer it also says, in one line,
// when the wholesale customer they buy for already holds a certificate that covers them,
// because checkout applies it to them and a second copy would be a second date
// to keep track of.
//
// Each certificate is its own record with its own immediate write, so Add and
// Remove live here rather than on the page's Save, exactly as Addresses do. The
// add form is in the pane, not a modal, and registers as unsaved work while it
// holds anything typed.
//
// Only shown while selling is switched on: a certificate does its work at
// checkout, and with no checkout it would be a promise with nothing behind it.

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Select,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import {
  faBuilding,
  faFileCircleCheck,
  faPlus,
  faTrashCan,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import { apiErrorMessage } from '../../lib/api-error';
import { useModuleStates } from '../../lib/api/shell-data';
import { hasRegions, regionOptions } from '../../lib/geo';
import { dayEndUtc, dayStartUtc, NOT_A_DATE, todayIso } from '../../lib/today';
import { DayInput } from '../../components/day-input';
import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import { InlineWaiting } from '../../components/inline-waiting';
import { SaveFailure } from '../../components/save-failure';
import { useTaxZones } from './tax-data';
import {
  useAddTaxExemption,
  useRemoveTaxExemption,
  useTaxExemptions,
  type ExemptionHolder,
  type TaxExemption,
} from './tax-exemptions-data';
import {
  REASON_CHOICES,
  accountCoverLine,
  coverageChoices,
  coverageLabel,
  exemptionStanding,
  reasonLabel,
  removalConsequence,
  standingBadge,
  validityText,
  type ExemptionReason,
} from './tax-exemption-words';

/** This console's word for a trade business you sell to on agreed terms. */
const ACCOUNT_NOUN = 'wholesale customer';

/** What a certificate does, said once on the section. Kept to what the code
 *  does: checkout and repeat deliveries read certificates; a quote or invoice
 *  carries the rate typed on it and does not. */
const WHAT_IT_DOES =
  'A certificate stops sales tax being added at checkout on your website, for orders delivered to the place it covers. Quotes and invoices you write yourself use the tax rate you type on them.';

export type TaxExemptionsSectionProps = {
  /** Who this is, for the sentences: "O'Malley Ranch & Hay Co.", "Dale Pruitt". */
  name: string;
} & (
  | {
      customerId: string;
      /** Opens the wholesale customer they buy for. Omit where that page is unreachable. */
      onOpenAccount?: (accountId: string, event: { shiftKey: boolean; altKey: boolean }) => void;
    }
  | { companyId: string }
);

export function TaxExemptionsSection(props: TaxExemptionsSectionProps) {
  const { data: moduleStates } = useModuleStates();
  const sellingOn = (moduleStates ?? []).some((m) => m.slug === 'commerce' && m.enabled);
  if (!sellingOn) return null;
  return <Certificates {...props} />;
}

/** The same section on a record that has not been saved yet: there is nothing
 *  to file a certificate against, but the owner should see where it will go. */
export function TaxExemptionsNotYet({ noun }: { noun: string }) {
  const { data: moduleStates } = useModuleStates();
  const sellingOn = (moduleStates ?? []).some((m) => m.slug === 'commerce' && m.enabled);
  if (!sellingOn) return null;
  return (
    <ModuleScope module="commerce">
      <FormSection title="Tax exemption" description={WHAT_IT_DOES}>
        <Text>
          Save the {noun} first, then add their tax exemption certificate here if they have one.
        </Text>
      </FormSection>
    </ModuleScope>
  );
}

function Certificates(props: TaxExemptionsSectionProps) {
  const holder: ExemptionHolder =
    'customerId' in props ? { customerId: props.customerId } : { companyId: props.companyId };
  const isAccount = 'companyId' in props;
  const onOpenAccount = 'customerId' in props ? props.onOpenAccount : undefined;

  const query = useTaxExemptions(holder);
  const remove = useRemoveTaxExemption();
  const confirm = useConfirm();
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  const rows = query.data?.items ?? [];
  const account = query.data?.account ?? null;
  const coverLine = accountCoverLine(account, ACCOUNT_NOUN, rows.length > 0);
  const accountCovers =
    account?.exemptions.some((c) => exemptionStanding(c).kind === 'in_force') ?? false;

  const onRemove = async (certificate: TaxExemption) => {
    const others = [...rows, ...(account?.exemptions ?? [])];
    const ok = await confirm({
      title: `Remove certificate ${certificate.certificateNumber}?`,
      description: `${removalConsequence(certificate, others, props.name)} Orders already placed keep the tax they were charged. This cannot be undone.`,
      confirmLabel: 'Remove certificate',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(certificate.id, {
      onSuccess: () => {
        toast.add({
          title: `Certificate ${certificate.certificateNumber} removed`,
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove that certificate',
          description: apiErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <ModuleScope module="commerce">
      <FormSection
        title="Tax exemption"
        description={WHAT_IT_DOES}
        action={
          adding || query.isError ? null : (
            <Button
              size="sm"
              variant="outline"
              color="module"
              onClick={() => {
                setAdding(true);
              }}
            >
              <Icon glyph={faPlus} className="size-4" aria-hidden />
              Add certificate
            </Button>
          )
        }
      >
        {adding ? (
          <CertificateForm
            holder={holder}
            onDone={(number) => {
              setAdding(false);
              toast.add({ title: `Certificate ${number} added`, type: 'success' });
            }}
            onCancel={() => {
              setAdding(false);
            }}
          />
        ) : null}

        {query.isError ? (
          <div className="flex flex-wrap items-center gap-3">
            <Text>
              {apiErrorMessage(
                query.error,
                'The certificates on file could not be loaded just now. Nothing has been lost.'
              )}
            </Text>
            <Button
              size="sm"
              variant="outline"
              color="module"
              loading={query.isFetching}
              onClick={() => {
                void query.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        ) : query.isPending ? (
          <InlineWaiting label="Loading certificates…" />
        ) : (
          <>
            {rows.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {rows.map((certificate) => (
                  <CertificateRow
                    key={certificate.id}
                    certificate={certificate}
                    removing={remove.isPending && remove.variables === certificate.id}
                    onRemove={() => {
                      void onRemove(certificate);
                    }}
                  />
                ))}
              </ul>
            ) : adding ? null : accountCovers ? null : (
              <div className="flex items-start gap-2">
                <Icon glyph={faFileCircleCheck} className="mt-1 size-4 shrink-0" aria-hidden />
                <Text>
                  {isAccount
                    ? 'No certificate on file. Orders from this wholesale customer are taxed normally until you add one.'
                    : 'No certificate on file for this customer. Their orders are taxed normally until you add one.'}
                </Text>
              </div>
            )}

            {coverLine && account ? (
              <div className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3">
                <Icon glyph={faBuilding} className="size-4 shrink-0" aria-hidden />
                <Text className="min-w-0 flex-1">{coverLine}</Text>
                {onOpenAccount ? (
                  <Button
                    size="sm"
                    variant="outline"
                    color="module-b2b"
                    onClick={(event) => {
                      onOpenAccount(account.accountId, event);
                    }}
                  >
                    Open their page
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </FormSection>
    </ModuleScope>
  );
}

/* ── One certificate ────────────────────────────────────────────────────── */

function CertificateRow({
  certificate,
  removing,
  onRemove,
}: {
  certificate: TaxExemption;
  removing: boolean;
  onRemove: () => void;
}) {
  const badge = standingBadge(exemptionStanding(certificate));
  return (
    <li className="border-base-300 flex flex-wrap items-start gap-x-3 gap-y-2 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">
          {reasonLabel(certificate.reason)} · {coverageLabel(certificate.jurisdiction)}
        </span>
        <Text>Certificate number {certificate.certificateNumber}</Text>
        <Text>{validityText(certificate)}</Text>
      </div>
      <Badge color={badge.tone} variant="soft" size="sm">
        {badge.label}
      </Badge>
      <Button
        size="xs"
        variant="ghost"
        color="danger"
        loading={removing}
        onClick={onRemove}
        aria-label={`Remove certificate ${certificate.certificateNumber}`}
      >
        <Icon glyph={faTrashCan} className="size-3.5" aria-hidden />
      </Button>
    </li>
  );
}

/* ── Adding one ─────────────────────────────────────────────────────────── */

interface CertificateDraft {
  reason: ExemptionReason | '';
  jurisdiction: string;
  certificateNumber: string;
  validFrom: string;
  validTo: string;
}

function CertificateForm({
  holder,
  onDone,
  onCancel,
}: {
  holder: ExemptionHolder;
  onDone: (certificateNumber: string) => void;
  onCancel: () => void;
}) {
  const add = useAddTaxExemption();
  const zones = useTaxZones();
  const [draft, setDraft] = useState<CertificateDraft>(() => ({
    reason: '',
    jurisdiction: '',
    certificateNumber: '',
    validFrom: todayIso(),
    validTo: '',
  }));
  const [fromUnfinished, setFromUnfinished] = useState(false);
  const [untilUnfinished, setUntilUnfinished] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const set = <K extends keyof CertificateDraft>(key: K, value: CertificateDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  useDirtySource(
    draft.reason !== '' ||
      draft.jurisdiction !== '' ||
      draft.certificateNumber.trim() !== '' ||
      draft.validTo !== '',
    'This tax exemption certificate has not been added yet. Close anyway?'
  );

  // The countries the shop collects tax in, so a Canadian shop is offered its
  // provinces. The United States when it has set none up yet, or the list
  // could not be read: the place a certificate covers does not depend on it.
  const placeItems = useMemo(() => {
    const countries = [
      ...new Set((zones.data?.items ?? []).map((zone) => zone.country).filter(hasRegions)),
    ].sort((a, b) => (a === 'US' ? -1 : b === 'US' ? 1 : a.localeCompare(b)));
    return [
      { value: '', label: 'Choose where it covers' },
      ...coverageChoices(countries.length > 0 ? countries : ['US'], regionOptions),
    ];
  }, [zones.data]);

  const validFrom = dayStartUtc(draft.validFrom);
  const validTo = draft.validTo === '' ? null : dayEndUtc(draft.validTo);

  const reasonError = draft.reason === '' ? 'Choose what kind of certificate this is.' : null;
  const placeError = draft.jurisdiction === '' ? 'Choose where this certificate covers.' : null;
  const numberError =
    draft.certificateNumber.trim() === ''
      ? 'Type the number printed on the certificate.'
      : draft.certificateNumber.trim().length > 127
        ? 'That number is too long. The most it can be is 127 characters.'
        : null;
  const fromError = fromUnfinished
    ? null
    : draft.validFrom === ''
      ? 'Choose the day it starts.'
      : validFrom === null
        ? NOT_A_DATE
        : null;
  const untilError = untilUnfinished
    ? null
    : draft.validTo !== '' && validTo === null
      ? NOT_A_DATE
      : validFrom && validTo && validTo < validFrom
        ? 'It cannot end before it starts.'
        : null;
  const blocked =
    reasonError ??
    placeError ??
    numberError ??
    fromError ??
    untilError ??
    (fromUnfinished || untilUnfinished ? 'unfinished' : null);

  const submit = () => {
    setFailure(null);
    if (blocked || !validFrom || draft.reason === '') {
      setShowErrors(true);
      return;
    }
    const certificateNumber = draft.certificateNumber.trim();
    add.mutate(
      {
        ...('customerId' in holder
          ? { customerId: holder.customerId }
          : { companyId: holder.companyId }),
        jurisdiction: draft.jurisdiction,
        reason: draft.reason,
        certificateNumber,
        validFrom,
        ...(validTo ? { validTo } : {}),
      },
      {
        onSuccess: () => {
          onDone(certificateNumber);
        },
        onError: (error) => {
          setFailure(apiErrorMessage(error, 'Nothing was saved. Try again in a moment.'));
        },
      }
    );
  };

  return (
    <div className="border-base-300 bg-base-200 flex flex-col gap-3 rounded-lg border p-3">
      <div className="grid gap-3 @md:grid-cols-2">
        <Field>
          <FieldLabel>What kind</FieldLabel>
          <Select
            color={reasonError && showErrors ? 'error' : 'module'}
            aria-label="What kind of certificate"
            value={draft.reason}
            items={[{ value: '', label: 'Choose the kind' }, ...REASON_CHOICES]}
            onValueChange={(next) => {
              set('reason', ((next as string | null) ?? '') as ExemptionReason | '');
            }}
          />
          {reasonError && showErrors ? (
            <FieldStatus status="error">{reasonError}</FieldStatus>
          ) : null}
        </Field>
        <Field>
          <FieldLabel>Where it covers</FieldLabel>
          <Select
            color={placeError && showErrors ? 'error' : 'module'}
            aria-label="Where the certificate covers"
            value={draft.jurisdiction}
            items={placeItems}
            onValueChange={(next) => {
              set('jurisdiction', (next as string | null) ?? '');
            }}
          />
          {placeError && showErrors ? (
            <FieldStatus status="error">{placeError}</FieldStatus>
          ) : (
            <FieldDescription>
              The state printed on the certificate. Orders delivered anywhere else are still taxed.
            </FieldDescription>
          )}
        </Field>
      </div>

      <Field>
        <FieldLabel>Certificate number</FieldLabel>
        <FieldControl
          render={
            <Input
              color={numberError && showErrors ? 'error' : 'module'}
              value={draft.certificateNumber}
              onChange={(event) => {
                set('certificateNumber', event.target.value);
              }}
            />
          }
        />
        {numberError && showErrors ? (
          <FieldStatus status="error">{numberError}</FieldStatus>
        ) : (
          <FieldDescription>
            As printed on their certificate, so you can find it again if anyone asks.
          </FieldDescription>
        )}
      </Field>

      <div className="grid gap-3 @md:grid-cols-2">
        <Field>
          <FieldLabel>Starts</FieldLabel>
          <DayInput
            color={fromError && showErrors ? 'error' : 'module'}
            aria-label="Day the certificate starts"
            value={draft.validFrom}
            onValueChange={(value, incomplete) => {
              setFromUnfinished(incomplete);
              set('validFrom', value);
            }}
          />
          {fromError && showErrors ? <FieldStatus status="error">{fromError}</FieldStatus> : null}
        </Field>
        <Field>
          <FieldLabel>Ends</FieldLabel>
          <DayInput
            color={untilError && showErrors ? 'error' : 'module'}
            aria-label="Day the certificate ends"
            value={draft.validTo}
            onValueChange={(value, incomplete) => {
              setUntilUnfinished(incomplete);
              set('validTo', value);
            }}
          />
          {untilError && showErrors ? (
            <FieldStatus status="error">{untilError}</FieldStatus>
          ) : (
            <FieldDescription>Leave it empty if the certificate has no end date.</FieldDescription>
          )}
        </Field>
      </div>

      <SaveFailure title="Could not add this certificate" message={failure} />

      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" color="module" loading={add.isPending} onClick={submit}>
          Add certificate
        </Button>
      </div>
    </div>
  );
}
