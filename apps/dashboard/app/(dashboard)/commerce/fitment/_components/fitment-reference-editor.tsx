'use client';

// Generic, dimension-driven fitment tree editor. A domain declares an ordered
// list of DIMENSIONS (level tiers + range axes); this renders the level tiers as
// a lazily-loaded node tree of ANY depth — each level's label comes from the
// domain's dimensions, so the same component renders Make→Model→Engine for a
// vehicle shop and Species→Breed for a pet store. Every node supports inline
// rename + delete (cascades its subtree) + add-child; the domain supports
// uninstall. Range dimensions (Year, Weight) are shown in the header and set
// per-product on the product Fitment tab, not in this vocabulary tree.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Badge, Button, Input, Label, Stack, Text, toast, useConfirm } from '@sparx/ui';

import type { FitmentDimension, FitmentDomainRow, FitmentNodeRow } from '../../fitment-actions';
import {
  createFitmentNodeAction,
  deleteFitmentDomainAction,
  deleteFitmentNodeAction,
  listFitmentNodesAction,
  reorderFitmentNodesAction,
  updateFitmentNodeAction,
} from '../../fitment-actions';
import { pluralizeLabel } from './pluralize';

interface Props {
  domains: FitmentDomainRow[];
}

function levelDimensions(dimensions: FitmentDimension[]): FitmentDimension[] {
  return dimensions.filter((d) => d.kind === 'level');
}

function rangeDimensions(dimensions: FitmentDimension[]): FitmentDimension[] {
  return dimensions.filter((d) => d.kind === 'range');
}

export function FitmentReferenceEditor({ domains }: Props) {
  return (
    <Stack gap={2}>
      {domains.map((domain) => (
        <DomainBlock key={domain.id} domain={domain} />
      ))}
    </Stack>
  );
}

