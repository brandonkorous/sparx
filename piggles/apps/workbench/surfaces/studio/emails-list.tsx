'use client';

// Every email this business sends, and the way into each one.
//
// This is what the old studio's switcher used to be, moved out of the editor —
// because a pane that edits ONE email cannot also own the list of all of them
// without becoming the whole-catalog editor again. It is also the answer to "how
// do I compare two": open one, then open the next beside it.

import { useState } from 'react';
import { Button, Input } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { useCreateEmail, useEmails } from '../../lib/studio/email-data';
import { EmailRow } from './email-row';

export function EmailsList({
  onOpen,
  onOpenBeside,
}: {
  onOpen: (emailId: string) => void;
  onOpenBeside: (emailId: string) => void;
}) {
  const emails = useEmails();

  if (emails.isPending) return <PaneWaiting label="Finding your emails…" />;
  const rows = emails.data ?? [];

  return (
    <div className="bg-base-200 flex h-full min-h-0 flex-col">
      <AddEmail onCreated={onOpen} />

      <ul className="min-h-0 flex-1 overflow-auto p-3">
        {rows.map((email) => (
          <EmailRow key={email.id} email={email} onOpen={onOpen} onOpenBeside={onOpenBeside} />
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="text-base-content p-6 text-center">
          No emails here. Name one above and start writing.
        </p>
      ) : null}
    </div>
  );
}

/** Name it and you are in it. A new email starts blank, rather than as a starter
 *  design somebody has to dismantle first. */
function AddEmail({ onCreated }: { onCreated: (emailId: string) => void }) {
  const createEmail = useCreateEmail();
  const [name, setName] = useState('');

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const created = await createEmail.mutateAsync({ name: trimmed });
    setName('');
    onCreated(created.id);
  };

  return (
    <div className="border-base-300 flex shrink-0 items-center gap-2 border-b p-3">
      <Input
        size="sm"
        value={name}
        placeholder="Name a new email — “Spring offer”, “Thanks for booking”"
        onChange={(event) => setName(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void add();
        }}
      />
      <Button
        size="sm"
        color="primary"
        disabled={!name.trim() || createEmail.isPending}
        onClick={() => void add()}
      >
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Add email
      </Button>
    </div>
  );
}
