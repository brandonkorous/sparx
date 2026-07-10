'use client';

// Hierarchical menu editor.
//
// Each item is keyed by a client-side `uid` (so React can reconcile while
// the user reorders), tracks link kind (entry vs external), label, and an
// optional `children` array. On save we strip uids and POST the tree as
// the api-rest PUT body.
//
// Drag-and-drop is intentionally out of scope for the first cut — the
// move-up/move-down buttons cover 90% of editor intent and ship without a
// dependency on @dnd-kit / react-beautiful-dnd. The structure here makes
// the eventual swap trivial: items[] reorder + setItems() is the whole
// move primitive.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AdaptiveLabel, toast, useConfirm } from '@sparx/ui';
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  Label,
  Select,
  SelectItem,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { saveMenu } from './menu-actions';
import { DetailFooterSlot } from '../../_components/detail-header-slot';

export interface EditableMenuItem {
  uid: string;
  label: string;
  kind: 'entry' | 'external';
  entryId: string | null;
  externalUrl: string | null;
  openInNewTab: boolean;
  children: EditableMenuItem[];
}

export interface EntryChoice {
  id: string;
  typeKey: string;
  slug: string | null;
  title: string;
}

let uidCounter = 0;
const newUid = () => `mi-${Date.now()}-${++uidCounter}`;

function emptyItem(): EditableMenuItem {
  return {
    uid: newUid(),
    label: '',
    kind: 'external',
    entryId: null,
    externalUrl: '',
    openInNewTab: false,
    children: [],
  };
}

// Map editable tree → wire shape expected by api-rest PUT.
function toWireItems(items: EditableMenuItem[]): unknown[] {
  return items.map((item) => ({
    label: item.label,
    ...(item.kind === 'entry' && item.entryId ? { entry_id: item.entryId } : {}),
    ...(item.kind === 'external' && item.externalUrl ? { external_url: item.externalUrl } : {}),
    open_in_new_tab: item.openInNewTab,
    ...(item.children.length ? { children: toWireItems(item.children) } : {}),
  }));
}

interface PathStep {
  index: number;
}

// Recursive update helper — given a path of indices, runs `update` on
// the array at that depth. Returns a new tree (immutable update).
function updateAtPath(
  items: EditableMenuItem[],
  path: PathStep[],
  update: (siblings: EditableMenuItem[]) => EditableMenuItem[]
): EditableMenuItem[] {
  if (path.length === 0) return update(items);
  const [head, ...rest] = path;
  return items.map((item, i) =>
    i === head!.index ? { ...item, children: updateAtPath(item.children, rest, update) } : item
  );
}

// Resolve a path back into the item it points to, used for the
// remove-with-children confirm dialog.
function resolveAtPath(items: EditableMenuItem[], path: PathStep[]): EditableMenuItem | null {
  let cursor: EditableMenuItem | undefined;
  let layer = items;
  for (const step of path) {
    cursor = layer[step.index];
    if (!cursor) return null;
    layer = cursor.children;
  }
  return cursor ?? null;
}