function DomainBlock({ domain }: { domain: FitmentDomainRow }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [expanded, setExpanded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const levels = levelDimensions(domain.dimensions);
  const ranges = rangeDimensions(domain.dimensions);
  const rootLabel = levels[0]?.label ?? 'item';

  async function onUninstall() {
    const ok = await confirm({
      title: `Uninstall "${domain.displayName}"?`,
      description:
        'This removes the entire vocabulary tree and clears it from any products that reference it. This cannot be undone.',
      confirmLabel: 'Uninstall',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const res = await deleteFitmentDomainAction(domain.id);
    setBusy(false);
    if (res.ok) {
      toast.success(`${domain.displayName} uninstalled`, {
        description:
          res.data.productsAffected > 0
            ? `${res.data.productsAffected} product(s) had their fitment cleared.`
            : undefined,
      });
      router.refresh();
    } else {
      toast.error("Couldn't uninstall", { description: res.error.message });
    }
  }

  return (
    <Stack
      gap={0}
      className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)]"
    >
      <Stack direction="row" align="center" gap={2} className="p-3">
        <Button
          shape="square"
          variant="ghost"
          size="sm"
          aria-label={expanded ? `Collapse ${domain.displayName}` : `Expand ${domain.displayName}`}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <Boxes className="h-4 w-4 text-[var(--color-text-muted)]" />
        <Stack gap={0} className="flex-1">
          <Text size="sm" weight="medium">
            {domain.displayName}
          </Text>
          <Text size="xs" variant="muted">
            {levels.map((l) => l.label).join(' → ')}
            {ranges.length > 0 ? ` · narrow by ${ranges.map((r) => r.label).join(', ')}` : ''}
          </Text>
        </Stack>
        <Badge color="module" variant="soft" size="sm">
          {domain.rootCount} {pluralizeLabel(rootLabel.toLowerCase(), domain.rootCount)}
        </Badge>
        <Button
          shape="square"
          variant="ghost"
          size="sm"
          title="Uninstall dictionary"
          aria-label={`Uninstall ${domain.displayName}`}
          loading={busy}
          onClick={() => void onUninstall()}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </Stack>
      {expanded && (
        <div className="px-3 pb-3 pl-8">
          <NodeChildren domainId={domain.id} parentId={null} levels={levels} depth={0} />
        </div>
      )}
    </Stack>
  );
}

/** Lazily loads + renders the children of `parentId` (top-level when null). */
function NodeChildren({
  domainId,
  parentId,
  levels,
  depth,
}: {
  domainId: string;
  parentId: string | null;
  levels: FitmentDimension[];
  depth: number;
}) {
  const [nodes, setNodes] = React.useState<FitmentNodeRow[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const levelLabel = levels[depth]?.label ?? 'item';
  // Drag whole row to reorder siblings; the 6px activation distance keeps the
  // rename/expand/delete buttons clickable.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const reload = React.useCallback(async () => {
    setLoading(true);
    const res = await listFitmentNodesAction(domainId, parentId);
    if (res.ok) setNodes(res.data);
    setLoading(false);
  }, [domainId, parentId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !nodes) return;
    const oldIdx = nodes.findIndex((n) => n.id === active.id);
    const newIdx = nodes.findIndex((n) => n.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(nodes, oldIdx, newIdx);
    setNodes(next); // optimistic
    const res = await reorderFitmentNodesAction({
      domainId,
      parentId,
      orderedIds: next.map((n) => n.id),
    });
    if (!res.ok) {
      toast.error("Couldn't reorder", { description: res.error.message });
      void reload(); // revert to server order
    }
  }

  return (
    <Stack gap={1}>
      {loading && nodes === null && (
        <Text size="xs" variant="muted">
          Loading {pluralizeLabel(levelLabel.toLowerCase(), 2)}…
        </Text>
      )}
      {nodes && nodes.length > 0 && (
        <DndContext
          id={`fitment-${domainId}-${parentId ?? 'root'}`}
          sensors={sensors}
          onDragEnd={(e) => void onDragEnd(e)}
        >
          <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            {nodes.map((node) => (
              <NodeRow key={node.id} node={node} levels={levels} depth={depth} onChanged={reload} />
            ))}
          </SortableContext>
        </DndContext>
      )}
      <AddNodeForm domainId={domainId} parentId={parentId} label={levelLabel} onAdded={reload} />
    </Stack>
  );
}

function NodeRow({
  node,
  levels,
  depth,
  onChanged,
}: {
  node: FitmentNodeRow;
  levels: FitmentDimension[];
  depth: number;
  onChanged: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const hasChildren = depth + 1 < levels.length;
  const [expanded, setExpanded] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  async function onDelete() {
    const ok = await confirm({
      title: `Delete "${node.name}"?`,
      description: hasChildren
        ? 'This removes it and everything nested under it, and clears it from any products that reference it.'
        : 'This clears it from any products that reference it.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const res = await deleteFitmentNodeAction(node.id);
    setBusy(false);
    if (res.ok) {
      toast.success(`"${node.name}" deleted`, {
        description:
          res.data.productsAffected > 0
            ? `${res.data.productsAffected} product(s) had their fitment cleared.`
            : undefined,
      });
      onChanged();
      router.refresh();
    } else {
      toast.error("Couldn't delete", { description: res.error.message });
    }
  }

  return (
    <Stack
      ref={setNodeRef}
      style={style}
      gap={0}
      className="border-b border-[var(--color-border-default)] last:border-b-0"
    >
      {editing ? (
        <RenameForm
          node={node}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      ) : (
        <Stack
          direction="row"
          align="center"
          gap={1}
          className="cursor-grab py-2 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
          {hasChildren ? (
            <Button
              shape="square"
              variant="ghost"
              size="sm"
              aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <span className="inline-block h-4 w-4" />
          )}
          <Text size="sm" className="flex-1">
            {node.name}
          </Text>
          <Text size="xs" variant="muted">
            /{node.slug}
          </Text>
          <Button
            shape="square"
            variant="ghost"
            size="sm"
            title="Rename"
            aria-label={`Rename ${node.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            shape="square"
            variant="ghost"
            size="sm"
            title="Delete"
            aria-label={`Delete ${node.name}`}
            loading={busy}
            onClick={() => void onDelete()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Stack>
      )}
      {expanded && hasChildren && (
        <div className="pb-2 pl-8">
          <NodeChildren
            domainId={node.domainId}
            parentId={node.id}
            levels={levels}
            depth={depth + 1}
          />
        </div>
      )}
    </Stack>
  );
}

function RenameForm({
  node,
  onCancel,
  onSaved,
}: {
  node: FitmentNodeRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(node.name);
  const [slug, setSlug] = React.useState(node.slug);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  // Focus + select the name on mount (replaces the autoFocus prop the a11y lint
  // rule forbids), for quick replace.
  React.useEffect(() => {
    nameInputRef.current?.select();
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const nextName = name.trim();
    const nextSlug = slug.trim().toLowerCase();
    if (!nextName || !nextSlug) {
      setError('Name and slug are required.');
      return;
    }
    startTransition(async () => {
      const res = await updateFitmentNodeAction(node.id, { name: nextName, slug: nextSlug });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      onSaved();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="py-2">
      <Stack direction="row" gap={2} align="end" wrap>
        <Stack gap={1} className="min-w-[180px] flex-1">
          <Label htmlFor={`rename-name-${node.id}`}>Name</Label>
          <Input
            id={`rename-name-${node.id}`}
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="sm"
          />
        </Stack>
        <Stack gap={1} className="min-w-[140px] flex-1">
          <Label htmlFor={`rename-slug-${node.id}`}>Slug</Label>
          <Input
            id={`rename-slug-${node.id}`}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            size="sm"
          />
        </Stack>
        <Button
          shape="square"
          type="submit"
          color="module"
          variant="soft"
          size="sm"
          title="Save"
          aria-label="Save"
          loading={pending}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          shape="square"
          type="button"
          variant="ghost"
          size="sm"
          title="Cancel"
          aria-label="Cancel"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </Stack>
      {error && (
        <Text size="xs" variant="danger" className="mt-2" role="alert">
          {error}
        </Text>
      )}
    </form>
  );
}

function AddNodeForm({
  domainId,
  parentId,
  label,
  onAdded,
}: {
  domainId: string;
  parentId: string | null;
  label: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  // Focus the name when the form opens (replaces the autoFocus prop the a11y
  // lint rule forbids).
  React.useEffect(() => {
    if (open) nameInputRef.current?.focus();
  }, [open]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const nextName = name.trim();
    const nextSlug = (slug.trim() || nextName)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    if (!nextName || !nextSlug) {
      setError('Name is required.');
      return;
    }
    startTransition(async () => {
      const res = await createFitmentNodeAction({
        domainId,
        parentId,
        // dimensionKey is authoritative server-side (derived from depth); send a
        // placeholder so the schema accepts the body.
        dimensionKey: 'level',
        name: nextName,
        slug: nextSlug,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setName('');
      setSlug('');
      setOpen(false);
      onAdded();
    });
  }

  return (
    <Stack
      gap={2}
      className="rounded border border-dashed border-[var(--color-border-default)] p-2"
    >
      <Stack direction="row" align="center" justify="between">
        <Text size="xs" variant="muted">
          Add a {label.toLowerCase()}
        </Text>
        <Button
          type="button"
          color="neutral"
          variant={open ? 'ghost' : 'outline'}
          size="sm"
          onClick={() => setOpen((v) => !v)}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          {open ? 'Cancel' : `New ${label.toLowerCase()}`}
        </Button>
      </Stack>
      {open && (
        <form onSubmit={onSubmit} noValidate>
          <Stack direction="row" gap={2} align="end" wrap>
            <Stack gap={1} className="min-w-[180px] flex-1">
              <Label htmlFor={`add-name-${parentId ?? domainId}`}>{label} name</Label>
              <Input
                id={`add-name-${parentId ?? domainId}`}
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                size="sm"
              />
            </Stack>
            <Stack gap={1} className="min-w-[140px] flex-1">
              <Label htmlFor={`add-slug-${parentId ?? domainId}`}>Slug (optional)</Label>
              <Input
                id={`add-slug-${parentId ?? domainId}`}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                size="sm"
                placeholder="auto from name"
              />
            </Stack>
            <Button type="submit" color="module" disabled={pending} loading={pending}>
              Add
            </Button>
          </Stack>
          {error && (
            <Text size="xs" variant="danger" className="mt-2" role="alert">
              {error}
            </Text>
          )}
        </form>
      )}
    </Stack>
  );
}
