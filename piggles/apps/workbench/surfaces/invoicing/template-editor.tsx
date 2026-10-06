'use client';

// One print template — the page a customer sees when they open a bill.
//
// Create and edit are the same surface (`{id:'new'}` → `{id}`), per the app's
// pane rule, and saving a new one retargets this pane rather than opening a
// second tab.
//
// Explicit save, last-write-wins, one button — the platform rule for every
// editor here. Unlike the workflow editor next door, a template IS versioned:
// Save writes the draft, and PUBLISH is the separate act that puts it in front
// of customers. Those are genuinely two decisions ("is this right yet" and "send
// it"), and collapsing them would mean every keystroke reached the next invoice
// somebody opened.
//
// The preview is a PANE, not a panel welded to half this one — the same
// arrangement the invoice preview uses, and for the same reason: you want it on
// a second monitor, or beside, or not at all.

import { useEffect, useRef, useState } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';
import { useMutation } from '@wizeworks/query';
import {
  Alert,
  Badge,
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import {
  faCircleCheck,
  faEye,
  faFloppyDisk,
  faTrash,
  faUpload,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { SaveFailure } from '../../components/save-failure';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useActivePropertyId } from '../../lib/api/shell-data';
import { useSites } from '../sites/data';
import { TemplateBlockList } from './template-block-list';
import { templateStanding } from './template-standing';
import {
  comparableDraft,
  emptyTemplateDraft,
  saveTemplate,
  templateErrorMessage,
  toTemplateDraft,
  useDeleteTemplate,
  useInvalidateTemplates,
  useMakeDefaultTemplate,
  usePublishTemplate,
  useTemplate,
  type BillingTemplate,
  type TemplateDraft,
} from './template-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/** The one value that is not an id: "every business". A word rather than an
 *  empty string, because the Select stores it and '' is what an unset control
 *  holds — the two would be indistinguishable. */
const EVERY_BUSINESS = 'every';

export function TemplateEditorSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';

  const {
    data: template,
    isPending,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useTemplate(id);
  const { data: sites } = useSites();
  const manySites = (sites ?? []).length > 1;
  const activeSiteId = useActivePropertyId();

  const invalidate = useInvalidateTemplates();
  const publish = usePublishTemplate();
  const makeDefault = useMakeDefaultTemplate();
  const remove = useDeleteTemplate();
  const toast = useToast();
  const confirm = useConfirm();

  const [draft, setDraft] = useState<TemplateDraft>(emptyTemplateDraft);
  // What was last adopted from the server. Dirty is the comparison against it
  // rather than a sticky "somebody typed" flag, so undoing an edit genuinely
  // un-dirties the pane (issue 507).
  //
  // THROUGH `comparableDraft`, both here and everywhere else. Seeding it with a
  // plain JSON.stringify instead put a DIFFERENT SHAPE in the ref — one carrying
  // the session keys that `comparableDraft` strips — so the very first comparison
  // differed and the pane was dirty before anyone touched it. The visible damage
  // was not the badge: the adopt effect is guarded on `dirty`, so a pane that
  // starts dirty never adopts, and opening a saved template showed a blank
  // editor with the standard layout in it.
  const baselineRef = useRef<string>(comparableDraft(emptyTemplateDraft()));
  const [original, setOriginal] = useState<BillingTemplate | null>(null);

  const dirty = comparableDraft(draft) !== baselineRef.current;
  useDirtySource(dirty, 'This template has unsaved changes. Close it anyway?');

  const adopt = (next: BillingTemplate) => {
    const adopted = toTemplateDraft(next);
    setDraft(adopted);
    baselineRef.current = comparableDraft(adopted);
    setOriginal(next);
    ctx.setTitle(next.name);
  };

  // Guarded on `dirty` so a background refetch can never overwrite what someone
  // is part-way through typing.
  useEffect(() => {
    if (!template || dirty) return;
    adopt(template);
    // ctx is stable per pane, and adopt is recreated each render by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  // A NEW template belongs to the business being worked in, and the list of
  // businesses arrives after the pane does — so the starting draft is settled
  // once, when it lands. The BASELINE moves with it, or a pane nobody has typed
  // in would count as unsaved work and confirm on close.
  const startedNew = useRef(false);
  useEffect(() => {
    if (!isNew || startedNew.current || !manySites || !activeSiteId) return;
    startedNew.current = true;
    const started = emptyTemplateDraft(activeSiteId);
    setDraft(started);
    baselineRef.current = comparableDraft(started);
  }, [isNew, manySites, activeSiteId]);

  useEffect(() => {
    ctx.setTitle(draft.name.trim() || (isNew ? 'New template' : 'Template'));
  }, [ctx, draft.name, isNew]);

  const update = (patch: Partial<TemplateDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const save = useMutation({
    mutationFn: () => saveTemplate({ id, draft, original }),
    onSuccess: (saved) => {
      adopt(saved);
      invalidate();
      toast.add({ title: isNew ? 'Template created' : 'Template saved', type: 'success' });
      if (isNew) ctx.open('invoicing.template.edit', { id: saved.id }, { target: 'replace' });
    },
  });

  const standing = original
    ? templateStanding({
        isDefault: original.isDefault,
        published: original.published,
        propertyName: original.propertyName,
      })
    : null;

  // Publish puts the STORED layout in front of customers, so edits still on
  // screen are saved first. Pressed without that, it sent the old layout live
  // under a "Published" toast (persona issue 033).
  const onPublish = () => {
    if (!original) return;
    if (dirty) {
      save.mutate(undefined, { onSuccess: publishStored });
      return;
    }
    publishStored();
  };

  const publishStored = () => {
    if (!original) return;
    publish.mutate(original.id, {
      onSuccess: (next) => {
        setOriginal(next);
        toast.add({
          title: next.isDefault ? 'Your customers now get this one' : 'Published',
          description: next.isDefault
            ? undefined
            : 'It is ready. Press "Use this one" to start sending it.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not publish this template',
          description: templateErrorMessage(error, 'Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };

  const onUseThisOne = () => {
    if (!original) return;
    makeDefault.mutate(original.id, {
      onSuccess: (next) => {
        setOriginal(next);
        toast.add({
          title: next.published
            ? 'Your customers now get this one'
            : 'Chosen, but not turned on yet',
          description: next.published ? undefined : 'Press Publish to start sending it.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not switch to this template',
          description: templateErrorMessage(error, 'Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };

  const onDelete = async () => {
    if (!original) return;
    const ok = await confirm({
      title: `Delete “${original.name}”?`,
      description:
        'The layout is gone for good. Bills you have already sent are untouched: a printed copy is drawn fresh each time, so they will use whichever template is in use then.',
      color: 'danger',
      confirmLabel: 'Delete template',
      cancelLabel: 'Keep it',
    });
    if (!ok) return;
    remove.mutate(original.id, {
      onSuccess: () => {
        toast.add({ title: 'Template deleted', type: 'success' });
        ctx.close();
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete this template',
          description: templateErrorMessage(error, 'Nothing was changed. Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };

  const failure = save.error
    ? templateErrorMessage(
        save.error,
        'This template could not be saved. It may be a temporary problem. Try again in a moment.'
      )
    : null;

  if (isError) {
    // Gone (a 404) and unreachable say different things; the shared screen reads
    // which from the error instead of one sentence hedging both (persona issue 226).
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          error={error}
          noun="template"
          title="Could not load this template"
          description="This is a problem reaching the server. The template itself is unaffected. Try again in a moment."
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  if (isPending && !isNew) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Template actions"
        status={
          standing ? (
            <Badge
              {...(standing.tone ? { color: standing.tone } : {})}
              variant="soft"
              size="sm"
              title={standing.sentence}
            >
              {standing.label}
            </Badge>
          ) : null
        }
        primary={
          <Button
            color="module"
            size="sm"
            className={original ? 'shrink-0' : 'ml-auto shrink-0'}
            disabled={!dirty || save.isPending || draft.name.trim() === ''}
            loading={save.isPending}
            onClick={() => {
              save.mutate();
            }}
          >
            <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
            {isNew ? 'Create template' : 'Save'}
          </Button>
        }
        actions={
          original
            ? [
                {
                  label: 'Preview',
                  title: 'See this template drawn as a real page',
                  icon: faEye,
                  onClick: (event) => {
                    ctx.open(
                      'invoicing.template.preview',
                      { id: original.id },
                      { target: event.altKey ? 'window' : 'beside' }
                    );
                  },
                },
                {
                  label: 'Publish',
                  title: 'Put this version in front of customers',
                  icon: faUpload,
                  onClick: onPublish,
                },
                ...(original.isDefault
                  ? []
                  : [
                      {
                        label: 'Use this one',
                        title: 'Make this the template customers get',
                        icon: faCircleCheck,
                        onClick: onUseThisOne,
                      },
                    ]),
                {
                  label: 'Delete',
                  title: 'Delete this template',
                  icon: faTrash,
                  onClick: () => {
                    void onDelete();
                  },
                },
              ]
            : undefined
        }
        refresh={
          !isNew ? (
            <RefreshButton
              isFetching={isFetching}
              updatedAt={template ? dataUpdatedAt : undefined}
              onRefresh={() => {
                void refetch();
              }}
            />
          ) : undefined
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {isNew ? (
            <Text>
              A template is the page your customer sees when they open a bill: what goes on it, and
              in what order. This one starts as a copy of the standard layout, so you can change the
              parts you care about and leave the rest.
            </Text>
          ) : null}

          <SaveFailure title="Could not save this template" message={failure} />

          {/* The whole answer to "so what do my customers get", in a sentence,
              where the person is deciding. The badge in the toolbar is the same
              fact at a glance; this is the one that says what to do about it. */}
          {standing && !standing.inForce ? (
            <Alert color={standing.tone === 'warning' ? 'warning' : 'info'} variant="soft">
              {standing.sentence}
            </Alert>
          ) : null}

          <FormSection title="What to call it">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                color="module"
                value={draft.name}
                placeholder="Our letterhead"
                onChange={(event) => {
                  update({ name: event.target.value });
                }}
              />
              <FieldDescription>
                Only you see this. Customers see the page, never its name.
              </FieldDescription>
            </Field>

            {/* One business or every one — a single choice, so this is NOT the
                SiteScopeField used for things that apply to a SET of sites. A
                letterhead carries one business's name by definition. Hidden
                entirely on an account with one business: there is no decision. */}
            {manySites ? (
              <Field>
                <FieldLabel>Which business is this for?</FieldLabel>
                <Select
                  color="module"
                  value={draft.propertyId ?? EVERY_BUSINESS}
                  onValueChange={(next) => {
                    const picked = (next as string | null) ?? EVERY_BUSINESS;
                    update({ propertyId: picked === EVERY_BUSINESS ? null : picked });
                  }}
                  items={[
                    { value: EVERY_BUSINESS, label: 'Every business' },
                    ...(sites ?? []).map((site) => ({ value: site.id, label: site.name })),
                  ]}
                />
                <FieldDescription>
                  A bill prints on its own business&rsquo;s template. Pick one here and only that
                  business uses it; leave it on every business and anything without its own will use
                  this.
                </FieldDescription>
              </Field>
            ) : null}
          </FormSection>

          <FormSection
            title="What goes on the page"
            description="Each of these prints one part of the bill."
          >
            <TemplateBlockList
              blocks={draft.blocks}
              onChange={(blocks) => {
                update({ blocks });
              }}
            />
          </FormSection>

          {isNew ? (
            <Text className="text-sm">
              Create it first, then you can see it drawn as a real page and publish it.
            </Text>
          ) : null}
        </div>
      </div>
    </div>
  );
}
