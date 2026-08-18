'use client';

// "Who else is involved" — the relationship panel (docs/144 §6).
//
// One panel, dropped onto every CRM detail pane. It answers the question a
// single customer column cannot: a deal is sold to the person who signs it, the
// person who will use it and the person in accounts who pays, and until now only
// one of those three could be written down.
//
// THE NAME IS THE POINT. Not "Associations" — a word from a CRM vendor's manual
// that means nothing to a business owner. "Who else is involved" is the question
// someone actually asks about a deal, and each group is headed by what the
// relationship is CALLED ("Signs it off"), which is what makes the panel
// readable at a glance instead of a list of names with no explanation.
//
// It writes IMMEDIATELY rather than riding the pane's Save draft. A relationship
// is its own record, not a field of this one — the same call the addresses
// section makes, for the same reason: relating two records that both already
// exist has nothing to do with whether the form above has been saved.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  useToast,
} from '@wizeworks/silicaui-react';
import { faLink, faPencil, faPlus, faStar, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useConfirm } from '../../lib/confirm';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  associationErrorMessage,
  groupByLabel,
  objectLabel,
  useAssociationLabels,
  useAssociations,
  useMakeAssociationPrimary,
  useUpdateAssociation,
  useRelateRecords,
  useUnrelateRecords,
  type Association,
  type AssociationLabel,
} from './associations-data';
import { RecordPicker } from './record-picker';

/** Which surface opens a record of a given kind, so a chip is clickable. */
const DETAIL_SURFACE: Record<string, string> = {
  contact: 'crm.customer.detail',
  company: 'crm.account.detail',
  deal: 'crm.deal.detail',
};

export interface AssociationsPanelProps {
  /** contact | company | deal | ticket, or a custom object key. */
  objectKey: string;
  /** The record being viewed. `new` renders nothing — see below. */
  recordId: string;
  ctx: SurfaceContext;
  title?: string;
}

