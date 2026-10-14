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
//
// The draft, Save and Remove are use-record-editor.ts (sparx persona issue 240,
// which also stopped a missing type drawing a form).

import { useEffect, type ReactNode } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  Heading,
} from '@wizeworks/silicaui-react';
import { faTable } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { PaneEmpty } from '../../components/pane-empty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PropertyFields } from './custom-properties-panel';
import { useObjectType, type PropertyField } from './object-types-data';
import { AssociationsPanel } from './associations-panel';
import { recordTitle } from './records-data';
import { MODULE, RecordTypeMissing } from './records-list-states';
import { useRecordEditor } from './use-record-editor';
import { RecordToolbar } from './record-toolbar';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/** The four built-in objects and the screen each really lives on. Mirrors the
 *  map in `records-list.tsx`, because both panes are addressable by key. */
const BUILTIN_SCREEN: Record<string, string> = {
  contact: 'crm.customers.list',
  company: 'crm.accounts.list',
  deal: 'crm.deals.list',
  ticket: 'crm.tickets.list',
};

export type Editor = ReturnType<typeof useRecordEditor>;

// A BUILT-IN OBJECT HAS ITS OWN SCREEN, AND THIS IS NOT IT.
//
// `crm_records` holds tenant-invented objects only, so addressed with a
// built-in key — `/crm/records/contact/new` — this pane drew a working "New
// customer" form with an "Add customer" button on it. Pressing it would have
// written a customer that never appears on the Customers screen, can never be
// sold to and can never be found. The fact that stops it was already on the
// record the pane had fetched: `kind: 'builtin'`.
// [[feedback_fetched_but_never_rendered]]
function BuiltinRecord(props: {
  labelPlural: string;
  target: string | undefined;
  onOpen: (target: string) => void;
}) {
  const { labelPlural, target } = props;
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
                      props.onOpen(target);
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

function RecordBody(props: {
  editor: Editor;
  fields: PropertyField[];
  typeLabel: string | undefined;
  typeLoaded: boolean;
  label: string;
  objectKey: string;
  id: string;
  ctx: SurfaceContext;
}) {
  const { editor, fields } = props;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={COLUMN}>
        {fields.length === 0 && props.typeLoaded ? (
          <Alert color="info">
            <AlertContent>
              <AlertTitle>This kind of thing has no details on it yet</AlertTitle>
              <AlertDescription>
                Add some fields to &ldquo;{props.typeLabel}&rdquo; under things you track, and they
                will appear here.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : null}
        {fields.length > 0 ? (
          <FormSection
            title={props.label}
            description="Everything this business chose to track on these records."
          >
            <PropertyFields fields={fields} values={editor.draft} onChange={editor.setDraft} />
          </FormSection>
        ) : null}
        {!editor.isNew ? (
          <>
            <Heading level={2} className="sr-only">
              Who else is involved
            </Heading>
            <AssociationsPanel objectKey={props.objectKey} recordId={props.id} ctx={props.ctx} />
          </>
        ) : null}
      </div>
    </div>
  );
}

/** What the pane shows INSTEAD of a form, or null when the form is right. */
function refusal(
  ctx: SurfaceContext,
  objectKey: string,
  type: ReturnType<typeof useObjectType>,
  editor: Editor,
  label: string
): ReactNode {
  const { record } = editor;
  if (type.data?.kind === 'builtin') {
    return (
      <BuiltinRecord
        labelPlural={type.data.labelPlural}
        target={BUILTIN_SCREEN[objectKey]}
        onOpen={(target) => {
          ctx.open(target, {}, { target: 'replace' });
        }}
      />
    );
  }
  // The type itself is not there: a form to add a record of it would only fail
  // on Save (sparx persona issue 240).
  if (type.isError) {
    return <RecordTypeMissing error={type.error} onRetry={() => void type.refetch()} />;
  }
  // A record that is not there (removed, or another business's id) says so,
  // rather than drawing its form under Remove and Save with the server's own
  // words above it (persona issue 226).
  if (!editor.isNew && record.isError) {
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          error={record.error}
          noun={label.toLowerCase()}
          title={`Could not load this ${label.toLowerCase()}`}
          description={`This is a problem reaching the server. The ${label.toLowerCase()} itself is unaffected. Try again in a moment.`}
          onRetry={() => void record.refetch()}
        />
      </div>
    );
  }
  return null;
}

export function RecordDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const objectKey = String(ctx.params.objectKey ?? '');
  const id = String(ctx.params.id ?? 'new');
  const type = useObjectType(objectKey);
  const label = type.data?.label ?? 'Record';
  const editor = useRecordEditor(ctx, objectKey, id, label);
  const { record } = editor;
  const title = record.data ? recordTitle(record.data, type.data?.primaryFieldKey ?? null) : '';

  useEffect(() => {
    ctx.setTitle(editor.isNew ? `New ${label.toLowerCase()}` : title || label);
  }, [ctx, editor.isNew, label, title]);

  const refused = refusal(ctx, objectKey, type, editor, label);
  if (refused) return refused;

  return (
    <div className={PANE_SHELL}>
      <RecordToolbar
        editor={editor}
        label={label}
        title={title}
        refreshing={record.isFetching || type.isFetching}
        onRefresh={() => {
          void record.refetch();
          void type.refetch();
        }}
      />
      <RecordBody
        editor={editor}
        fields={type.data?.propertySchema?.fields ?? []}
        typeLabel={type.data?.label}
        typeLoaded={type.isSuccess}
        label={label}
        objectKey={objectKey}
        id={id}
        ctx={ctx}
      />
    </div>
  );
}
