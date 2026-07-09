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

import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Input,
} from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

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
    <div className="flex flex-col gap-2">
      {domains.map((domain) => (
        <DomainBlock key={domain.id} domain={domain} />
      ))}
    </div>
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
    <div className="border-base-300 bg-base-200 flex flex-col gap-0 rounded border">
      <div className="flex flex-row items-center gap-2 p-3">
        <Button
          shape="square"
          variant="ghost"
          size="sm"
          aria-label={expanded ? `Collapse ${domain.displayName}` : `Expand ${domain.displayName}`}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <Boxes className="text-base-content/60 h-4 w-4" />
        <div className="flex flex-1 flex-col gap-0">
          <p className="text-sm font-medium">{domain.displayName}</p>
          <p className="text-base-content/70 text-xs">
            {levels.map((l) => l.label).join(' → ')}
            {ranges.length > 0 ? ` · narrow by ${ranges.map((r) => r.label).join(', ')}` : ''}
          </p>
        </div>
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
      </div>
      {expanded && (
        <div className="px-3 pb-3 pl-8">
          <NodeChildren domainId={domain.id} parentId={null} levels={levels} depth={0} />
        </div>
      )}
    </div>
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
    <div className="flex flex-col gap-1">
      {loading && nodes === null && (
        <p className="text-base-content/70 text-xs">
          Loading {pluralizeLabel(levelLabel.toLowerCase(), 2)}…
        </p>
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
    </div>
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
    <div
      ref={setNodeRef}
      style={style}
      className="border-base-300 flex flex-col gap-0 border-b last:border-b-0"
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
        <div
          className="flex cursor-grab flex-row items-center gap-1 py-2 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="text-base-content/50 h-4 w-4 shrink-0" />
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
          <p className="flex-1 text-sm">{node.name}</p>
          <p className="text-base-content/70 text-xs">/{node.slug}</p>
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
        </div>
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
    </div>
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

  const v = useFieldValidation(
    { name, slug },
    {
      name: rule.required('Name is required.'),
      slug: rule.required('Slug is required.'),
    }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;
    const nextName = name.trim();
    const nextSlug = slug.trim().toLowerCase();
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
      <div className="flex flex-row flex-wrap items-end gap-2">
        <Field {...v.field('name')} className="min-w-[180px] flex-1">
          <FieldLabel required>Name</FieldLabel>
          <FieldControl
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            {...v.control('name')}
            render={<Input ref={nameInputRef} size="sm" />}
          />
        </Field>
        <Field {...v.field('slug')} className="min-w-[140px] flex-1">
          <FieldLabel required>Slug</FieldLabel>
          <FieldControl
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            {...v.control('slug')}
            render={<Input size="sm" />}
          />
        </Field>
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
      </div>
      {error && (
        <FieldStatus
          status="error"
          attached={false}
          role="alert"
          aria-live="polite"
          className="mt-2"
        >
          {error}
        </FieldStatus>
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

  // Name is required; the slug auto-derives from the name when left blank.
  const v = useFieldValidation({ name }, { name: rule.required('Name is required.') });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;
    const nextName = name.trim();
    const nextSlug = (slug.trim() || nextName)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
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
    <div className="border-base-300 flex flex-col gap-2 rounded border border-dashed p-2">
      <div className="flex flex-row items-center justify-between">
        <p className="text-base-content/70 text-xs">Add a {label.toLowerCase()}</p>
        <Button
          type="button"
          color="neutral"
          variant={open ? 'ghost' : 'outline'}
          size="sm"
          onClick={() => setOpen((v) => !v)}
          iconStart={<Plus className="h-3.5 w-3.5" />}
        >
          {open ? 'Cancel' : `New ${label.toLowerCase()}`}
        </Button>
      </div>
      {open && (
        <form onSubmit={onSubmit} noValidate>
          <div className="flex flex-row flex-wrap items-end gap-2">
            <Field {...v.field('name')} className="min-w-[180px] flex-1">
              <FieldLabel required>{label} name</FieldLabel>
              <FieldControl
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                {...v.control('name')}
                render={<Input ref={nameInputRef} size="sm" />}
              />
            </Field>
            <Field className="min-w-[140px] flex-1">
              <FieldLabel>Slug (optional)</FieldLabel>
              <FieldControl
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto from name"
                render={<Input size="sm" />}
              />
            </Field>
            <Button type="submit" color="module" disabled={pending} loading={pending}>
              Add
            </Button>
          </div>
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              role="alert"
              aria-live="polite"
              className="mt-2"
            >
              {error}
            </FieldStatus>
          )}
        </form>
      )}
    </div>
  );
}