export function AssociationsPanel({
  objectKey,
  recordId,
  ctx,
  title = 'Who else is involved',
}: AssociationsPanelProps) {
  const toast = useToast();
  const confirm = useConfirm();
  /** null = closed · 'new' = adding one · an Association = changing that one. */
  const [dialog, setDialog] = useState<'new' | Association | null>(null);

  const { data, isPending } = useAssociations(objectKey, recordId);
  const { data: labelData } = useAssociationLabels();
  const makePrimary = useMakeAssociationPrimary();
  const unrelate = useUnrelateRecords();

  // Both derived inside the memo: `data?.items ?? []` mints a new array on every
  // render, which would make the memo's dependency change every time and defeat
  // it entirely.
  const items = useMemo(() => data?.items ?? [], [data]);
  const groups = useMemo(() => groupByLabel(items), [items]);

  // A record that does not exist yet cannot be related to anything. Rendering an
  // empty panel on the create form would be offering an action that cannot work.
  if (recordId === '' || recordId === 'new') return null;

  const open = (targetKey: string, targetId: string, shiftKey: boolean) => {
    const surface = DETAIL_SURFACE[targetKey];
    // A custom object has no detail surface of its own until Phase 7, so its
    // chip stays a plain, honest label rather than a link that goes nowhere.
    if (!surface) return;
    ctx.open(surface, { id: targetId }, { target: shiftKey ? 'beside' : 'tab' });
  };

  const onUnrelate = async (item: Association) => {
    const who = item.other?.title ?? 'this record';
    const ok = await confirm({
      title: `Unlink ${who}?`,
      description: item.isPrimary
        ? `${who} is the main one of its kind here. Unlinking takes them off this record everywhere it is used — neither record is deleted.`
        : `They stay in your ${objectLabel(item.other?.objectKey ?? 'contact').toLowerCase()}; only the link between the two goes.`,
      confirmLabel: 'Unlink them',
      cancelLabel: 'Keep the link',
      color: 'danger',
    });
    if (!ok) return;
    try {
      await unrelate.mutateAsync(item.id);
      toast.add({ title: 'Unlinked', type: 'success' });
    } catch (error) {
      toast.add({
        title: 'Could not unlink that',
        description: associationErrorMessage(error, 'Something went wrong reaching the server.'),
        type: 'error',
      });
    }
  };

  const onMakePrimary = async (item: Association) => {
    try {
      await makePrimary.mutateAsync(item.id);
      toast.add({
        title: `${item.other?.title ?? 'That record'} is now the main one`,
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Could not change that',
        description: associationErrorMessage(error, 'Something went wrong reaching the server.'),
        type: 'error',
      });
    }
  };

  return (
    <FormSection
      title={title}
      description="Everyone and everything connected to this, and how. Adding or removing a link here saves straight away."
    >
      {isPending ? (
        <PaneWaiting />
      ) : groups.length === 0 ? (
        <p className="py-2 text-sm">
          Nothing else is linked to this yet. Add the other people involved — who signs it off, who
          will use it, who handles the invoice — and they show up here and on their own records.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              {/* The relationship, as the heading. This is what makes the panel
                  readable — a list of names with no explanation is a list, not
                  an answer. */}
              <h4 className="text-sm font-medium">{group.label}</h4>
              <ul className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <AssociationRow
                    key={item.id}
                    item={item}
                    busy={makePrimary.isPending || unrelate.isPending}
                    onOpen={(shiftKey) => {
                      if (item.other) open(item.other.objectKey, item.other.recordId, shiftKey);
                    }}
                    onEdit={() => {
                      setDialog(item);
                    }}
                    onMakePrimary={() => void onMakePrimary(item)}
                    onUnrelate={() => void onUnrelate(item)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Button
        size="sm"
        color="module"
        variant="outline"
        className="self-start"
        onClick={() => {
          setDialog('new');
        }}
      >
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Link someone else
      </Button>

      {dialog ? (
        <RelateDialog
          // Keyed so switching straight from one row's pencil to another's
          // remounts the form rather than keeping the first link's note.
          key={dialog === 'new' ? 'new' : dialog.id}
          objectKey={objectKey}
          recordId={recordId}
          labels={labelData?.items ?? []}
          editing={dialog === 'new' ? null : dialog}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}
    </FormSection>
  );
}

/* ── One link ───────────────────────────────────────────────────────────── */

function AssociationRow({
  item,
  busy,
  onOpen,
  onEdit,
  onMakePrimary,
  onUnrelate,
}: {
  item: Association;
  busy: boolean;
  onOpen: (shiftKey: boolean) => void;
  onEdit: () => void;
  onMakePrimary: () => void;
  onUnrelate: () => void;
}) {
  const other = item.other;

  return (
    <li className="border-base-300 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={(event) => {
          onOpen(event.shiftKey);
        }}
      >
        <span className={other?.removed ? 'line-through' : 'font-medium'}>
          {other?.title ?? 'A record that no longer exists'}
        </span>
        {other?.subtitle ? <span className="ml-2 text-sm">{other.subtitle}</span> : null}
        {/* The note about the connection. The form has always asked for this and
            the row never showed it, so every one written was stored where nobody
            could read it — which is worse than not asking. */}
        {item.note ? <span className="mt-0.5 block text-sm">{item.note}</span> : null}
      </button>

      {/* Which kind of thing this is. A real color rather than grey, because on
          a mixed panel it is the fastest way to tell a person from a company. */}
      {other ? (
        <Badge color={toneFor(other.objectKey)} variant="soft" size="sm">
          {objectLabel(other.objectKey).replace(/s$/, '')}
        </Badge>
      ) : null}

      {item.isPrimary ? (
        <Badge color="module" variant="soft" size="sm">
          Main
        </Badge>
      ) : null}

      <Button
        size="sm"
        color="module"
        variant="ghost"
        disabled={busy}
        title="Change what this connection is called, or the note about it"
        aria-label={`Change how ${other?.title ?? 'this record'} is connected`}
        onClick={onEdit}
      >
        <Icon glyph={faPencil} className="size-4" aria-hidden />
      </Button>

      {item.isPrimary ? null : (
        <Button
          size="sm"
          color="neutral"
          variant="ghost"
          disabled={busy}
          title="Make this the main one — it is what shows on lists, invoices and reports"
          aria-label={`Make ${other?.title ?? 'this'} the main one`}
          onClick={onMakePrimary}
        >
          <Icon glyph={faStar} className="size-4" aria-hidden />
        </Button>
      )}
      <Button
        size="sm"
        color="danger"
        variant="ghost"
        disabled={busy}
        aria-label={`Unlink ${other?.title ?? 'this record'}`}
        onClick={onUnrelate}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
      </Button>
    </li>
  );
}

/** The hue that says WHICH KIND of record a chip is, at a glance. Module colors
 *  rather than invented ones, so a company chip here matches a company anywhere
 *  else in the platform. */
function toneFor(objectKey: string): string {
  switch (objectKey) {
    case 'contact':
      return 'module-crm';
    case 'company':
      return 'module-b2b';
    case 'deal':
      return 'module-crm';
    case 'ticket':
      return 'warning';
    default:
      return 'info';
  }
}

/* ── Adding one ─────────────────────────────────────────────────────────── */

/**
 * One dialog for adding a link and for changing one.
 *
 * They are the same two fields — what the connection is called, and the note
 * about it — so a second dialog would be the same form twice. WHICH record is
 * linked is fixed once made: changing that is not editing a link, it is a
 * different link, and unlinking says so honestly.
 *
 * EDITING EXISTED IN THE API AND NOWHERE ELSE. `PATCH /v1/crm/associations/:id`
 * has always accepted both fields and no screen ever called it, so a role that
 * changed — the single most ordinary thing that happens to a business
 * relationship — could only be recorded by deleting the link and making a new
 * one, which threw away when it was first made.
 */
function RelateDialog({
  objectKey,
  recordId,
  labels,
  editing,
  onClose,
}: {
  objectKey: string;
  recordId: string;
  labels: AssociationLabel[];
  /** The link being changed, or null when making a new one. */
  editing: Association | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const relate = useRelateRecords();
  const update = useUpdateAssociation();

  // What this kind of record can be related TO, from the labels the business
  // actually has. Deriving it from the labels rather than hardcoding it means a
  // tenant who invents a relationship gets its target kind offered for free.
  const targetTypes = useMemo(() => {
    const kinds = new Set<string>();
    for (const label of labels) {
      if (label.fromType === objectKey) kinds.add(label.toType);
    }
    // Always offer people, even before any label mentions them — linking a
    // person is the overwhelmingly common case and must not depend on setup.
    kinds.add('contact');
    return [...kinds];
  }, [labels, objectKey]);

  // On an edit the kind is already decided by the record on the other end, so
  // the label list is filtered against THAT rather than a picker nobody sees.
  const [toType, setToType] = useState(editing?.other?.objectKey ?? targetTypes[0] ?? 'contact');
  const [toId, setToId] = useState('');
  const [labelKey, setLabelKey] = useState(editing?.labelKey ?? '');
  const [note, setNote] = useState(editing?.note ?? '');

  const available = labels.filter(
    (label) => label.fromType === objectKey && label.toType === toType
  );

  const busy = relate.isPending || update.isPending;

  const submit = async () => {
    const cleanNote = note.trim() === '' ? null : note.trim();
    const cleanLabel = labelKey === '' ? null : labelKey;

    if (editing) {
      try {
        await update.mutateAsync({ id: editing.id, labelKey: cleanLabel, note: cleanNote });
        toast.add({ title: 'Link updated', type: 'success' });
        onClose();
      } catch (error) {
        toast.add({
          title: 'Could not change that link',
          description: associationErrorMessage(
            error,
            'Something went wrong reaching the server. Nothing has been changed.'
          ),
          type: 'error',
        });
      }
      return;
    }

    if (toId === '') return;
    try {
      await relate.mutateAsync({
        fromType: objectKey,
        fromId: recordId,
        toType,
        toId,
        labelKey: cleanLabel,
        note: cleanNote,
      });
      toast.add({ title: 'Linked', type: 'success' });
      onClose();
    } catch (error) {
      toast.add({
        title: 'Could not link those',
        description: associationErrorMessage(
          error,
          'Something went wrong reaching the server. Nothing has been changed.'
        ),
        type: 'error',
      });
    }
  };

  return (
    // PORTALLED INTO THIS PANE, and it is not only about which window. A dialog
    // that escapes the pane also escapes its `ModuleScope`, where
    // `--color-module` is set — so every `color="module"` control inside it fell
    // back to `--color-primary`, and this form rendered its three fields in
    // Ember red. Three boxes outlined in what reads as the error color, on a
    // form where nothing was wrong. (The window part matters too: from a
    // torn-off pane this dialog would otherwise open in the ORIGINAL window.)
    <PaneScope>
      <Dialog
        open
        onOpenChange={(next: boolean) => {
          if (!next) onClose();
        }}
      >
        <DialogContent>
          <DialogTitle>
            {editing
              ? `Change how ${editing.other?.title ?? 'this'} is connected`
              : 'Link someone else'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'What this connection is called, and anything worth remembering about it. To connect a different record, unlink this one and add another.'
              : 'Connect this to another record and say how they are related. It shows on both.'}
          </DialogDescription>

          <div className="flex flex-col gap-3 py-2">
            {/* Both hidden on an edit: WHICH record is linked is settled, and
                offering to change it here would quietly mean "unlink and relink"
                without saying so. */}
            {!editing && targetTypes.length > 1 ? (
              <Field>
                <FieldLabel>What kind of record</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect
                      color="module"
                      value={toType}
                      onChange={(event) => {
                        setToType(event.target.value);
                        setToId('');
                        setLabelKey('');
                      }}
                    >
                      {targetTypes.map((kind) => (
                        <option key={kind} value={kind}>
                          {objectLabel(kind)}
                        </option>
                      ))}
                    </NativeSelect>
                  }
                />
              </Field>
            ) : null}

            {editing ? null : (
              <Field>
                <FieldLabel>Which one</FieldLabel>
                <RecordPicker
                  objectKey={toType}
                  value={toId === '' ? null : toId}
                  excludeId={objectKey === toType ? recordId : undefined}
                  onSelect={(id) => {
                    setToId(id);
                  }}
                  onClear={() => {
                    setToId('');
                  }}
                />
              </Field>
            )}

            <Field>
              <FieldLabel>How they are related</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect
                    color="module"
                    value={labelKey}
                    onChange={(event) => {
                      setLabelKey(event.target.value);
                    }}
                  >
                    {/* An unlabelled link is a real, valid state — the honest
                        answer when someone connects two records before deciding
                        what the connection means. */}
                    <option value="">Just related — I will say how later</option>
                    {available.map((label) => (
                      <option key={label.id} value={label.key}>
                        {label.label}
                      </option>
                    ))}
                  </NativeSelect>
                }
              />
              <FieldDescription>
                {available.length === 0
                  ? 'You have not set up any relationships between these two kinds of record yet.'
                  : 'What this person or business is to this record.'}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Anything worth remembering</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={note}
                    placeholder="Only reachable through her assistant."
                    onChange={(event) => {
                      setNote(event.target.value);
                    }}
                  />
                }
              />
              <FieldDescription>About the connection, not about either record.</FieldDescription>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose>
              <Button size="sm" color="neutral" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="sm"
              color="module"
              loading={busy}
              disabled={!editing && toId === ''}
              onClick={() => void submit()}
            >
              {editing ? null : <Icon glyph={faLink} className="size-4" aria-hidden />}
              {editing ? 'Save the change' : 'Link them'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
