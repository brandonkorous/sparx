'use client';

// The automations list body — rendered through the shared `SelectionList`
// dual-view substrate (docs/34 §7), so it gains the Table↔Cards toggle and
// honors the user's `defaultListView`. Read-only selection (`selectable=false`):
// the row's inline quick enable/pause Switch is the only mutation, running
// through the status Server Action (which revalidates, so the row reflects the
// new status). Locked (platform-managed) rules show the badge but no toggle —
// they're adapted via "Duplicate to edit" on the detail page.
//
// Status filtering moved to the page's `ListToolbar` (the API's `?status=`
// facet, filtered server-side). The "Email" axis stays a client control: it's a
// derived property (does any action send mail?) computed from each row's parsed
// actions, with no server param to drive it.

import * as React from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Button, Card, CardBody, Switch } from '@wizeworks/silicaui-react';
import { SelectionList, type SelectionCard, type SelectionColumn, toast } from '@sparx/ui';
import type { AutomationDto } from '../_lib/types';
import {
  AutomationStatusBadge,
  ModuleTags,
  OriginBadge,
  formatTimestamp,
  hasEmailAction,
  parseActions,
  summarizeTrigger,
} from '../_lib/presentation';
import { setAutomationStatusAction } from '../actions';

export function AutomationList({
  automations,
  canWrite,
  view,
  initialEmailOnly = false,
}: {
  automations: AutomationDto[];
  canWrite: boolean;
  view: 'table' | 'card';
  /** Start narrowed to email automations (the email surface's deep link,
   *  `/automations?focus=email`) — docs/90 Step 5. */
  initialEmailOnly?: boolean;
}) {
  const [emailOnly, setEmailOnly] = React.useState(initialEmailOnly);
  const [pending, startTransition] = React.useTransition();

  // Precompute the email-action membership once (parse actions per row).
  const emailIds = React.useMemo(
    () =>
      new Set(automations.filter((a) => hasEmailAction(parseActions(a.actions))).map((a) => a.id)),
    [automations]
  );

  const rows = emailOnly ? automations.filter((a) => emailIds.has(a.id)) : automations;

  function toggle(a: AutomationDto, next: boolean) {
    startTransition(async () => {
      const result = await setAutomationStatusAction(a.id, next ? 'active' : 'paused');
      if (result.ok) toast.success(`${a.name} ${next ? 'activated' : 'paused'}.`);
      else toast.error(result.error.message);
    });
  }

  const nameLink = (a: AutomationDto, className: string) => (
    <Link href={`/automations/${a.id}`} className={className}>
      {a.name}
    </Link>
  );

  const statusToggle = (a: AutomationDto) =>
    canWrite && !a.locked ? (
      <Switch
        checked={a.status === 'active'}
        disabled={pending}
        onCheckedChange={(next) => toggle(a, next)}
        aria-label={a.status === 'active' ? 'Pause automation' : 'Activate automation'}
      />
    ) : null;

  const runStats = (a: AutomationDto) => (
    <div className="flex flex-col gap-0">
      <p className="text-base-content/70 text-xs">
        {a.runCount} run{a.runCount === 1 ? '' : 's'} ·{' '}
        {a.lastRunAt ? formatTimestamp(a.lastRunAt) : 'never run'}
      </p>
      {a.errorCount > 0 && (
        <p className="text-danger text-xs">
          {a.errorCount} error{a.errorCount === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );

  const columns: SelectionColumn<AutomationDto>[] = [
    {
      header: 'Name',
      cell: (a) => (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-2">
            {nameLink(a, 'text-sm font-medium hover:text-module hover:underline')}
            <OriginBadge origin={a.origin} locked={a.locked} />
          </div>
          <p className="text-base-content/70 text-xs">
            {summarizeTrigger(a.triggerType, a.triggerConfig)}
          </p>
        </div>
      ),
    },
    {
      header: 'Modules',
      cell: (a) => (
        <ModuleTags
          trigger={{ triggerType: a.triggerType, triggerConfig: a.triggerConfig }}
          actions={parseActions(a.actions)}
        />
      ),
    },
    { header: 'Status', cell: (a) => <AutomationStatusBadge status={a.status} /> },
    { header: 'Runs', cell: runStats },
    {
      header: 'Enabled',
      align: 'right',
      cell: (a) => statusToggle(a) ?? <span className="text-base-content/50">—</span>,
    },
  ];

  const card: SelectionCard<AutomationDto> = {
    // `render` is a full escape hatch and overrides `title`; the title fallback
    // is the same name link, kept for safety if the slot is ever read directly.
    title: (a) => nameLink(a, 'text-base font-medium hover:text-module hover:underline'),
    render: (a) => (
      <Card>
        <CardBody>
          <div className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-row flex-wrap items-center gap-2">
                {nameLink(a, 'text-base font-medium hover:text-module hover:underline')}
                <OriginBadge origin={a.origin} locked={a.locked} />
              </div>
              <p className="text-base-content/70 text-sm">
                {summarizeTrigger(a.triggerType, a.triggerConfig)}
              </p>
              <ModuleTags
                trigger={{ triggerType: a.triggerType, triggerConfig: a.triggerConfig }}
                actions={parseActions(a.actions)}
              />
            </div>

            <div className="flex flex-row items-center gap-4">
              <div className="flex flex-col items-end gap-1 text-right">
                <AutomationStatusBadge status={a.status} />
                {runStats(a)}
              </div>
              {statusToggle(a)}
              <Button variant="ghost" size="sm" render={<Link href={`/automations/${a.id}`} />}>
                Open
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    ),
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Action-type axis (a derived property, not a server facet): narrow to
          rules that send email — the unified replacement for the old standalone
          Email Automations page. */}
      <div className="flex flex-row flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={emailOnly ? 'soft' : 'ghost'}
          color={emailOnly ? 'module' : 'neutral'}
          iconStart={<Mail className="h-4 w-4" />}
          onClick={() => setEmailOnly((v) => !v)}
          aria-pressed={emailOnly}
        >
          Email · {emailIds.size}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-base-content/70 text-sm">
          No {emailOnly ? 'email ' : ''}automations match these filters.
        </p>
      ) : (
        <SelectionList
          items={rows}
          view={view}
          getId={(a) => a.id}
          getRowLabel={(a) => a.name}
          entityLabelPlural="automations"
          selectable={false}
          columns={columns}
          card={card}
        />
      )}
    </div>
  );
}
