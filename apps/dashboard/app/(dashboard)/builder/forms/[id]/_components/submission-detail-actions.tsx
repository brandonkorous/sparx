'use client';

// Lifecycle actions for a submission detail, rendered in the frame header (the
// page's top bar) — status + next-step actions ride the header, never an in-body
// "Status" card (docs/86 §5.1). The primary read/unread toggle stays a labelled
// button; the rest (archive / spam / delete) fold into an icon-only "More" menu
// so the header fits one row. Delete is guarded (useConfirm names the person).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  Check,
  Mail,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  statusTone,
  toast,
  useConfirm,
} from '@sparx/ui';

import {
  deleteSubmissionAction,
  setSubmissionStatusAction,
  type ActionResult,
} from '../../actions';
import { STATUS_LABEL, type FormSubmissionStatus } from '../../types';

export function SubmissionDetailActions({
  id,
  status,
  name,
}: {
  id: string;
  status: FormSubmissionStatus;
  name: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<ActionResult<unknown>>, success: string) {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (result.ok) {
      toast.success(success);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const setStatus = (next: FormSubmissionStatus, success: string) =>
    run(() => setSubmissionStatusAction(id, next), success);

  async function remove() {
    const ok = await confirm({
      title: 'Delete this message?',
      description: `${name}'s message will be permanently deleted. This can't be undone.`,
      confirmLabel: 'Delete message',
      cancelLabel: 'Keep',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const result = await deleteSubmissionAction(id);
    setBusy(false);
    if (result.ok) {
      toast.success('Message deleted');
      router.replace('/builder/forms');
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Badge color={statusTone(status)} variant="soft">
        {STATUS_LABEL[status]}
      </Badge>

      {status === 'new' ? (
        <Button
          size="sm"
          color="module"
          disabled={busy}
          leftIcon={<Check className="h-4 w-4" />}
          onClick={() => void setStatus('read', 'Marked as read')}
        >
          Mark as read
        </Button>
      ) : status === 'read' ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          leftIcon={<Mail className="h-4 w-4" />}
          onClick={() => void setStatus('new', 'Marked as unread')}
        >
          Mark as unread
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          leftIcon={<Undo2 className="h-4 w-4" />}
          onClick={() => void setStatus('read', 'Moved back to your inbox')}
        >
          Move to inbox
        </Button>
      )}

      <MoreActionsMenu
        status={status}
        busy={busy}
        onStatus={setStatus}
        onDelete={() => void remove()}
      />
    </div>
  );
}

// The secondary lifecycle actions (archive / spam / delete), folded into an
// icon-only "More" menu so the header fits one row (docs/DESIGN detail-header).
function MoreActionsMenu({
  status,
  busy,
  onStatus,
  onDelete,
}: {
  status: FormSubmissionStatus;
  busy: boolean;
  onStatus: (next: FormSubmissionStatus, success: string) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" shape="square" size="sm" aria-label="More actions" disabled={busy}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status !== 'archived' ? (
          <DropdownMenuItem onSelect={() => onStatus('archived', 'Archived')}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onStatus('read', 'Restored to your inbox')}>
            <ArchiveRestore className="mr-2 h-4 w-4" />
            Restore
          </DropdownMenuItem>
        )}
        {status !== 'spam' ? (
          <DropdownMenuItem onSelect={() => onStatus('spam', 'Marked as spam')}>
            <ShieldAlert className="mr-2 h-4 w-4" />
            Mark as spam
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onStatus('read', 'Marked as not spam')}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Not spam
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} className="text-danger">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
