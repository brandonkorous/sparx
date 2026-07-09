'use client';

// The blueprint update changeset (docs/55 §11). Groups the diff by artifact:
// conflicts (expanded, each with Keep-mine / Take-theirs), auto fast-forwards
// (summarized), plus what's new and what's been removed upstream. Apply keeps the
// tenant's value on every conflict unless they flip it to the blueprint's.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';

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
        <CardBody>
          <p className="text-base-content/70">
            This install is already on the latest version — nothing to update.
          </p>
        </CardBody>
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
          takeTheirs.size > 0
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-row flex-wrap items-center gap-2">
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
      </div>

      {nothing ? (
        <Card>
          <CardBody>
            <p className="text-base-content/70">
              The new version makes no changes to anything on your site.
            </p>
          </CardBody>
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
        <div className="flex flex-row flex-wrap items-center gap-3">
          <Button color="primary" onClick={onApply} loading={pending} disabled={pending || nothing}>
            Update to v{plan.toVersion}
          </Button>
          <Button
            variant="ghost"
            render={<Link href={`/marketplace/installs/${installId}`}>Cancel</Link>}
          />
        </div>
      ) : (
        <p className="text-base-content/70 text-sm">Only an owner or admin can apply an update.</p>
      )}
    </div>
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
    <Card className={isConflict ? 'bg-module bg-soft' : undefined}>
      <CardBody>
        <div className="flex flex-row items-center justify-between gap-2">
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
        </div>
        <div className="flex flex-col gap-3">
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
            <p className="text-base-content/70 text-sm">
              {autos.length} other change{autos.length === 1 ? '' : 's'} the blueprint made
              {conflicts.length > 0 ? ' also' : ''} appl{autos.length === 1 ? 'ies' : 'y'}{' '}
              automatically.
            </p>
          ) : null}
        </div>
      </CardBody>
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
    <div className="border-base-300 flex flex-col gap-2 rounded-md border p-3">
      <p className="text-sm">{change.path}</p>
      <div className="flex flex-col gap-1">
        <p className="text-base-content/70 text-xs">
          Yours: <span className="text-base-content">{fmt(change.mine)}</span>
        </p>
        <p className="text-base-content/70 text-xs">
          Blueprint v{toVersion}: <span className="text-base-content">{fmt(change.theirs)}</span>
        </p>
      </div>
      <div className="flex flex-row gap-2">
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
      </div>
    </div>
  );
}

function InfoCard({ title, items, note }: { title: string; items: string[]; note: string }) {
  return (
    <Card>
      <CardBody>
        <CardTitle>{title}</CardTitle>
        <div className="flex flex-col gap-1">
          {items.map((it) => (
            <p key={it} className="text-sm">
              {it}
            </p>
          ))}
          <p className="text-base-content/70 pt-1 text-xs">{note}</p>
        </div>
      </CardBody>
    </Card>
  );
}
