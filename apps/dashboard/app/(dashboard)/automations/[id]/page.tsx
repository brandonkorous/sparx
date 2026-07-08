// Automation detail / review (docs/81 §8, docs/84 Slice G-UI). A read view of the
// rule — trigger, conditions, the ordered action list — plus a recent-runs
// preview. Edits happen on the /edit builder; the action bar (client) carries
// Edit / Pause / Duplicate / Delete (a LOCKED rule shows only "Duplicate to
// edit" + View runs). The visual review is server-rendered from the canonical
// schema parsers.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Workflow } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Card, CardBody, CardTitle } from 'silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { AutomationDto, RunDto } from '../_lib/types';
import {
  ActionListView,
  AutomationStatusBadge,
  ConditionGroupView,
  ModuleTags,
  OriginBadge,
  RunStatusBadge,
  formatTimestamp,
  parseActions,
  parseConditions,
  parseTrigger,
  summarizeTrigger,
} from '../_lib/presentation';
import { AutomationActions } from '../_components/automation-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AutomationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  const role = session.user.role;
  const canWrite = role === 'owner' || role === 'admin' || role === 'editor';

  let automation: AutomationDto;
  try {
    automation = await api.get<AutomationDto>(`/v1/automations/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const runs = await api.get<RunDto[]>(`/v1/automations/${id}/runs?limit=5`).catch(() => []);

  const trigger = parseTrigger(automation.triggerType, automation.triggerConfig);
  const conditions = parseConditions(automation.conditions);
  const actions = parseActions(automation.actions);

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<Workflow className="h-5 w-5" />}
          title={automation.name}
          badge={
            <span className="flex items-center gap-2">
              <AutomationStatusBadge status={automation.status} />
              <OriginBadge origin={automation.origin} locked={automation.locked} />
            </span>
          }
          description={
            <div className="flex flex-col gap-1">
              {automation.description ? <span>{automation.description}</span> : null}
              <ModuleTags
                trigger={{
                  triggerType: automation.triggerType,
                  triggerConfig: automation.triggerConfig,
                }}
                actions={actions}
              />
            </div>
          }
          actions={<AutomationActions automation={automation} canWrite={canWrite} />}
        />

        {automation.locked && (
          <Card className="bg-module bg-soft">
            <CardBody>
              <p className="text-sm">
                This is a platform-managed automation. It can’t be edited or paused —{' '}
                <strong>Duplicate to edit</strong> forks an editable copy you own.
              </p>
            </CardBody>
          </Card>
        )}

        {automation.draft && !automation.locked && (
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                This automation has <strong>unpublished changes</strong>. The live version (v
                {automation.version}) keeps running until you publish.
              </p>
              <Link
                href={`/automations/${automation.id}/edit`}
                className="text-sm font-semibold text-[var(--module-active)] hover:underline"
              >
                Review &amp; publish →
              </Link>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <CardTitle>Trigger</CardTitle>
            <div className="flex flex-col gap-3">
              <p className="text-base">
                {summarizeTrigger(automation.triggerType, automation.triggerConfig)}
              </p>
              {trigger?.kind === 'schedule' && trigger.predicate.where.conditions.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-base-content/70 text-sm">Scans rows where:</p>
                  <ConditionGroupView group={trigger.predicate.where} />
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle>Conditions</CardTitle>
            <ConditionGroupView group={conditions} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle>Actions</CardTitle>
            <ActionListView actions={actions} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle>
              <span className="flex items-center justify-between gap-3">
                Recent runs
                <Link
                  href={`/automations/${automation.id}/runs`}
                  className="text-sm font-normal text-[var(--module-active)] hover:underline"
                >
                  View all
                </Link>
              </span>
            </CardTitle>
            {runs.length === 0 ? (
              <p className="text-base-content/70 text-sm">No runs yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {runs.map((run) => (
                  <Link
                    key={run.id}
                    href={`/automations/${automation.id}/runs/${run.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-border-default)] px-3 py-2 hover:bg-[var(--color-bg-subtle)]"
                  >
                    <span className="flex items-center gap-3">
                      <RunStatusBadge status={run.status} />
                      <span className="text-base-content/70 text-sm">
                        {formatTimestamp(run.startedAt)}
                      </span>
                    </span>
                    <span className="text-base-content/70 text-sm">
                      {run.automationVersion != null ? `v${run.automationVersion} · ` : ''}
                      {run.actionsTotal} step{run.actionsTotal === 1 ? '' : 's'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
