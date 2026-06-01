'use client';

// The unified Layouts surface (docs/36 §11, P-D). ONE screen, organized by
// target, that folds the old per-scope nav (Homepage / Product pages /
// Collection pages / Pages) into a single grouped index. Per target it lists the
// tenant's PageLayouts, offers a "begin from a Page Template" catalog (code-first,
// §10), and exposes the per-target default control. A row opens the canvas editor
// at /sitebuilder/layouts/<id>.
//
// Full-width (NOT a canvas scope — the editor-shell renders it in the inspector
// column full-width); the visual idiom matches the rest of Site Builder —
// `Card variant="module"` group containers + bordered layout rows + module-color
// Default badges.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Heading,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Stack,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { pageTemplatesForTarget } from '@sparx/sitebuilder-schemas';
import {
  clearLayoutDefault,
  deletePageLayout,
  instantiateLayout,
  materializeLayout,
  renamePageLayout,
  setLayoutDefault,
} from '../_lib/actions';

export interface LayoutRowData {
  id: string;
  key: string;
  name: string;
}

export interface TargetGroupData {
  targetId: string;
  label: string;
  binding: 'product' | 'collection' | null;
  layouts: LayoutRowData[];
  /** The per-target default layout id (SiteLayoutDefault), or null. */
  defaultLayoutId: string | null;
}

type Kind = 'home' | 'bound' | 'pages';

function kindOf(targetId: string): Kind {
  if (targetId === 'site:home') return 'home';
  if (targetId === 'cms:content-page') return 'pages';
  return 'bound';
}

export function LayoutsIndex({ groups }: { groups: TargetGroupData[] }) {
  return (
    <Stack gap={6}>
      <div>
        <Heading level={1}>Layouts</Heading>
        <Text variant="muted">
          Design a layout for each kind of page, set a default per kind, and override individual
          items where you want to. Bound sections fill in each item&apos;s own details
          automatically.
        </Text>
      </div>
      {groups.map((group) => (
        <TargetGroup key={group.targetId} group={group} />
      ))}
    </Stack>
  );
}

