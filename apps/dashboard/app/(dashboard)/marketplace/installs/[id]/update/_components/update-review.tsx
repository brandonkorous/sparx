'use client';

// The blueprint update changeset (docs/55 §11). Groups the diff by artifact:
// conflicts (expanded, each with Keep-mine / Take-theirs), auto fast-forwards
// (summarized), plus what's new and what's been removed upstream. Apply keeps the
// tenant's value on every conflict unless they flip it to the blueprint's.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Stack,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';

import { applyUpdateAction } from '../../../../actions';
import type { UpdateArtifactDiff, UpdateFieldChange, UpdatePlan } from '../_types';

const KIND_LABEL: Record<string, string> = {
  theme: 'Theme',
  brand: 'Brand',
  layout: 'Layout',
  page: 'Page',
  email: 'Email',
  component: 'Component',
  product: 'Product',
  category: 'Category',
  collection: 'Collection',
  content: 'Content',
};

function fmt(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'none';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

interface Props {
  installId: string;
  blueprintName: string;
  plan: UpdatePlan;
  canManage: boolean;
}

export function UpdateReview({ installId, blueprintName, plan, canManage }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [takeTheirs, setTakeTheirs] = React.useState<Set<string>>(new Set());

  const setSide = (id: string, theirs: boolean): void =>
    setTakeTheirs((prev) => {
      const next = new Set(prev);
      if (theirs) next.add(id);
      else next.delete(id);
      return next;
    });

  if (!plan.updatable) {
    return (
      <Card>
        <CardContent>
          <Text variant="muted">
            This install is already on the latest version — nothing to update.
          </Text>
        </CardContent>
      </Card>
    );
  }

  const changed = plan.artifacts.filter((a) => a.status === 'updated' || a.status === 'conflict');
  const created = plan.artifacts.filter((a) => a.status === 'new');
  const removed = plan.artifacts.filter((a) => a.status === 'removed');
  const nothing = changed.length === 0 && created.length === 0 && removed.length === 0;

  function onApply(): void {
    if (!canManage) return;
    void (async () => {
      const ok = await confirm({
        title: `Update “${blueprintName}” to v${plan.toVersion}?`,
        description:
          plan.summary.conflicts > 0
            ? `Applies the blueprint's changes. Your edits are kept, except the ${takeTheirs.size} conflict${takeTheirs.size === 1 ? '' : 's'} you set to the blueprint's version.`
            : "Applies the blueprint's changes. Your edits are kept.",
        confirmLabel: 'Update',
        tone: 'module',
      });
      if (!ok) return;
      startTransition(async () => {
        const res = await applyUpdateAction(installId, [...takeTheirs]);
        if (res.ok) {
          toast.success(`Updated to v${res.data.toVersion}`, {
            description: `${res.data.applied} change${res.data.applied === 1 ? '' : 's'} applied.`,
          });
          router.push(`/marketplace/installs/${installId}`);
        } else {
          toast.error("Couldn't update", { description: res.error.message });
        }
      });
    })();
  }

  return (
    <Stack gap={5}>
      <Stack direction="row" gap={2} align="center" className="flex-wrap">
        <Badge variant="soft">{plan.summary.auto} automatic</Badge>
        {plan.summary.conflicts > 0 ? (
          <Badge color="warning" variant="soft">
            {plan.summary.conflicts} conflict{plan.summary.conflicts === 1 ? '' : 's'}
          </Badge>
        ) : null}
        {created.length > 0 ? (
          <Badge color="success" variant="soft">
            {created.length} new
          </Badge>
        ) : null}
        {removed.length > 0 ? (
          <Badge variant="outline">{removed.length} removed upstream</Badge>
        ) : null}
      </Stack>

      {nothing ? (
        <Card>
          <CardContent>
            <Text variant="muted">The new version makes no changes to anything on your site.</Text>
          </CardContent>
        </Card>
      ) : null}

      {changed.map((a) => (
        <ArtifactCard
          key={`${a.kind}:${a.naturalKey}`}
          artifact={a}
          takeTheirs={takeTheirs}
          onSetSide={setSide}
          toVersion={plan.toVersion}
        />
      ))}

      {created.length > 0 ? (
        <InfoCard
          title="New in this version"
          items={created.map((a) => `${KIND_LABEL[a.kind] ?? a.kind} · ${a.naturalKey}`)}
          note="Items the blueprint added since you installed. Your existing content is updated above; adding these new items in place is coming next."
        />
      ) : null}
      {removed.length > 0 ? (
        <InfoCard
          title="No longer in this blueprint"
          items={removed.map((a) => `${KIND_LABEL[a.kind] ?? a.kind} · ${a.naturalKey}`)}
          note="Kept on your site — the update never deletes them. Remove them yourself if you want."
        />
      ) : null}

      {canManage ? (
        <Stack direction="row" gap={3} align="center" className="flex-wrap">
          <Button color="primary" onClick={onApply} loading={pending} disabled={pending || nothing}>
            Update to v{plan.toVersion}
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/marketplace/installs/${installId}`}>Cancel</Link>
          </Button>
        </Stack>
      ) : (
        <Text size="sm" variant="muted">
          Only an owner or admin can apply an update.
        </Text>
      )}
    </Stack>
  );
}

function ArtifactCard({
  artifact,
  takeTheirs,
  onSetSide,
  toVersion,
}: {
  artifact: UpdateArtifactDiff;
  takeTheirs: Set<string>;
  onSetSide: (id: string, theirs: boolean) => void;
  toVersion: string;
}) {
  const conflicts = artifact.changes.filter((c) => c.type === 'conflict');
  const autos = artifact.changes.filter((c) => c.type === 'auto');
  const isConflict = artifact.status === 'conflict';
  return (
    <Card variant={isConflict ? 'module' : undefined}>
      <CardHeader>
        <Stack direction="row" align="center" gap={2} className="justify-between">
          <CardTitle>
            {KIND_LABEL[artifact.kind] ?? artifact.kind} · {artifact.naturalKey}
          </CardTitle>
          {isConflict ? (
            <Badge color="warning" variant="soft">
              {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}
            </Badge>
          ) : (
            <Badge variant="soft">
              {autos.length} update{autos.length === 1 ? '' : 's'}
            </Badge>
          )}
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={3}>
          {conflicts.map((c) => (
            <ConflictRow
              key={c.id}
              change={c}
              takingTheirs={takeTheirs.has(c.id)}
              onSetSide={onSetSide}
              toVersion={toVersion}
            />
          ))}
          {autos.length > 0 ? (
            <Text size="sm" variant="muted">
              {autos.length} other change{autos.length === 1 ? '' : 's'} the blueprint made
              {conflicts.length > 0 ? ' also' : ''} appl{autos.length === 1 ? 'ies' : 'y'}{' '}
              automatically.
            </Text>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ConflictRow({
  change,
  takingTheirs,
  onSetSide,
  toVersion,
}: {
  change: UpdateFieldChange;
  takingTheirs: boolean;
  onSetSide: (id: string, theirs: boolean) => void;
  toVersion: string;
}) {
  return (
    <Stack gap={2} className="rounded-md border border-[var(--color-border)] p-3">
      <Text size="sm">{change.path}</Text>
      <Stack gap={1}>
        <Text size="xs" variant="muted">
          Yours: <span className="text-[var(--color-text-primary)]">{fmt(change.mine)}</span>
        </Text>
        <Text size="xs" variant="muted">
          Blueprint v{toVersion}:{' '}
          <span className="text-[var(--color-text-primary)]">{fmt(change.theirs)}</span>
        </Text>
      </Stack>
      <Stack direction="row" gap={2}>
        <Button
          size="sm"
          variant={takingTheirs ? 'outline' : 'soft'}
          color={takingTheirs ? 'neutral' : 'primary'}
          onClick={() => onSetSide(change.id, false)}
        >
          Keep mine
        </Button>
        <Button
          size="sm"
          variant={takingTheirs ? 'soft' : 'outline'}
          color={takingTheirs ? 'primary' : 'neutral'}
          onClick={() => onSetSide(change.id, true)}
        >
          Take theirs
        </Button>
      </Stack>
    </Stack>
  );
}

function InfoCard({ title, items, note }: { title: string; items: string[]; note: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack gap={1}>
          {items.map((it) => (
            <Text key={it} size="sm">
              {it}
            </Text>
          ))}
          <Text size="xs" variant="muted" className="pt-1">
            {note}
          </Text>
        </Stack>
      </CardContent>
    </Card>
  );
}
