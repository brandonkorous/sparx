'use client';

// Opening ONE email into the shared session.
//
// The subject and the preview line live in the DOCUMENT, not in a side form. So
// changing the subject is an edit like any other: it marks the pane unsaved, it
// undoes with ⌘Z, and it reaches the server on the same Save as the words in the
// email. A settings drawer with its own Save button is two saves wearing one pane.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentStore, EmailDoc } from '@wizeworks/studio';
import { useStudioBinding } from '../../lib/studio/provider';
import {
  useEmail,
  usePublishEmail,
  useSaveEmail,
  type EmailRow,
} from '../../lib/studio/email-data';

/** A stored row as the engine's document. */
function toDoc(row: EmailRow): EmailDoc {
  return {
    kind: 'email',
    id: row.id,
    name: row.name,
    rev: 0,
    publishedAt: row.publishedAt,
    unpublished: row.hasUnpublishedChanges || !row.published,
    document: row.silicaDoc,
  };
}

/** The one store this email lives in, however many panes are looking at it. */
function useOpenEmail(row: EmailRow | null) {
  const { session } = useStudioBinding();
  const [store, setStore] = useState<DocumentStore<EmailDoc> | null>(null);

  useEffect(() => {
    if (!session || !row) {
      setStore(null);
      return;
    }
    setStore(session.open(toDoc(row)));
  }, [session, row]);

  return store;
}

interface EmailWrites {
  saving: boolean;
  publishing: boolean;
  error: string | null;
  save: () => Promise<void>;
  publish: () => Promise<void>;
}

function useEmailWrites(store: DocumentStore<EmailDoc> | null): EmailWrites {
  const saveEmail = useSaveEmail();
  const publishEmail = usePublishEmail();

  const save = useCallback(async () => {
    if (!store) return;
    const doc = store.current;
    await saveEmail.mutateAsync({ id: doc.id, doc: doc.document, name: doc.name });
    store.markSaved(doc.rev + 1, doc.publishedAt, true);
  }, [store, saveEmail]);

  const publish = useCallback(async () => {
    if (!store) return;
    // Save first, always: publishing a draft the server has not seen would send the
    // PREVIOUS email to every recipient and report success.
    if (store.dirty) await save();
    const published = await publishEmail.mutateAsync(store.current.id);
    if (published.publishedAt) store.markPublished(published.publishedAt);
  }, [store, publishEmail, save]);

  const error = useMemo(() => {
    const failure = publishEmail.error ?? saveEmail.error;
    return failure instanceof Error ? failure.message : null;
  }, [saveEmail.error, publishEmail.error]);

  return { saving: saveEmail.isPending, publishing: publishEmail.isPending, error, save, publish };
}

export interface EmailDocumentState extends EmailWrites {
  store: DocumentStore<EmailDoc> | null;
  loading: boolean;
  /** The email could not be loaded — deleted, or from another business. */
  missing: boolean;
}

export function useEmailDocument(emailId: string | null): EmailDocumentState {
  const email = useEmail(emailId);
  const store = useOpenEmail(email.data ?? null);
  const writes = useEmailWrites(store);

  return {
    ...writes,
    store,
    loading: Boolean(emailId) && email.isPending,
    missing: Boolean(emailId) && email.isError,
  };
}