function TargetGroup({ group }: { group: TargetGroupData }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [picking, setPicking] = React.useState(false);
  const [namingPage, setNamingPage] = React.useState(false);
  const [renaming, setRenaming] = React.useState<LayoutRowData | null>(null);

  const kind = kindOf(group.targetId);
  const noun = group.binding ?? 'page';
  const hasDefaultKey = group.layouts.some((l) => l.key === 'default');

  // Which layout renders by default for this target: the explicit per-target
  // default, else the `default`-key layout (the storefront resolver's fallback).
  const isDefault = (l: LayoutRowData) =>
    group.defaultLayoutId ? l.id === group.defaultLayoutId : l.key === 'default';

  const go = (id: string) => router.push(`/sitebuilder/layouts/${id}`);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, fail: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? fail);
      else router.refresh();
    });

  const onInstantiate = (templateId: string) => {
    setPicking(false);
    startTransition(async () => {
      const res = await instantiateLayout({ targetId: group.targetId, templateId });
      if (!res.ok || !res.data) toast.error(res.error ?? 'Could not create the layout.');
      else go(res.data.pageLayout.id);
    });
  };

  const onCustomizeBuiltIn = () =>
    startTransition(async () => {
      const res = await materializeLayout({ targetId: group.targetId });
      if (!res.ok || !res.data) toast.error(res.error ?? 'Could not start customizing.');
      else go(res.data.pageLayout.id);
    });

  const onNewPage = (slug: string) => {
    setNamingPage(false);
    const clean = slug.trim().replace(/^\/+|\/+$/g, '');
    if (!clean) return;
    const existing = group.layouts.find((l) => l.key === clean);
    if (existing) {
      go(existing.id);
      return;
    }
    startTransition(async () => {
      const res = await instantiateLayout({
        targetId: group.targetId,
        templateId: 'blank',
        name: clean,
        key: clean,
      });
      if (!res.ok || !res.data) toast.error(res.error ?? 'Could not create the page.');
      else go(res.data.pageLayout.id);
    });
  };

  const onDelete = async (l: LayoutRowData) => {
    const ok = await confirm({
      title: `Delete “${l.name}”?`,
      description:
        'This removes the layout and its sections. Any item or default pointing at it falls back to the standard layout. This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete layout',
    });
    if (!ok) return;
    act(() => deletePageLayout(l.id), 'Could not delete the layout.');
  };

  return (
    <Card variant="module" padding="md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Heading level={3}>{group.label}</Heading>
          <Text size="sm" variant="muted">
            {kind === 'home'
              ? 'Your storefront homepage.'
              : kind === 'pages'
                ? 'Standalone section-based pages, each at its own URL.'
                : `One layout per ${noun} by default; add alternates and assign them per ${noun}.`}
          </Text>
        </div>
        {kind === 'bound' ? (
          <Button
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setPicking(true)}
          >
            New layout
          </Button>
        ) : kind === 'pages' ? (
          <Button
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setNamingPage(true)}
          >
            New page
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        {/* Bound target with no customized default yet: the built-in default is
            active — offer to customize it (mirrors the old "Customize this layout"). */}
        {kind === 'bound' && !hasDefaultKey ? (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-2.5">
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                Standard {noun} layout
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Every {noun} uses the built-in layout until you customize it.
              </span>
            </span>
            <Button size="sm" variant="soft" onClick={onCustomizeBuiltIn} disabled={pending}>
              Customize
            </Button>
          </div>
        ) : null}

        {group.layouts.length === 0 && (kind === 'pages' || (kind === 'bound' && hasDefaultKey)) ? (
          <EmptyState
            title={kind === 'pages' ? 'No pages yet' : 'No layouts yet'}
            description={
              kind === 'pages'
                ? 'Create a page to compose sections at its own URL.'
                : 'Add a layout to start composing.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {group.layouts.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-default)] px-3 py-2.5"
              >
                <button type="button" onClick={() => go(l.id)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {l.name}
                    </span>
                    {isDefault(l) ? (
                      <Badge color="module" variant="soft" size="sm">
                        Default
                      </Badge>
                    ) : null}
                    {l.key !== 'default' ? (
                      <span className="truncate font-mono text-xs text-[var(--color-text-muted)]">
                        {kind === 'pages' ? `/${l.key}` : l.key}
                      </span>
                    ) : null}
                  </span>
                </button>

                <Button size="sm" variant="ghost" onClick={() => go(l.id)} disabled={pending}>
                  Edit
                </Button>
                {kind === 'bound' && !isDefault(l) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      act(
                        () => setLayoutDefault(group.targetId, l.id),
                        'Could not set the default.'
                      )
                    }
                    disabled={pending}
                  >
                    Set as default
                  </Button>
                ) : null}
                {kind !== 'home' ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Rename ${l.name}`}
                      onClick={() => setRenaming(l)}
                      disabled={pending}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${l.name}`}
                      onClick={() => void onDelete(l)}
                      disabled={pending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* Per-target default explicitly pinned to a named layout: a quick revert
            to the standard layout (clears the override). */}
        {kind === 'bound' && group.defaultLayoutId ? (
          <button
            type="button"
            onClick={() =>
              act(() => clearLayoutDefault(group.targetId), 'Could not reset the default.')
            }
            disabled={pending}
            className="mt-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Reset to the standard {noun} layout
          </button>
        ) : null}
      </div>

      {/* New-layout template catalog (bound targets). */}
      <TemplatePicker
        open={picking}
        onOpenChange={setPicking}
        targetId={group.targetId}
        onPick={onInstantiate}
        pending={pending}
      />

      {/* New-page slug prompt (cms:content-page). */}
      <NewPagePrompt open={namingPage} onOpenChange={setNamingPage} onSubmit={onNewPage} />

      {/* Rename. */}
      <RenamePrompt
        layout={renaming}
        onOpenChange={(open) => !open && setRenaming(null)}
        onSubmit={(name) => {
          const target = renaming;
          setRenaming(null);
          if (target) act(() => renamePageLayout(target.id, name), 'Could not rename the layout.');
        }}
      />
    </Card>
  );
}

function TemplatePicker({
  open,
  onOpenChange,
  targetId,
  onPick,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  onPick: (templateId: string) => void;
  pending: boolean;
}) {
  const templates = React.useMemo(() => pageTemplatesForTarget(targetId), [targetId]);
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Begin from a Page Template</ModalTitle>
        </ModalHeader>
        <Text size="sm" variant="muted">
          Pick a starting point. You can rename, reorder, and edit every section afterward.
        </Text>
        <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto py-2 sm:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={pending}
              onClick={() => onPick(t.id)}
              className="flex flex-col gap-1 rounded-lg border border-[var(--color-border-default)] p-3 text-left transition-colors hover:border-[var(--module-active)] hover:bg-[var(--color-bg-subtle)] disabled:opacity-60"
            >
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t.name}
                </span>
                {t.binding ? (
                  <Badge color="module" variant="soft" size="sm">
                    Bound
                  </Badge>
                ) : null}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">{t.description}</span>
            </button>
          ))}
        </div>
      </ModalContent>
    </Modal>
  );
}

function NewPagePrompt({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (slug: string) => void;
}) {
  const [slug, setSlug] = React.useState('');
  React.useEffect(() => {
    if (open) setSlug('');
  }, [open]);
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>New page</ModalTitle>
        </ModalHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sb-new-page-slug">Page URL</Label>
          <Input
            id="sb-new-page-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. about, lookbook, deals"
            onKeyDown={(e) => e.key === 'Enter' && onSubmit(slug)}
          />
          <Text size="xs" variant="muted">
            This page renders at <span className="font-mono">/{slug.trim() || 'slug'}</span>.
          </Text>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(slug)} disabled={!slug.trim()}>
            Create page
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function RenamePrompt({
  layout,
  onOpenChange,
  onSubmit,
}: {
  layout: LayoutRowData | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = React.useState('');
  React.useEffect(() => {
    if (layout) setName(layout.name);
  }, [layout]);
  return (
    <Modal open={layout !== null} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Rename layout</ModalTitle>
        </ModalHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sb-rename-layout">Name</Label>
          <Input
            id="sb-rename-layout"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSubmit(name.trim())}
          />
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(name.trim())} disabled={!name.trim()}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
