'use client';

import { Badge, Timestamp } from '@wizeworks/silicaui-react';
import { faExclamationTriangle } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  automationState,
  ModuleTags,
  parseActions,
  summarizeTrigger,
  TierBadge,
} from '../automations-presentation';
import type { Automation } from '../automations-data';
import { PlatformUpdateBadge } from '../platform-version-alert';
import { automationHealth, lastAttempt } from '../automation-health';
import type { ReaderClock } from '../schedule-clock';

type OpenRow = (id: string, event: { shiftKey: boolean; altKey: boolean }) => void;

function NameCell({ automation }: { automation: Automation }) {
  return (
    <td className="max-w-64">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="truncate font-medium">{automation.name}</span>
        {automation.draft !== null ? (
          <Badge color="info" variant="soft" size="sm">
            Draft edits
          </Badge>
        ) : null}
        <TierBadge origin={automation.origin} locked={automation.locked} />
        <PlatformUpdateBadge platformUpdateAt={automation.platformUpdateAt} />
      </div>
    </td>
  );
}

function RunsCell({ automation }: { automation: Automation }) {
  return (
    <td className="hidden text-right tabular-nums @md:table-cell">
      <div className="inline-flex items-center justify-end gap-1.5">
        {automation.errorCount > 0 ? (
          <span
            className="text-error inline-flex items-center gap-0.5"
            title={`${String(automation.errorCount)} failed`}
          >
            <Icon glyph={faExclamationTriangle} className="size-3.5" aria-hidden />
            {automation.errorCount}
          </span>
        ) : null}
        {automation.runCount}
      </div>
    </td>
  );
}

function LastRunCell({ attempt }: { attempt: ReturnType<typeof lastAttempt> }) {
  return (
    <td className="hidden text-sm @xl:table-cell">
      {/* A failed run does not write `lastRunAt`, so reading only
          that said "Not run yet" over a red failure count. It
          ran. It did not work. See `lastAttempt`. */}
      {attempt ? (
        <span className={attempt.failed ? 'text-error' : undefined}>
          <Timestamp value={attempt.at} format="relative" />
          {attempt.failed ? ' · failed' : ''}
        </span>
      ) : (
        'Not run yet'
      )}
    </td>
  );
}

function StatusCell({ automation }: { automation: Automation }) {
  const state = automationState(automation.status);
  const health = automationHealth(automation.status, automation.runCount, automation.errorCount);
  return (
    <td>
      {/* WHETHER IT WORKS outranks whether it is switched on: a rule whose every run failed
          said "On", in success green, beside its own failure count. See `automation-health`. */}
      <Badge
        color={health ? health.tone : state.tone}
        variant="soft"
        size="sm"
        title={health ? health.detail : state.detail}
      >
        {health ? health.label : state.label}
      </Badge>
    </td>
  );
}

export function AutomationRow({
  automation,
  clock,
  open,
}: {
  automation: Automation;
  clock: ReaderClock;
  open: OpenRow;
}) {
  const attempt = lastAttempt(automation.lastRunAt, automation.lastErrorAt);
  const actions = parseActions(automation.actions);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        open(automation.id, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open(automation.id, event);
      }}
    >
      <NameCell automation={automation} />
      <td className="hidden max-w-64 truncate text-sm @lg:table-cell">
        {summarizeTrigger(automation.triggerType, automation.triggerConfig, clock)}
      </td>
      <td className="hidden @2xl:table-cell">
        <ModuleTags
          trigger={{
            triggerType: automation.triggerType,
            triggerConfig: automation.triggerConfig,
          }}
          actions={actions}
        />
      </td>
      <RunsCell automation={automation} />
      <LastRunCell attempt={attempt} />
      <StatusCell automation={automation} />
    </tr>
  );
}
