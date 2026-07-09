'use client';

// The Brand sections catalog (docs/61 §6 Phase 6b) — the brand-designer curates
// the archetype set authors can stamp: enable/disable (the lever for the platform
// defaults), rename/recategorize, delete, and create new ones from scratch. A
// disabled archetype stays here but drops out of the Add palette.
//
// @sparx/ui components only. Destructive delete behind useConfirm.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  NativeSelect,
  Stack,
  Switch,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';
import { ARCHETYPE_FAMILIES, type ArchetypeSummaryDto } from '@sparx/builder-schemas';

import { makeNode } from '../../_builder/registry';
import {
  createArchetype,
  deleteArchetype,
  setArchetypeEnabled,
  updateArchetypeIdentity,
} from '../lib/archetype-actions';

type DialogState = { mode: 'create' } | { mode: 'edit'; row: ArchetypeSummaryDto } | null;

export function ArchetypeCatalog({
  rows,
  canEdit,
}: {
  rows: ArchetypeSummaryDto[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const onToggle = async (row: ArchetypeSummaryDto, enabled: boolean) => {
    setBusyKey(row.key);
    const res = await setArchetypeEnabled(row.key, enabled);
    setBusyKey(null);
    if (res.ok) {
      router.refresh();
    } else {
      toast.error(res.error ?? 'Could not update the section.');
    }
  };

  const onDelete = async (row: ArchetypeSummaryDto) => {
    const ok = await confirm({
      title: `Delete “${row.name}”?`,
      description:
        'This removes the brand section from the catalog and the Add palette. Pages that already used it keep their copy.',
      confirmLabel: 'Delete section',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyKey(row.key);
    const res = await deleteArchetype(row.key);
    setBusyKey(null);
    if (res.ok) {
      toast.success(`Deleted “${row.name}”.`);
      router.refresh();
    } else {
      toast.error(res.error ?? 'Could not delete the section.');
    }
  };

  return (
    <Stack gap={4}>
      <div className="flex items-center justify-between gap-3">
        <Text variant="muted">
          {rows.length} {rows.length === 1 ? 'section' : 'sections'} available to stamp from the Add
          palette.
        </Text>
        {canEdit ? (
          <Button
            size="sm"
            variant="solid"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setDialog({ mode: 'create' })}
          >
            New section
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent>
            <Text variant="muted">
              No brand sections yet. Create one, or save a selection from the editor as a brand
              section.
            </Text>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul>
              {rows.map((row, i) => (
                <li key={row.key} className={i > 0 ? 'border-base-300 border-t' : undefined}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <DynamicIcon
                      name={row.icon as IconName}
                      className="text-base-content/70 h-5 w-5 shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-40 flex-1">
                      <Text weight="medium">{row.name}</Text>
                      {row.description ? (
                        <Text variant="muted" size="xs">
                          {row.description}
                        </Text>
                      ) : null}
                    </div>
                    <Badge variant="soft" size="sm">
                      {row.family}
                    </Badge>
                    <Badge
                      color={row.source === 'platform' ? 'info' : 'module'}
                      variant="soft"
                      size="sm"
                    >
                      {row.source === 'platform' ? 'Platform' : 'Custom'}
                    </Badge>
                    {canEdit ? (
                      <>
                        <label className="flex items-center gap-1.5">
                          <Switch
                            checked={row.enabled}
                            disabled={busyKey === row.key}
                            onCheckedChange={(v) => void onToggle(row, v)}
                            aria-label={`${row.enabled ? 'Disable' : 'Enable'} ${row.name}`}
                          />
                          <Text variant="muted" size="xs">
                            {row.enabled ? 'On' : 'Off'}
                          </Text>
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${row.name}`}
                          onClick={() => setDialog({ mode: 'edit', row })}
                          disabled={busyKey === row.key}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${row.name}`}
                          onClick={() => void onDelete(row)}
                          disabled={busyKey === row.key}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Badge variant="soft" size="sm">
                        {row.enabled ? 'On' : 'Off'}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ArchetypeDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onDone={() => router.refresh()}
      />
    </Stack>
  );
}

// Create / edit a brand section's identity. Create seeds a blank Section as the
// root (an empty container to compose into); edit patches name + family.
function ArchetypeDialog({
  state,
  onClose,
  onDone,
}: {
  state: DialogState;
  onClose: () => void;
  onDone: () => void;
}) {
  const open = state !== null;
  const editing = state?.mode === 'edit' ? state.row : null;
  const [name, setName] = React.useState('');
  const [family, setFamily] = React.useState('content');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (state?.mode === 'edit') {
      setName(state.row.name);
      setFamily(state.row.family);
    } else if (state?.mode === 'create') {
      setName('');
      setFamily('content');
    }
  }, [state]);

  const trimmed = name.trim();

  const onSubmit = async () => {
    if (!trimmed || busy) return;
    setBusy(true);
    const res = editing
      ? await updateArchetypeIdentity(editing.key, { name: trimmed, family })
      : await createArchetype({ name: trimmed, family, tree: makeNode('Section') });
    setBusy(false);
    if (res.ok) {
      toast.success(editing ? 'Section updated.' : 'Section created.');
      onClose();
      onDone();
    } else {
      toast.error(res.error ?? 'Could not save the section.');
    }
  };

  return (
    <Modal open={open} onOpenChange={(next) => !busy && !next && onClose()}>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>{editing ? 'Edit brand section' : 'New brand section'}</ModalTitle>
          <ModalDescription>
            {editing
              ? 'Rename or recategorize this section. Edit its content from the editor.'
              : 'Name your section, then compose its content in the editor.'}
          </ModalDescription>
        </ModalHeader>
        <Stack gap={3}>
          <div>
            <Label htmlFor="archetype-name">Name</Label>
            <Input
              id="archetype-name"
              value={name}
              placeholder="e.g. Testimonial row"
              maxLength={120}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onSubmit();
                }
              }}
            />
          </div>
          <div>
            <Label htmlFor="archetype-family">Category</Label>
            <NativeSelect
              id="archetype-family"
              value={family}
              disabled={busy}
              onChange={(e) => setFamily(e.target.value)}
            >
              {ARCHETYPE_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </Stack>
        <ModalFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="solid" disabled={!trimmed || busy} onClick={() => void onSubmit()}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Create'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
