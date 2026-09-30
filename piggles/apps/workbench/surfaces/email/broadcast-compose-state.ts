'use client';

// The composer's state, and everything worked out from it.
//
// Split out of `BroadcastComposer` so the pane is only layout: the draft and its
// dirty tracking live in `useComposerDraft`, what the send still needs lives in
// `useComposerReadiness`, and `useBroadcastComposer` joins them into the two prop
// bags the toolbar and the field groups take. Behavior is unchanged by the move.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  useAudiences,
  useDesignedEmails,
  useEmailSettings,
  useRecipientEstimate,
  type Broadcast,
  type DesignedEmail,
  type EmailSettings,
} from './broadcasts-data';
import { senderDisplay } from './broadcasts-presentation';
import type { ComposeToolbarProps } from './broadcast-compose-toolbar';
import { useBroadcastCommit } from './broadcast-compose-writes';
import {
  draftFrom,
  missingPieces,
  serialize,
  type ComposeBodyProps,
  type Draft,
} from './broadcast-draft';

/** The draft, its saved baseline, and the unsaved-work guard. */
function useComposerDraft(ctx: SurfaceContext, broadcast: Broadcast | undefined) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(broadcast));
  const [baseline, setBaseline] = useState<string>(() => serialize(draftFrom(broadcast)));
  // The id becomes real after the first save of a new broadcast — tracked so a
  // retry after a failed send patches the created draft rather than making a
  // second one.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const committing = useRef(false);

  useEffect(() => {
    ctx.setTitle(broadcast ? broadcast.name : 'New broadcast');
  }, [ctx, broadcast]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const dirty = serialize(draft) !== baseline;
  useDirtySource(
    dirty && !committing.current,
    'This broadcast has changes you haven’t saved. Close it anyway?'
  );

  const currentId = broadcast?.id ?? createdId;
  return { draft, set, dirty, committing, currentId, setCreatedId, setBaseline };
}

/** What still stands between this draft and Send. */
function useComposerReadiness(
  draft: Draft,
  designed: DesignedEmail[] | undefined,
  settings: EmailSettings | undefined,
  recipientCount: number | undefined
) {
  const chosenEmail = useMemo(
    () => designed?.find((email) => email.id === draft.builderEmailId),
    [designed, draft.builderEmailId]
  );
  const emailUnpublished = chosenEmail != null && !chosenEmail.published;
  // A draft saved before the picker filtered them can still hold a ready-made one.
  const emailBuiltIn = chosenEmail != null && chosenEmail.key !== null;

  // `settings` is undefined while it loads, which the check reads as "not known
  // yet" rather than as blank.
  const missing = missingPieces({
    ...draft,
    emailUnpublished,
    emailBuiltIn,
    recipientCount,
    mailingAddress: settings?.physicalAddress,
  });
  const ready = missing.length === 0 && recipientCount !== undefined && recipientCount > 0;
  // Enough to keep as a draft: the two things the server insists a broadcast has.
  const canSave = draft.name.trim() !== '' && draft.subject.trim() !== '';
  return { emailUnpublished, emailBuiltIn, missing, ready, canSave };
}

/** The reference lists the pickers offer, and the toolbar's refresh over them. */
function useComposerLists() {
  const audiences = useAudiences();
  const designed = useDesignedEmails();
  const settings = useEmailSettings();
  const lists: ComposeToolbarProps['lists'] = {
    isFetching: audiences.isFetching || designed.isFetching || settings.isFetching,
    updatedAt: audiences.data ? audiences.dataUpdatedAt : undefined,
    refresh: () => {
      void audiences.refetch();
      void designed.refetch();
      void settings.refetch();
    },
  };
  return { audiences, designed, settings, lists };
}

/** Send now, or at a chosen time in the future. */
function useComposerSchedule() {
  const [timing, setTiming] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const scheduleValid =
    timing === 'now' || (scheduledAt !== '' && new Date(scheduledAt) > new Date());
  return { timing, setTiming, scheduledAt, setScheduledAt, scheduleValid };
}

type Lists = ReturnType<typeof useComposerLists>;

/** The field groups' props, from the pieces the hooks above produce. */
function toBodyProps(
  ctx: SurfaceContext,
  state: ReturnType<typeof useComposerDraft>,
  { audiences, designed, settings }: Lists,
  readiness: ReturnType<typeof useComposerReadiness>,
  schedule: ReturnType<typeof useComposerSchedule>,
  estimate: { recipientCount: number | undefined; estimatePending: boolean }
): ComposeBodyProps {
  return {
    ctx,
    draft: state.draft,
    set: state.set,
    audiences: {
      items: audiences.data ?? [],
      isError: audiences.isError,
      isSuccess: audiences.isSuccess,
    },
    designed: {
      items: designed.data ?? [],
      isError: designed.isError,
      isSuccess: designed.isSuccess,
    },
    settings: settings.data,
    settingsPending: settings.isPending,
    ...estimate,
    emailUnpublished: readiness.emailUnpublished,
    emailBuiltIn: readiness.emailBuiltIn,
    missing: readiness.missing,
    ...schedule,
    savedId: state.currentId,
    dirty: state.dirty,
  };
}

/** Everything the composer pane renders, as the toolbar's and the body's props. */
export function useBroadcastComposer(ctx: SurfaceContext, broadcast: Broadcast | undefined) {
  const lists = useComposerLists();
  const state = useComposerDraft(ctx, broadcast);
  const schedule = useComposerSchedule();
  const estimate = useRecipientEstimate(state.draft.segmentId);
  const recipientCount = state.draft.segmentId ? estimate.data?.count : undefined;
  const readiness = useComposerReadiness(
    state.draft,
    lists.designed.data,
    lists.settings.data,
    recipientCount
  );

  const commit = useBroadcastCommit({
    ctx,
    draft: state.draft,
    currentId: state.currentId,
    onCreated: state.setCreatedId,
    onBaseline: state.setBaseline,
    committing: state.committing,
    senderLine: senderDisplay(lists.settings.data),
    recipientCount,
    scheduledAt: schedule.scheduledAt,
  });

  const toolbar: ComposeToolbarProps = {
    commit,
    lists: lists.lists,
    recipientCount,
    canSave: readiness.canSave,
    ready: readiness.ready,
    dirty: state.dirty,
    saved: state.currentId !== null,
    timing: schedule.timing,
    scheduleValid: schedule.scheduleValid,
  };
  const body = toBodyProps(ctx, state, lists, readiness, schedule, {
    recipientCount,
    estimatePending: estimate.isPending,
  });
  return { toolbar, body, serverError: commit.serverError };
}
