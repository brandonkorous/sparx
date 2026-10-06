'use client';

// The checklist's three one-click actions, each a confirm, a mutation and a
// toast. Split from legal-list.tsx under RULE #0.5.

import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { productCopy } from '../../lib/product';
import { contentErrorMessage } from './data';
import {
  useAcknowledgeLegalPage,
  useInstantiateLegalPage,
  useTakeStarterWording,
  type ChecklistItem,
} from './legal-data';

/** One action: `run` starts it for a row, `busy` names the row it is working on. */
export interface LegalAction {
  run: (item: ChecklistItem) => void;
  busy: string | undefined;
}

export function useAddLegalPage(): LegalAction {
  const toast = useToast();
  const confirm = useConfirm();
  const instantiate = useInstantiateLegalPage();
  const run = async (item: ChecklistItem) => {
    const ok = await confirm({
      title: `Add your ${item.title.toLowerCase()}?`,
      description: productCopy(
        'cms.legal.createHint',
        'This creates a private draft from a Piggles starter template, so you have something to work from rather than a blank page. The starter wording is a starting point, not legal advice. Read it through and make it fit your business before you publish. It will also be linked in your site footer.'
      ),
      confirmLabel: 'Add it',
      cancelLabel: 'Cancel',
      color: 'module',
    });
    if (!ok) return;
    instantiate.mutate(item.legalKind, {
      onSuccess: () => {
        toast.add({
          title: `${item.title} added as a draft`,
          description: 'Read the starter wording, make it yours, then publish it.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not add this page',
          description: contentErrorMessage(error, 'Nothing was created.'),
          type: 'error',
        });
      },
    });
  };
  return {
    run: (item) => {
      void run(item);
    },
    busy: instantiate.isPending ? instantiate.variables : undefined,
  };
}

/** A page she has edited loses its words from the live page, recoverable from the
 *  page's history, so the confirm says that rather than just warning her off. */
export function useTakeLegalWording(): LegalAction {
  const toast = useToast();
  const confirm = useConfirm();
  const takeStarter = useTakeStarterWording();
  const run = async (item: ChecklistItem) => {
    const entry = item.entry;
    if (!entry) return;
    const live = entry.status === 'published';
    const ok = await confirm({
      title: `Use the new wording for your ${item.title.toLowerCase()}?`,
      description: `Everything on this page is replaced with the current starter wording${
        live ? ', and your live page changes straight away' : ''
      }. What is on it now is kept in the page’s history, so you can get it back. You will need to read the new wording and mark it reviewed.`,
      confirmLabel: 'Use the new wording',
      cancelLabel: 'Leave it as it is',
      color: 'warning',
    });
    if (!ok) return;
    takeStarter.mutate(entry.id, {
      onSuccess: () => {
        toast.add({
          title: `${item.title} now uses the new wording`,
          description: 'Read it through and mark it reviewed.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not update the wording',
          description: contentErrorMessage(error, 'The page is unchanged.'),
          type: 'error',
        });
      },
    });
  };
  return {
    run: (item) => {
      void run(item);
    },
    busy: takeStarter.isPending ? takeStarter.variables : undefined,
  };
}

export function useAcknowledgeLegal(): LegalAction {
  const toast = useToast();
  const confirm = useConfirm();
  const acknowledge = useAcknowledgeLegalPage();
  const run = async (item: ChecklistItem) => {
    if (!item.entry) return;
    const ok = await confirm({
      title: `Mark your ${item.title.toLowerCase()} as reviewed?`,
      description:
        'Confirm you have read the starter wording and made it fit your business. This is not legal advice: if you are unsure, check it with your own advisor. This only clears the “needs review” note; it does not publish the page.',
      confirmLabel: 'I have reviewed it',
      cancelLabel: 'Not yet',
      color: 'module',
    });
    if (!ok) return;
    acknowledge.mutate(item.entry.id, {
      onSuccess: () => {
        toast.add({ title: `${item.title} marked as reviewed`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not update this',
          description: contentErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };
  return {
    run: (item) => {
      void run(item);
    },
    busy: acknowledge.isPending ? acknowledge.variables : undefined,
  };
}
