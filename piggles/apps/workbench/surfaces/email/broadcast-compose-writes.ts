'use client';

// Committing a draft broadcast: save it, send it, or schedule it.
//
// Send and schedule are both confirmed. Sending is the only action in this
// module that cannot be undone — there is no unsend — and it went straight
// through on one press, with the recipient count sitting in a corner of the
// toolbar and the sender named in a card further down the page. The dialog says
// both, in the sentence, at the moment it matters.

import { useRef, useState, type RefObject } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { broadcastErrorMessage } from './broadcasts-presentation';
import {
  useCreateBroadcast,
  useScheduleBroadcast,
  useSendBroadcast,
  useUpdateBroadcast,
} from './broadcasts-mutations';
import { DETAIL_KEY, formatWhen, peopleCount, serialize, type Draft } from './broadcast-draft';

export interface CommitArgs {
  ctx: SurfaceContext;
  draft: Draft;
  /** The saved broadcast's id, or null before the first save. */
  currentId: string | null;
  onCreated: (id: string) => void;
  onBaseline: (serialized: string) => void;
  /** Suppresses the leave-guard while a commit is navigating the pane. */
  committing: RefObject<boolean>;
  /** The `From` line, as a recipient will read it — named in the confirmation. */
  senderLine: string;
  recipientCount: number | undefined;
  scheduledAt: string;
}

export function useBroadcastCommit(args: CommitArgs) {
  const toast = useToast();
  const confirm = useConfirm();
  const create = useCreateBroadcast();
  const update = useUpdateBroadcast();
  const send = useSendBroadcast();
  const schedule = useScheduleBroadcast();
  const [serverError, setServerError] = useState<string | null>(null);
  const latest = useRef(args);
  latest.current = args;

  /** Create the first time, patch thereafter. Returns the persisted id. */
  const persist = async (): Promise<string> => {
    const { draft, currentId, onCreated, onBaseline } = latest.current;
    const name = draft.name.trim();
    const subject = draft.subject.trim();
    if (currentId) {
      await update.mutateAsync({
        id: currentId,
        patch: {
          name,
          subject,
          preheader: draft.preheader.trim() || null,
          segmentId: draft.segmentId || null,
          builderEmailId: draft.builderEmailId || null,
        },
      });
      onBaseline(serialize(draft));
      return currentId;
    }
    const created = await create.mutateAsync({
      name,
      subject,
      ...(draft.preheader.trim() ? { preheader: draft.preheader.trim() } : {}),
      ...(draft.segmentId ? { segmentId: draft.segmentId } : {}),
      ...(draft.builderEmailId ? { builderEmailId: draft.builderEmailId } : {}),
    });
    onCreated(created.id);
    onBaseline(serialize(draft));
    return created.id;
  };

  /** Run a commit, taking the pane to the saved broadcast and reporting either
   *  way. `fallback` is the sentence shown when the server offers none. */
  const commit = async (
    act: (id: string) => Promise<unknown>,
    done: { title: string; description?: string },
    fallback: string
  ) => {
    const { ctx, committing } = latest.current;
    setServerError(null);
    committing.current = true;
    try {
      const id = await persist();
      await act(id);
      ctx.open(DETAIL_KEY, { id }, { target: 'replace' });
      afterPaneChange(() => {
        toast.add({ ...done, type: 'success' });
      });
    } catch (error) {
      committing.current = false;
      setServerError(broadcastErrorMessage(error, fallback));
    }
  };

  const saveDraft = async () => {
    const { ctx, currentId, committing } = latest.current;
    setServerError(null);
    committing.current = true;
    try {
      const wasNew = currentId === null;
      const id = await persist();
      if (wasNew) {
        // Become the edit view for the draft that now exists, so further edits
        // patch it instead of creating another.
        ctx.open(DETAIL_KEY, { id }, { target: 'replace' });
        afterPaneChange(() => {
          toast.add({ title: 'Draft saved', type: 'success' });
        });
      } else {
        committing.current = false;
        toast.add({ title: 'Draft saved', type: 'success' });
      }
    } catch (error) {
      committing.current = false;
      setServerError(
        broadcastErrorMessage(error, 'Could not save this draft. Nothing was changed.')
      );
    }
  };

  const sendNow = async () => {
    const { draft, senderLine, recipientCount } = latest.current;
    const ok = await confirm({
      title: `Send this to ${peopleCount(recipientCount ?? 0)}?`,
      description: `“${draft.subject.trim()}” goes out from ${senderLine} straight away. Email can’t be recalled once it has gone, so this is the last chance to change it.`,
      confirmLabel: 'Send it now',
      cancelLabel: 'Not yet',
      color: 'module',
    });
    if (!ok) return;
    await commit(
      (id) => send.mutateAsync(id),
      {
        title: 'Broadcast on its way',
        description: 'It is being sent to everyone in your audience now.',
      },
      'Could not send this broadcast. Nothing was changed.'
    );
  };

  const scheduleFor = async () => {
    const { draft, senderLine, recipientCount, scheduledAt } = latest.current;
    const when = new Date(scheduledAt);
    const ok = await confirm({
      title: `Schedule this for ${peopleCount(recipientCount ?? 0)}?`,
      description: `“${draft.subject.trim()}” goes out on ${formatWhen(when.toISOString())} from ${senderLine}. You can cancel it any time before then.`,
      confirmLabel: 'Schedule it',
      cancelLabel: 'Not yet',
      color: 'module',
    });
    if (!ok) return;
    await commit(
      (id) => schedule.mutateAsync({ id, scheduledAt: when.toISOString() }),
      { title: 'Broadcast scheduled' },
      'Could not schedule this broadcast. Nothing was changed.'
    );
  };

  return {
    serverError,
    saveDraft,
    sendNow,
    scheduleFor,
    saving: create.isPending || update.isPending,
    sending: send.isPending,
    scheduling: schedule.isPending,
    busy: create.isPending || update.isPending || send.isPending || schedule.isPending,
  };
}
