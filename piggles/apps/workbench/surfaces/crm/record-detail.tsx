'use client';

// One row of a tenant-invented object (docs/144 §3.6).
//
// ONE SURFACE FOR EVERY CUSTOM OBJECT, the same way the list is. Create and
// manage are the same pane ({id:'new'} → {id}), per the workbench rule — so the
// form is written once and a business inventing a fifth record type gets it for
// nothing.
//
// THE WHOLE RECORD IS ITS PROPERTIES. Unlike a contact or a deal — which carry a
// fixed spine of indexed columns with tenant properties added on top — a custom
// record IS its object's schema and nothing else. So this pane has no identity
// header of its own: `PropertyFields` renders the lot, and the title comes from
// whichever property the business nominated.
//
// It reuses the SAME renderer the "More details" panel uses on contacts and
// deals rather than a second one. One field engine means a date field behaves
// identically wherever it appears, and a fix to a repeater is a fix everywhere.

import { useEffect, useMemo, useState } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  Heading,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faTable, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import { PaneEmpty } from '../../components/pane-empty';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PropertyFields } from './custom-properties-panel';
import { useObjectType } from './object-types-data';
import { AssociationsPanel } from './associations-panel';
import { recordErrorMessage, recordTitle, useRecord, useRecordMutations } from './records-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/** Registry module, so the brand draws Customers' own picture. */
const MODULE = 'crm';

/** The four built-in objects and the screen each really lives on. Mirrors the
 *  map in `records-list.tsx`, because both panes are addressable by key. */
const BUILTIN_SCREEN: Record<string, string> = {
  contact: 'crm.customers.list',
  company: 'crm.accounts.list',
  deal: 'crm.deals.list',
  ticket: 'crm.tickets.list',
};