export function MenuEditor({
  location,
  initialName,
  initialItems,
  entryChoices,
}: {
  location: string;
  initialName: string;
  initialItems: EditableMenuItem[];
  entryChoices: EntryChoice[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [name, setName] = React.useState(initialName);
  const [items, setItems] = React.useState<EditableMenuItem[]>(initialItems);
  const [pending, startTransition] = React.useTransition();

  const v = useFieldValidation({ name }, { name: rule.required('Name is required.') });

  function addRoot() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function addChild(path: PathStep[]) {
    setItems((prev) =>
      updateAtPath(prev, path, (siblings) =>
        siblings.map((item, i) =>
          i === path[path.length - 1]!.index
            ? { ...item, children: [...item.children, emptyItem()] }
            : item
        )
      )
    );
  }

  async function requestRemove(path: PathStep[]) {
    if (path.length === 0) return;
    const item = resolveAtPath(items, path);
    if (!item) return;
    // No subtree — drop without prompting. Subtrees gate behind a confirm
    // so an accidental click can't blow away nested work.
    if (item.children.length === 0) {
      executeRemove(path);
      return;
    }
    const childCount = item.children.length;
    const ok = await confirm({
      title: 'Remove menu item?',
      description: (
        <>
          <strong>{item.label || '(no label)'}</strong> has {childCount} nested{' '}
          {childCount === 1 ? 'child' : 'children'}. Removing this item drops the entire subtree —
          children cannot be recovered after you save.
        </>
      ),
      confirmLabel: 'Remove subtree',
      tone: 'danger',
    });
    if (!ok) return;
    executeRemove(path);
  }

  function executeRemove(path: PathStep[]) {
    const parentPath = path.slice(0, -1);
    const childIndex = path[path.length - 1]!.index;
    setItems((prev) =>
      updateAtPath(prev, parentPath, (siblings) => siblings.filter((_, i) => i !== childIndex))
    );
  }

  function moveAt(path: PathStep[], delta: -1 | 1) {
    if (path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const childIndex = path[path.length - 1]!.index;
    setItems((prev) =>
      updateAtPath(prev, parentPath, (siblings) => {
        const target = childIndex + delta;
        if (target < 0 || target >= siblings.length) return siblings;
        const next = siblings.slice();
        const [moved] = next.splice(childIndex, 1);
        next.splice(target, 0, moved!);
        return next;
      })
    );
  }

  function patchAt(path: PathStep[], patch: Partial<EditableMenuItem>) {
    if (path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const childIndex = path[path.length - 1]!.index;
    setItems((prev) =>
      updateAtPath(prev, parentPath, (siblings) =>
        siblings.map((item, i) => (i === childIndex ? { ...item, ...patch } : item))
      )
    );
  }

  function onSave() {
    if (!v.validate()) return;
    startTransition(async () => {
      const result = await saveMenu(location, {
        name,
        items: toWireItems(items) as never,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Could not save menu.');
        return;
      }
      toast.success('Menu saved.');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardBody>
          <h3 className="text-xl font-semibold">Menu name</h3>
          <p className="opacity-70">Internal label so editors recognise the menu in the listing.</p>
          <Field {...v.field('name')}>
            <FieldLabel required>Name</FieldLabel>
            <FieldControl
              name="menu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              {...v.control('name')}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Items</h3>
              <p className="opacity-70">
                {items.length} top-level item{items.length === 1 ? '' : 's'}
              </p>
            </div>
            <Button
              type="button"
              color="module"
              variant="outline"
              size="sm"
              iconStart={<Plus className="h-3.5 w-3.5" />}
              onClick={addRoot}
            >
              Add item
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="text-base-content/70">
              No items yet. Click &ldquo;Add item&rdquo; to start the tree.
            </p>
          ) : (
            <ItemList
              items={items}
              path={[]}
              entryChoices={entryChoices}
              onPatch={patchAt}
              onAddChild={addChild}
              onRemove={requestRemove}
              onMove={moveAt}
            />
          )}
        </CardBody>
      </Card>

      {/* The primary action teleports up into the shared detail chrome's footer,
          not floored at the bottom — a failed save surfaces as a toast since
          there's no room for a persistent error line there. */}
      <DetailFooterSlot>
        <Button
          type="button"
          size="sm"
          color="module"
          onClick={onSave}
          disabled={pending}
          loading={pending}
        >
          <AdaptiveLabel label={{ full: 'Save menu', short: 'Save' }} />
        </Button>
      </DetailFooterSlot>
    </div>
  );
}

function ItemList({
  items,
  path,
  entryChoices,
  onPatch,
  onAddChild,
  onRemove,
  onMove,
}: {
  items: EditableMenuItem[];
  path: PathStep[];
  entryChoices: EntryChoice[];
  onPatch: (path: PathStep[], patch: Partial<EditableMenuItem>) => void;
  onAddChild: (path: PathStep[]) => void;
  onRemove: (path: PathStep[]) => void;
  onMove: (path: PathStep[], delta: -1 | 1) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => {
        const itemPath: PathStep[] = [...path, { index }];
        return (
          <div key={item.uid} className="border-base-300 flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex flex-row items-end gap-2">
              <Field className="flex-1">
                <FieldLabel>Label</FieldLabel>
                <FieldControl
                  name={`label-${item.uid}`}
                  value={item.label}
                  onChange={(e) => onPatch(itemPath, { label: e.target.value })}
                  placeholder="Display label"
                />
              </Field>
              <div className="flex flex-row gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  iconStart={<ChevronUp className="h-3 w-3" />}
                  onClick={() => onMove(itemPath, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  Up
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  iconStart={<ChevronDown className="h-3 w-3" />}
                  onClick={() => onMove(itemPath, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Move down"
                >
                  Down
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  iconStart={<Trash2 className="h-3 w-3" />}
                  onClick={() => onRemove(itemPath)}
                  aria-label="Remove"
                >
                  Remove
                </Button>
              </div>
            </div>

            <div className="flex flex-row gap-3">
              <Field>
                <FieldLabel>Link kind</FieldLabel>
                <Select
                  id={`kind-${item.uid}`}
                  aria-label="Link kind"
                  value={item.kind}
                  onValueChange={(val) =>
                    onPatch(itemPath, {
                      kind: val as 'entry' | 'external',
                      // Clear the other side so the XOR constraint never breaks.
                      ...(val === 'entry' ? { externalUrl: '' } : { entryId: null }),
                    })
                  }
                  items={{ external: 'External URL', entry: 'CMS entry' }}
                />
              </Field>
              <div className="flex flex-1 flex-col gap-1">
                {item.kind === 'entry' ? (
                  <EntryField
                    id={`target-${item.uid}`}
                    value={item.entryId}
                    choices={entryChoices}
                    onChange={(entryId) => onPatch(itemPath, { entryId })}
                  />
                ) : (
                  <Field>
                    <FieldLabel>External URL</FieldLabel>
                    <FieldControl
                      name={`target-${item.uid}`}
                      type="url"
                      value={item.externalUrl ?? ''}
                      onChange={(e) => onPatch(itemPath, { externalUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </Field>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`new-tab-${item.uid}`}>New tab</Label>
                <Checkbox
                  id={`new-tab-${item.uid}`}
                  checked={item.openInNewTab}
                  onChange={(e) => onPatch(itemPath, { openInNewTab: e.target.checked })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-row items-center justify-between">
                <p className="text-base-content/70 text-xs">Children · {item.children.length}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  iconStart={<Plus className="h-3 w-3" />}
                  onClick={() => onAddChild(itemPath)}
                >
                  Add child
                </Button>
              </div>
              {item.children.length > 0 && (
                <div className="flex flex-col pl-6">
                  <ItemList
                    items={item.children}
                    path={itemPath}
                    entryChoices={entryChoices}
                    onPatch={onPatch}
                    onAddChild={onAddChild}
                    onRemove={onRemove}
                    onMove={onMove}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// EntryField — picker over the tenant's published entries with a typed
// fallback for entries that aren't in the prefetched 200-entry shortlist
// (tenants with more than that can still paste a UUID directly).
function EntryField({
  id,
  value,
  choices,
  onChange,
}: {
  id: string;
  value: string | null;
  choices: EntryChoice[];
  onChange: (entryId: string | null) => void;
}) {
  const [mode, setMode] = React.useState<'picker' | 'manual'>(
    value && !choices.some((c) => c.id === value) ? 'manual' : 'picker'
  );

  if (mode === 'manual') {
    return (
      <Field>
        <div className="flex flex-row items-end justify-between">
          <FieldLabel>Entry ID</FieldLabel>
          <Button
            type="button"
            color="primary"
            variant="link"
            size="xs"
            onClick={() => setMode('picker')}
            aria-label="Switch to entry picker"
          >
            Pick from list
          </Button>
        </div>
        <FieldControl
          name={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="UUID of a published content entry"
        />
      </Field>
    );
  }

  return (
    <Field>
      <div className="flex flex-row items-end justify-between">
        <FieldLabel>Published entry</FieldLabel>
        <Button
          type="button"
          color="primary"
          variant="link"
          size="xs"
          onClick={() => setMode('manual')}
          aria-label="Enter entry UUID manually"
        >
          Paste UUID
        </Button>
      </div>
      <Select
        id={id}
        aria-label="Published entry"
        placeholder="Choose a published entry…"
        value={value ?? ''}
        onValueChange={(val) => onChange((val as string) || null)}
      >
        {choices.length === 0 ? (
          <SelectItem value="__empty__" disabled>
            No published entries to pick from
          </SelectItem>
        ) : (
          choices.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.title}
              {c.slug ? ` · /${c.slug}` : ''}
            </SelectItem>
          ))
        )}
      </Select>
    </Field>
  );
}
