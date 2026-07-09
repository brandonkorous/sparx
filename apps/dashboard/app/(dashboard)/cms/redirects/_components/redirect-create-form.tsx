'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
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

import { createRedirect } from '../actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';
import { ViewSwitcher } from '../../../_components/detail-panel';
import { CREATE_SENTINEL } from '../../../_shell/detail-registry';

// New-redirect form, on the standard create surface (docs/86 F layout). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
//
// Redirects have NO detail view, so on success the form STAYS OPEN: it shows an
// inline success line, resets the fields + status Select, and refreshes the
// underlying list — there is no URL token switch into a record.

interface RedirectCreateFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'redirect', label: 'Redirect' }];

export function RedirectCreateForm({ surface }: RedirectCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [fromPath, setFromPath] = React.useState('');
  const [toPath, setToPath] = React.useState('');
  const [statusCode, setStatusCode] = React.useState('301');

  const v = useFieldValidation(
    { from_path: fromPath, to_path: toPath },
    {
      from_path: rule.required('Enter the path to redirect from.'),
      to_path: rule.required('Enter the path to redirect to.'),
    }
  );

  // Unsaved-changes guard. A create form starts empty, so "dirty" is simply
  // "the user has entered anything" — guard a Cancel / Close / Switch / backdrop
  // so typed work isn't silently dropped.
  const dirty = fromPath.trim() !== '' || toPath.trim() !== '' || statusCode !== '301';

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'redirect' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path and, through `cancel`, by the guarded Cancel.
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/cms/redirects');
    }
  }, [surface, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function submit() {
    setError(null);
    setMessage(null);
    if (!v.validate()) return;
    // The <Select> writes to React state, not native FormData — build the body
    // with the SAME keys the action expects.
    const data = new FormData();
    data.append('from_path', fromPath.trim());
    data.append('to_path', toPath.trim());
    data.append('status_code', statusCode);
    startTransition(async () => {
      const result = await createRedirect(data);
      if (!result.ok) {
        setError(result.error ?? 'Could not create redirect.');
        return;
      }
      // No detail view: stay open, reset to defaults, and refresh the list.
      setMessage('Redirect added.');
      setFromPath('');
      setToPath('');
      setStatusCode('301');
      router.refresh();
    });
  }

  return (
    <ModuleProvider module="cms" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="Add redirect"
        backLabel="Redirects"
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher typeId="redirect" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Redirect',
            supporting: 'Paths must begin with a slash. Same-path or loop targets are rejected.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Add redirect',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card>
            <CardBody className="py-6">
              <div className="flex flex-row flex-wrap items-end gap-3">
                <Field {...v.field('from_path')} className="flex-1">
                  <FieldLabel required>From</FieldLabel>
                  <FieldControl
                    name="from_path"
                    value={fromPath}
                    onChange={(e) => setFromPath(e.target.value)}
                    {...v.control('from_path')}
                    placeholder="/old-path"
                  />
                </Field>
                <Field {...v.field('to_path')} className="flex-1">
                  <FieldLabel required>To</FieldLabel>
                  <FieldControl
                    name="to_path"
                    value={toPath}
                    onChange={(e) => setToPath(e.target.value)}
                    {...v.control('to_path')}
                    placeholder="/new-path"
                  />
                </Field>
                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <Select
                    id="status_code"
                    aria-label="HTTP status code"
                    value={statusCode}
                    onValueChange={(val) => setStatusCode(val as string)}
                    items={{
                      '301': '301 Permanent',
                      '302': '302 Found',
                      '307': '307 Temporary',
                      '308': '308 Permanent (keep method)',
                    }}
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
          {message && (
            <FieldStatus status="success" attached={false} className="mt-4" aria-live="polite">
              {message}
            </FieldStatus>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