function sameBag(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function RecordDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const objectKey = String(ctx.params.objectKey ?? '');
  const id = String(ctx.params.id ?? 'new');
  const isNew = id === 'new';

  const type = useObjectType(objectKey);
  const record = useRecord(id);
  const { create, update, remove } = useRecordMutations(objectKey);
  const toast = useToast();
  const confirm = useConfirm();

  const saved = useMemo<Record<string, unknown>>(() => record.data?.values ?? {}, [record.data]);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isNew) {
      setLoaded(true);
      return;
    }
    if (record.data && !loaded) {
      setDraft(saved);
      setLoaded(true);
    }
  }, [isNew, record.data, saved, loaded]);

  const label = type.data?.label ?? 'Record';
  const labelPlural = type.data?.labelPlural ?? 'Records';
  const title = record.data ? recordTitle(record.data, type.data?.primaryFieldKey ?? null) : '';

  useEffect(() => {
    ctx.setTitle(isNew ? `New ${label.toLowerCase()}` : title || label);
  }, [ctx, isNew, label, title]);

  const dirty = isNew ? Object.keys(draft).length > 0 : !sameBag(draft, saved);
  useDirtySource(
    dirty,
    isNew
      ? `This ${label.toLowerCase()} has not been created yet. Close anyway?`
      : `This ${label.toLowerCase()} has unsaved changes. Close anyway?`
  );

  const fields = type.data?.propertySchema?.fields ?? [];
  const saving = create.isPending || update.isPending;

  const submit = (): void => {
    if (isNew) {
      create.mutate(draft, {
        onSuccess: (created) => {
          toast.add({ title: `${label} added`, type: 'success' });
          // Become the record we just made, rather than opening a second pane
          // for it — the person is already looking at this one.
          ctx.open('crm.record.detail', { id: created.id, objectKey }, { target: 'replace' });
        },
        onError: (error) => {
          toast.add({
            title: `Could not add this ${label.toLowerCase()}`,
            description: recordErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      });
      return;
    }
    update.mutate(
      { id, values: draft },
      {
        onSuccess: () => {
          toast.add({ title: 'Saved', type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not save',
            description: recordErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const onDelete = async (): Promise<void> => {
    const ok = await confirm({
      title: `Remove ${title || `this ${label.toLowerCase()}`}?`,
      description:
        'It comes out of your lists. Anything linked to it keeps its own history, and you can add it again later.',
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${label} removed`, type: 'success' });
        });
      },
    });
  };

  // A BUILT-IN OBJECT HAS ITS OWN SCREEN, AND THIS IS NOT IT.
  //
  // `crm_records` holds tenant-invented objects only, so addressed with a
  // built-in key — `/crm/records/contact/new` — this pane drew a working "New
  // customer" form with an "Add customer" button on it. Pressing it would have
  // written a customer that never appears on the Customers screen, can never be
  // sold to and can never be found. The fact that stops it was already on the
  // record the pane had fetched: `kind: 'builtin'`.
  // [[feedback_fetched_but_never_rendered]]
  if (type.data?.kind === 'builtin') {
    const target = BUILTIN_SCREEN[objectKey];
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 overflow-y-auto">
          <PaneEmpty
            module={MODULE}
            icon={<Icon glyph={faTable} className="size-6" aria-hidden />}
            title={`${labelPlural} have a screen of their own`}
            description={`This screen is for the things you chose to track yourself. ${labelPlural} came with Piggles, so adding one here would make something none of your other screens could ever find.`}
            {...(target
              ? {
                  actions: (
                    <Button
                      color="module"
                      onClick={() => {
                        ctx.open(target, {}, { target: 'replace' });
                      }}
                    >
                      Open {labelPlural}
                    </Button>
                  ),
                }
              : {})}
          />
        </Card>
      </div>
    );
  }

  // A record that is not there (removed, or another business's id) says so,
  // rather than drawing its form under Remove and Save with the server's own
  // words above it (persona issue 226).
  if (!isNew && record.isError) {
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          error={record.error}
          noun={label.toLowerCase()}
          title={`Could not load this ${label.toLowerCase()}`}
          description={`This is a problem reaching the server. The ${label.toLowerCase()} itself is unaffected. Try again in a moment.`}
          onRetry={() => {
            void record.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label={`${label} actions`}
        status={
          <>
            <Icon glyph={faTable} className="size-4 shrink-0" aria-hidden />
            <Text as="span" className="truncate text-sm">
              {isNew ? `New ${label.toLowerCase()}` : title}
            </Text>
          </>
        }
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0"
            loading={saving}
            disabled={!isNew && !dirty}
            onClick={submit}
          >
            {isNew ? `Add ${label.toLowerCase()}` : 'Save'}
          </Button>
        }
        /* A VALUE, not bespoke JSX: `controls` relocates into the narrow bar's
           overflow popover verbatim, so this was a bare red bin among rows that
           had words. scripts/check-toolbar-glyph.mjs holds the line. */
        actions={
          isNew
            ? undefined
            : [
                {
                  label: 'Remove',
                  title: `Remove this ${label.toLowerCase()}`,
                  icon: faTrashCan,
                  tone: 'danger' as const,
                  onClick: () => {
                    void onDelete();
                  },
                },
              ]
        }
        refresh={
          <RefreshButton
            isFetching={record.isFetching || type.isFetching}
            updatedAt={record.data ? record.dataUpdatedAt : undefined}
            onRefresh={() => {
              void record.refetch();
              void type.refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {fields.length === 0 && type.isSuccess ? (
            <Alert color="info">
              <AlertContent>
                <AlertTitle>This kind of thing has no details on it yet</AlertTitle>
                <AlertDescription>
                  Add some fields to &ldquo;{type.data?.label}&rdquo; under things you track, and
                  they will appear here.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {fields.length > 0 ? (
            <FormSection
              title={label}
              description="Everything this business chose to track on these records."
            >
              <PropertyFields fields={fields} values={draft} onChange={setDraft} />
            </FormSection>
          ) : null}

          {!isNew ? (
            <>
              <Heading level={2} className="sr-only">
                Who else is involved
              </Heading>
              <AssociationsPanel objectKey={objectKey} recordId={id} ctx={ctx} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
