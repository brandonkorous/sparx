'use client';

// Duplicate, rename and delete a look, from the row it belongs to.
//
// DELETE IS REFUSED while a site is wearing it, and the server is the one that
// refuses — a dangling look falls back to the brand colours, which is safe, but it
// happens on the LIVE site the moment the row goes, and nobody deleting a look they
// think is unused expects to repaint a shop.
//
// So the confirm NAMES the sites, read at the moment of asking rather than held from
// when the pane opened. "Your shop is using this" is a sentence someone can act on;
// "this look is in use" is one they have to go and investigate.

import { useState } from 'react';
import { Button, Input, useToast } from '@wizeworks/silicaui-react';
import { faCopy, faPen, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import {
  fetchThemeUsages,
  useDeleteTheme,
  useDuplicateTheme,
  useSaveTheme,
  type ThemeRow,
} from '../../lib/studio/data';

/** What deleting this look would cost, in the author's own words. */
function costOf(names: string[] | null): string {
  if (names === null) return 'We couldn’t check which sites are using it.';
  if (names.length === 0) return 'No site is using it, so nothing on screen will change.';
  return `${names.join(' and ')} ${names.length === 1 ? 'is' : 'are'} using it. Choose a different look for ${names.length === 1 ? 'it' : 'them'} first — this won’t delete while it is in use.`;
}

export function ThemeActions({ row, onOpen }: { row: ThemeRow; onOpen: (id: string) => void }) {
  const [renaming, setRenaming] = useState(false);
  const duplicate = useDuplicateTheme();
  const toast = useToast();

  const copy = async () => {
    const made = await duplicate.mutateAsync({ id: row.id, name: `${row.name} copy` });
    toast.add({ title: `“${made.name}” created`, type: 'success' });
    onOpen(made.id);
  };

  if (renaming) return <RenameField row={row} onDone={() => setRenaming(false)} />;

  return (
    <>
      <Button
        size="sm"
        shape="square"
        aria-label={`Rename ${row.name}`}
        title="Rename"
        onClick={() => setRenaming(true)}
      >
        <Icon glyph={faPen} className="size-4" aria-hidden />
      </Button>
      <Button
        size="sm"
        shape="square"
        aria-label={`Duplicate ${row.name}`}
        title="Make a copy"
        disabled={duplicate.isPending}
        onClick={() => void copy()}
      >
        <Icon glyph={faCopy} className="size-4" aria-hidden />
      </Button>
      <DeleteLook row={row} />
    </>
  );
}

function RenameField({ row, onDone }: { row: ThemeRow; onDone: () => void }) {
  const saveTheme = useSaveTheme();
  return (
    <Input
      size="sm"
      // Focus via a ref, not `autoFocus`: this field appears because the author just
      // asked to rename, so moving focus into it follows them rather than stealing.
      ref={(node: HTMLInputElement | null) => node?.select()}
      defaultValue={row.name}
      onBlur={(event) => {
        const name = event.currentTarget.value.trim();
        onDone();
        if (name && name !== row.name) {
          // `draft` is the look as it stands — a rename must not also roll its
          // colours back to whatever was published.
          void saveTheme.mutateAsync({ id: row.id, name, theme: row.draft });
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') onDone();
      }}
    />
  );
}

function DeleteLook({ row }: { row: ThemeRow }) {
  const confirm = useConfirm();
  const toast = useToast();
  const deleteTheme = useDeleteTheme();

  const remove = async () => {
    const names = await fetchThemeUsages(row.id)
      .then((sites) => sites.map((site) => site.name))
      .catch(() => null);

    const ok = await confirm({
      title: `Delete “${row.name}”?`,
      description: `${costOf(names)} A deleted look cannot be brought back.`,
      confirmLabel: 'Delete look',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    try {
      await deleteTheme.mutateAsync(row.id);
      toast.add({ title: `“${row.name}” deleted`, type: 'success' });
    } catch (error) {
      // The server's own sentence names the site that is wearing it, which is more
      // use than anything this file could say from a status code.
      toast.add({
        title: error instanceof Error ? error.message : 'That look could not be deleted',
        type: 'error',
      });
    }
  };

  return (
    <Button
      size="sm"
      shape="square"
      color="danger"
      variant="soft"
      aria-label={`Delete ${row.name}`}
      title="Delete"
      disabled={deleteTheme.isPending}
      onClick={() => void remove()}
    >
      <Icon glyph={faTrash} className="size-4" aria-hidden />
    </Button>
  );
}
