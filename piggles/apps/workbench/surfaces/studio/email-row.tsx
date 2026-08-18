'use client';

// One email in the list, and everything you can do to it from there.
//
// Two actions beyond opening it, and both belong here rather than inside the pane:
// deleting one is a decision about the CATALOG, and making a shared default belong
// to just this site changes which email this site's list points at. Neither is a
// thing you do while designing.

import { Badge, Button, useToast } from '@wizeworks/silicaui-react';
import { faColumns, faCodeBranch, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import { useActivePropertyId } from '../../lib/api/shell-data';
import {
  useCustomiseForSite,
  useDeleteEmail,
  type EmailSummary,
} from '../../lib/studio/email-data';

/** How an email is doing, in words. Three states, not two: live-but-edited-since is
 *  a different situation from live, and it is the one an author needs telling. */
function status(email: EmailSummary): { label: string; tone: 'success' | 'warning' } {
  if (!email.published) return { label: 'Not sending yet', tone: 'warning' };
  if (email.hasUnpublishedChanges) return { label: 'Edited since it went live', tone: 'warning' };
  return { label: 'Live', tone: 'success' };
}

export function EmailRow({
  email,
  onOpen,
  onOpenBeside,
}: {
  email: EmailSummary;
  onOpen: (emailId: string) => void;
  onOpenBeside: (emailId: string) => void;
}) {
  const state = status(email);
  return (
    <li className="bg-base-100 mb-2 flex items-center gap-2 rounded-lg pr-2 shadow-sm">
      <button
        type="button"
        onClick={() => onOpen(email.id)}
        className="hover:bg-base-300 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="text-base-content block truncate font-medium">{email.name}</span>
          <span className="text-base-content block truncate text-sm">
            {email.subject || 'No subject yet'}
          </span>
        </span>
        {email.scope === 'site' ? (
          <Badge color="info" variant="soft">
            This site only
          </Badge>
        ) : null}
        <Badge color={state.tone} variant="soft">
          {state.label}
        </Badge>
      </button>

      <CustomiseButton email={email} onOpen={onOpen} />
      {/* Side by side is the reason this builder is per-document at all, so it is an
          action on the row rather than something to discover in a menu. */}
      <Button
        size="sm"
        shape="square"
        aria-label={`Open ${email.name} alongside`}
        title="Open alongside"
        onClick={() => onOpenBeside(email.id)}
      >
        <Icon glyph={faColumns} className="size-4" aria-hidden />
      </Button>
      <DeleteButton email={email} />
    </li>
  );
}

/**
 * Make a shared default this site's own.
 *
 * Only for a provisioned default that is still shared: a custom email already
 * belongs to whoever made it, and one already forked has nothing left to fork.
 */
function CustomiseButton({
  email,
  onOpen,
}: {
  email: EmailSummary;
  onOpen: (emailId: string) => void;
}) {
  const propertyId = useActivePropertyId();
  const customise = useCustomiseForSite();
  const toast = useToast();

  const key = email.key;
  if (!key || email.scope === 'site' || !propertyId) return null;

  const fork = async () => {
    const created = await customise.mutateAsync({ propertyId, key });
    toast.add({ title: `“${email.name}” is now this site’s own`, type: 'success' });
    onOpen(created.id);
  };

  return (
    <Button
      size="sm"
      shape="square"
      color="primary"
      variant="soft"
      aria-label={`Make ${email.name} this site’s own`}
      title="Make this site’s own"
      disabled={customise.isPending}
      onClick={() => void fork()}
    >
      <Icon glyph={faCodeBranch} className="size-4" aria-hidden />
    </Button>
  );
}

function DeleteButton({ email }: { email: EmailSummary }) {
  const confirm = useConfirm();
  const toast = useToast();
  const deleteEmail = useDeleteEmail();

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${email.name}”?`,
      description: email.published
        ? 'This email is live. Deleting it stops it being sent, and the design is gone for good.'
        : 'The design is gone for good.',
      confirmLabel: 'Delete email',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    await deleteEmail.mutateAsync(email.id);
    toast.add({ title: `“${email.name}” deleted`, type: 'success' });
  };

  return (
    <Button
      size="sm"
      shape="square"
      color="danger"
      variant="soft"
      aria-label={`Delete ${email.name}`}
      title="Delete"
      disabled={deleteEmail.isPending}
      onClick={() => void remove()}
    >
      <Icon glyph={faTrash} className="size-4" aria-hidden />
    </Button>
  );
}
