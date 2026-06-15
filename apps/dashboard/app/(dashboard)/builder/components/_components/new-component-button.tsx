'use client';

// Create a brand-new tenant component from scratch (docs/53) — the first-class
// "New component" path on the catalog, alongside Copy (from a system component)
// and "Save as component" (from a canvas selection). Prompts for a NAME first
// (required — so the catalog never accrues "Untitled component" residue, eval
// Finding 9), then seeds a blank Section as the root (an empty container to
// compose into), auto-keys it server-side, and opens the component tree editor.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  toast,
} from '@sparx/ui';

import { makeNode } from '../../_builder/registry';
import { copyComponent } from '../_lib/component-actions';

export function NewComponentButton() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const trimmed = name.trim();

  const onCreate = async () => {
    if (!trimmed || busy) return;
    setBusy(true);
    const res = await copyComponent({
      name: trimmed,
      group: 'layout',
      icon: 'box',
      surfaces: ['page'],
      tree: makeNode('Section'),
    });
    if (res.ok && res.data) {
      // Navigating away unmounts the dialog — leave `busy` set so it can't be
      // re-submitted during the transition.
      router.push(`/builder/components/${res.data.key}/edit`);
      return;
    }
    setBusy(false);
    toast.error(res.error ?? 'Could not create the component.');
  };

  return (
    <>
      <Button
        size="sm"
        variant="solid"
        leftIcon={<Plus className="h-4 w-4" />}
        onClick={() => {
          setName('');
          setOpen(true);
        }}
      >
        New
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          // Don't let an Escape / overlay interaction yank the dialog mid-create.
          if (!busy) setOpen(next);
        }}
      >
        <AlertDialogContent
          onOpenAutoFocus={(e) => {
            // Focus the name field instead of the default (Cancel), so the author
            // can type immediately.
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>New component</AlertDialogTitle>
            <AlertDialogDescription>
              Give your component a name. You can rename it any time from its editor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            ref={inputRef}
            value={name}
            placeholder="e.g. Hero banner"
            maxLength={80}
            disabled={busy}
            aria-label="Component name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void onCreate();
              }
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            {/* A plain action button (not AlertDialogAction) so an empty name keeps
                the dialog open instead of auto-closing on click. */}
            <Button variant="solid" disabled={!trimmed || busy} onClick={() => void onCreate()}>
              {busy ? 'Creating…' : 'Create'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
