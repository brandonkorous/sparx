'use client';

// Form settings — the panel that was missing.
//
// A form answers three questions that are not the visitor's: what is it called,
// who hears about a message, and what does the sender get back. All three have
// been stored, validated and honoured by the submit path since silica forms
// shipped; none of them had a screen (issue 355).
//
// NOTHING HERE COMES FROM silicaui, despite the type names. silicaui contributes
// two things to a form: a real `<form>` with its `form` behavior, and the action
// ref that behavior hands its host on submit. That is a design system stopping at
// the seam, correctly — it does not know what an enquiry is. The config type is
// `@wizeworks/builder-schemas`, the addresses are a `FormDefinition` column, and
// the sending is the automation engine's `form.notify` / `form.autoreply`.
//
// Addresses are server-side and stay there: they never enter the published tree,
// so the submit endpoint reads them and no address can originate from a visitor.
//
// Explicit-save only, like every editor here: one Save, last write wins, and an
// unsaved edit registers the leave-guard.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Text, useToast } from '@wizeworks/silicaui-react';

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { useDirtySource } from '../../lib/workbench/dirty';
import { apiErrorMessage } from '../../lib/api-error';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  firstInvalidRecipient,
  parseRecipients,
  useFormDefinition,
  useSaveFormDefinition,
  type FormConfig,
  type FormDefinition,
} from './form-settings-data';
import { SETTINGS_COLUMN } from './form-settings-column';
import { CustomersCard, NameCard, NotifyCard, ReplyCard } from './form-settings-fields';

interface Draft {
  config: FormConfig;
  /** Free text, one address per line — the shape a person types, parsed on save. */
  recipientsText: string;
}

function toDraft(definition: FormDefinition): Draft {
  return { config: { ...definition.config }, recipientsText: definition.recipients.join('\n') };
}

function serialize(draft: Draft): string {
  return JSON.stringify({
    config: draft.config,
    recipients: parseRecipients(draft.recipientsText),
  });
}

export function FormSettingsSurface({ ctx }: { ctx: SurfaceContext }) {
  const formNodeId = typeof ctx.params.formNodeId === 'string' ? ctx.params.formNodeId : '';
  // Opened without one — a stale saved layout, or a hand-typed address. Send her
  // to the list rather than to a blank pane.
  if (formNodeId === '') return <NoFormNamed ctx={ctx} />;
  return <EditForm ctx={ctx} formNodeId={formNodeId} />;
}

function NoFormNamed({ ctx }: { ctx: SurfaceContext }) {
  useEffect(() => {
    ctx.setTitle('Form settings');
  }, [ctx]);
  return (
    <div className={`${PANE_SHELL} p-2`}>
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneLoadError
          reason="missing"
          title="No form chosen"
          description="Open Form settings from the list to pick which form you mean."
          onRetry={() => {
            ctx.open('builder.form-settings');
          }}
        />
      </Card>
    </div>
  );
}

/** The draft, its dirty flag, and the title the pane tab wears. */
function useFormDraft(ctx: SurfaceContext, data: FormDefinition | undefined) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const initialRef = useRef<string>('');
  const initializedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!data || initializedFor.current === data.formNodeId) return;
    initializedFor.current = data.formNodeId;
    const next = toDraft(data);
    setDraft(next);
    initialRef.current = serialize(next);
  }, [data]);

  const dirty = draft !== null && serialize(draft) !== initialRef.current;
  useDirtySource(dirty, 'You have unsaved changes to this form. Close anyway?');

  const title = useMemo(() => {
    const named = draft?.config.name.trim() ?? '';
    if (named !== '') return named;
    const slug = data?.pageSlug?.trim() ?? '';
    return slug !== '' ? `/${slug}` : 'Form settings';
  }, [draft?.config.name, data?.pageSlug]);

  useEffect(() => {
    ctx.setTitle(title);
  }, [ctx, title]);

  // `title` is not returned: the hook already puts it on the pane tab, and the
  // toolbar carries a fixed label rather than repeating it.
  return { draft, setDraft, dirty, initialRef };
}

function EditForm({ ctx, formNodeId }: { ctx: SurfaceContext; formNodeId: string }) {
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } =
    useFormDefinition(formNodeId);
  const save = useSaveFormDefinition(formNodeId);
  const toast = useToast();
  const { draft, setDraft, dirty, initialRef } = useFormDraft(ctx, data);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            title="Could not load these settings"
            description="This is a problem reaching the server. The form on your site is unaffected and is still taking messages."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isLoading || !data || !draft) return <PaneWaiting />;

  const recipients = parseRecipients(draft.recipientsText);
  const badAddress = firstInvalidRecipient(recipients);

  const change = (patch: Partial<FormConfig>) => {
    setDraft((current) =>
      current ? { ...current, config: { ...current.config, ...patch } } : current
    );
  };

  const onSave = () => {
    save.mutate(
      { pageSlug: data.pageSlug, recipients, config: draft.config },
      {
        onSuccess: (saved) => {
          const next = toDraft(saved);
          setDraft(next);
          initialRef.current = serialize(next);
          toast.add({ title: 'Saved', type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not save',
            description: apiErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Form settings controls"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            disabled={!dirty || badAddress !== null}
            loading={save.isPending}
            onClick={onSave}
          >
            Save
          </Button>
        }
        refresh={
          <RefreshButton isFetching={isFetching} updatedAt={dataUpdatedAt} onRefresh={refetch} />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={SETTINGS_COLUMN}>
          <NameCard config={draft.config} pageSlug={data.pageSlug} onChange={change} />
          <NotifyCard
            config={draft.config}
            recipientsText={draft.recipientsText}
            badAddress={badAddress}
            onChange={change}
            onRecipientsChange={(text) => {
              setDraft((current) => (current ? { ...current, recipientsText: text } : current));
            }}
          />
          <ReplyCard config={draft.config} onChange={change} />
          <CustomersCard config={draft.config} onChange={change} />

          <Text className="text-sm">
            Addresses here are never part of your published page. They are stored with your site
            settings, so nobody visiting can see who a message goes to.
          </Text>
        </div>
      </div>
    </div>
  );
}
