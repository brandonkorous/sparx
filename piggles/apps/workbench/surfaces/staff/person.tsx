'use client';

// ONE PERSON — everything the business knows about someone who works for it.
//
// ── Create and manage are ONE pane ────────────────────────────────────────
//
// `{id:'new'}` is this form before the person exists, `{id}` is it after.
//
// ── Identity is an EDITABLE FIELD, not a heading ──────────────────────────
//
// Their name is the field you type in, never also a read-only title above the
// body. Lifecycle lives in the pane's own toolbar.
//
// ── Pay is behind a gate, and absence is explained ────────────────────────
//
// Rates, documents and commission need `admin`. For anyone below it the API
// returns 403 and those sections say so IN WORDS, because an empty rate history
// reads as "nobody has ever recorded what this person earns" — a much more
// alarming and quite different statement from "you are not allowed to see this".
//
// This file holds the pane's state and composes it; every section is a person-*
// sibling.

import { useEffect, useMemo, useState } from 'react';

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Card,
  Text,
} from '@wizeworks/silicaui-react';
import { faShieldCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useSites, useViewer } from '../../lib/api/shell-data';
import { productCopy } from '../../lib/product';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { isNotFound, useStaffMember, useTimeEntries } from './data';
import { EMPTY, formFrom, type FormState } from './person-form';
import { usePersonWrites } from './person-writes';
import { PersonToolbar } from './person-toolbar';
import { PersonIdentity, PersonSites } from './person-identity';
import { PersonBookable } from './person-bookable';
import { PersonPayroll } from './person-payroll';
import { PaySection } from './person-pay';
import { CertificationsSection } from './person-certifications';
import { DocumentsSection } from './person-documents';
import { HoursSection } from './person-hours';
import { CommissionSection } from './person-commission';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/** The form, its baseline, and the leave-guard that follows the gap between
 *  them. `loaded` gates the guard: an unloaded form is not an edited one. */
function usePersonForm(ctx: SurfaceContext, id: string, isNew: boolean) {
  const person = useStaffMember(id);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [baseline, setBaseline] = useState<FormState>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isNew) {
      setLoaded(true);
      return;
    }
    if (person.data && !loaded) {
      const next = formFrom(person.data);
      setForm(next);
      setBaseline(next);
      setLoaded(true);
    }
  }, [isNew, person.data, loaded]);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New person' : (person.data?.name ?? 'Person'));
  }, [ctx, isNew, person.data?.name]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  useDirtySource(
    dirty && loaded,
    isNew
      ? 'This person has not been saved yet. Close anyway?'
      : `Changes to ${form.firstName || 'this person'} have not been saved. Close anyway?`
  );

  return {
    person,
    form,
    setForm,
    loaded,
    set: <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    rebase: () => {
      setBaseline(form);
    },
    canSave: form.firstName.trim() !== '' && (isNew || dirty),
  };
}

export function PersonSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';

  const viewer = useViewer();
  const sites = useSites();
  const openClocks = useTimeEntries({ staffMemberId: id, status: 'open' }, !isNew);

  const state = usePersonForm(ctx, id, isNew);
  const { person, form, loaded } = state;
  const writes = usePersonWrites({
    ctx,
    id,
    isNew,
    person: person.data,
    onSaved: state.rebase,
  });

  const canSeePay = viewer.data?.role === 'admin' || viewer.data?.role === 'owner';

  if (!isNew && person.isError) {
    const gone = isNotFound(person.error);
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            reason={gone ? 'missing' : 'unreachable'}
            title={gone ? 'This person is no longer on file' : 'Could not load this person'}
            description={
              gone
                ? 'The record may have been deleted. Everything else on your roster is unaffected.'
                : 'This is a problem reaching the server. The record itself is unaffected.'
            }
            onRetry={() => {
              void person.refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (!isNew && (person.isPending || !loaded)) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  const archived = person.data?.archivedAt !== null && person.data?.archivedAt !== undefined;

  return (
    <div className={PANE_SHELL}>
      <PersonToolbar
        id={id}
        isNew={isNew}
        archived={archived}
        status={form.status}
        running={openClocks.data?.items[0] ?? null}
        canSave={state.canSave}
        person={person}
        writes={writes}
        onSave={() => {
          if (state.canSave) writes.onSave(form);
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {archived ? (
            <Alert color="warning">
              <AlertContent>
                <AlertTitle>This person has left</AlertTitle>
                <AlertDescription>
                  They are off the roster and out of the schedule. Their hours and costs are
                  untouched. Use the restore button above to bring them back.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <PersonIdentity form={form} set={state.set} />
          <PersonSites form={form} setForm={state.setForm} sites={sites.data ?? []} />

          {isNew ? (
            <Alert color="info">
              <AlertContent>
                <AlertTitle>Pay, hours and qualifications come next</AlertTitle>
                <AlertDescription>
                  Save this person first. Their pay rate, tickets and paperwork all attach to the
                  record once it exists.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : (
            <>
              {person.data ? <PersonBookable ctx={ctx} person={person.data} /> : null}
              <PaySection staffMemberId={id} canSeePay={canSeePay} />
              <CertificationsSection staffMemberId={id} />
              {/* Only the businesses THIS person works at — offering the whole
                  tenant's list would let an hour be filed against a business
                  they have never set foot in. */}
              <HoursSection
                staffMemberId={id}
                sites={(sites.data ?? []).filter((site) => form.siteIds.includes(site.id))}
                ctx={ctx}
              />
              <CommissionSection staffMemberId={id} canSeePay={canSeePay} />
              <DocumentsSection staffMemberId={id} canSeePay={canSeePay} />
              <PersonPayroll form={form} set={state.set} />

              <div className="flex items-center gap-2 px-1 pb-2">
                <Icon glyph={faShieldCheck} className="size-4 shrink-0" aria-hidden />
                <Text className="text-xs">
                  {productCopy(
                    'staff.notPayroll',
                    'Piggles is not a payroll system. It records what people worked and what that cost — it does not withhold tax, file returns, or pay anybody.'
                  )}
                </Text>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
