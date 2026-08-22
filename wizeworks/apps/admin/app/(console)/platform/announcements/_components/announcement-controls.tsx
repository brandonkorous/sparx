'use client';

// Row controls: the on/off switch and delete.
//
// The switch patches `isActive` alone, so taking a notice down in a hurry does
// not disturb the window somebody scheduled. It is NOT confirmed — switching a
// notice off is the safe direction and the one an operator reaches for when a
// sentence is wrong on the front page; a modal in the way of that is a modal in
// the way of a fix. Delete IS confirmed, because it destroys the record of what
// was said and when.

import * as React from 'react';
import { Button, Stack, toast, useConfirm } from '@wizeworks/ui';
import type { OperatorAnnouncement } from '@wizeworks/operator';
import { deleteAnnouncementAction, setAnnouncementActiveAction } from '../actions';

export function AnnouncementControls({ announcement }: { announcement: OperatorAnnouncement }) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    const next = !announcement.isActive;
    startTransition(async () => {
      const res = await setAnnouncementActiveAction(announcement.id, next);
      if (res.ok) toast.success(next ? 'Notice switched on' : 'Notice switched off');
      else toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const ok = await confirm({
        title: 'Delete this notice?',
        description: `“${announcement.message}” is removed for good, along with the record of when it ran. Switching it off instead keeps it, and you can put it back later.`,
        confirmLabel: 'Delete notice',
        color: 'danger',
      });
      if (!ok) return;
      const res = await deleteAnnouncementAction(announcement.id);
      if (res.ok) toast.success('Notice deleted');
      else toast.error(res.error);
    });
  }

  return (
    <Stack direction="row" gap={2} className="flex-wrap justify-end">
      <Button
        type="button"
        color={announcement.isActive ? 'warning' : 'success'}
        variant="soft"
        size="sm"
        disabled={pending}
        onClick={toggle}
      >
        {announcement.isActive ? 'Switch off' : 'Switch on'}
      </Button>
      <Button
        type="button"
        color="danger"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={remove}
      >
        Delete
      </Button>
    </Stack>
  );
}
