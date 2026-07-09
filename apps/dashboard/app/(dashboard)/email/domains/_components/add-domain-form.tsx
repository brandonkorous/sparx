'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ModuleProvider, toast, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import {
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Select,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { createDomainAction } from '../actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';
import { ViewSwitcher } from '../../../_components/detail-panel';
import { CREATE_SENTINEL } from '../../../_shell/detail-registry';

// New sending-domain form, on the standard create surface (docs/86 F layout). The
// SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
//
// Sending domains have NO detail view, so there is no create-flows-into-view
// transition: on success we keep the form open, reset the field, and refresh the
// list behind so the user can add another / read the DNS records.

interface AddDomainFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'domain', label: 'Domain' }];

export function AddDomainForm({ surface }: AddDomainFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [domain, setDomain] = useState('');
  const [region, setRegion] = useState('us');
  const [error, setError] = useState<string | null>(null);

  const v = useFieldValidation(
    { domain },
    { domain: rule.required('Enter a domain to send from.') }
  );

  // Unsaved-changes guard. A create form starts empty, so "dirty" is simply
  // "the user has entered anything" — guard a Cancel / Close / Switch / backdrop
  // so typed work isn't silently dropped.
  const dirty = domain.trim() !== '' || region !== 'us';

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'sending domain' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path and, through `cancel`, by the guarded Cancel.
  function close() {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/email/domains');
    }
  }

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  async function cancel() {
    if (await guardLeave()) close();
  }

  function submit() {
    setError(null);
    if (!v.validate()) return;
    startTransition(async () => {
      const result = await createDomainAction({ domain: domain.trim(), region });
      if (result.ok) {
        toast.success(`${result.data.domain} added — publish the DNS records, then verify.`);
        setDomain('');
        router.refresh();
      } else {
        setError(result.error.message);
        toast.error(result.error.message);
      }
    });
  }

  return (
    <ModuleProvider module="email" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="Add a sending domain"
        backLabel="Sending domains"
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher typeId="sending-domain" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Add a sending domain',
            supporting:
              'Enter the domain (or subdomain) you want to send from. sparx provisions it in Mailgun and shows the exact DNS records to publish.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Add domain',
            nextLoading: pending,
            nextDisabled: pending || !domain.trim(),
          }}
        >
          <Card>
            <CardBody className="py-6">
              <div className="flex flex-row flex-wrap items-end gap-3">
                <Field {...v.field('domain')} className="min-w-64 flex-1">
                  <FieldLabel required>Domain</FieldLabel>
                  <FieldControl
                    name="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    {...v.control('domain')}
                    placeholder="mail.yourstore.com"
                    disabled={pending}
                    autoComplete="off"
                  />
                </Field>
                <Field>
                  <FieldLabel>Region</FieldLabel>
                  <Select
                    id="region"
                    className="w-32"
                    value={region}
                    onValueChange={(val) => setRegion(val as string)}
                    disabled={pending}
                    items={{ us: 'US', eu: 'EU' }}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              className="mt-4"
              role="alert"
              aria-live="polite"
            >
              {error}
            </FieldStatus>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
