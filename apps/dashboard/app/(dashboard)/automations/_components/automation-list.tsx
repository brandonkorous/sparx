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
import {
  Button,
  Card,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Stack,
  Switch,
  Text,
  toast,
} from '@sparx/ui';
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
    <Stack gap={0}>
      <Text size="xs" variant="muted">
        {a.runCount} run{a.runCount === 1 ? '' : 's'} ·{' '}
        {a.lastRunAt ? formatTimestamp(a.lastRunAt) : 'never run'}
      </Text>
      {a.errorCount > 0 && (
        <Text size="xs" variant="danger">
          {a.errorCount} error{a.errorCount === 1 ? '' : 's'}
        </Text>
      )}
    </Stack>
  );

  const columns: SelectionColumn<AutomationDto>[] = [
    {
      header: 'Name',
      cell: (a) => (
        <Stack gap={1} className="min-w-0">
          <Stack direction="row" align="center" gap={2} wrap>
            {nameLink(a, 'text-sm font-medium hover:text-[var(--module-active)] hover:underline')}
            <OriginBadge origin={a.origin} locked={a.locked} />
          </Stack>
          <Text size="xs" variant="muted">
            {summarizeTrigger(a.triggerType, a.triggerConfig)}
          </Text>
        </Stack>
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
      cell: (a) => statusToggle(a) ?? <span className="text-[var(--color-text-tertiary)]">—</span>,
    },
  ];

  const card: SelectionCard<AutomationDto> = {
    // `render` is a full escape hatch and overrides `title`; the title fallback
    // is the same name link, kept for safety if the slot is ever read directly.
    title: (a) =>
      nameLink(a, 'text-base font-medium hover:text-[var(--module-active)] hover:underline'),
    render: (a) => (
      <Card variant={a.status === 'active' ? 'module' : 'default'} padding="md">
        <Stack direction="row" align="center" justify="between" wrap gap={3}>
          <Stack gap={1} className="min-w-0 flex-1">
            <Stack direction="row" align="center" gap={2} wrap>
              {nameLink(
                a,
                'text-base font-medium hover:text-[var(--module-active)] hover:underline'
              )}
              <OriginBadge origin={a.origin} locked={a.locked} />
            </Stack>
            <Text size="sm" variant="muted">
              {summarizeTrigger(a.triggerType, a.triggerConfig)}
            </Text>
            <ModuleTags
              trigger={{ triggerType: a.triggerType, triggerConfig: a.triggerConfig }}
              actions={parseActions(a.actions)}
            />
          </Stack>

          <Stack direction="row" align="center" gap={4}>
            <Stack gap={1} align="end" className="text-right">
              <AutomationStatusBadge status={a.status} />
              {runStats(a)}
            </Stack>
            {statusToggle(a)}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/automations/${a.id}`}>Open</Link>
            </Button>
          </Stack>
        </Stack>
      </Card>
    ),
  };

  return (
    <Stack gap={4}>
      {/* Action-type axis (a derived property, not a server facet): narrow to
          rules that send email — the unified replacement for the old standalone
          Email Automations page. */}
      <Stack direction="row" align="center" gap={2} wrap>
        <Button
          type="button"
          size="sm"
          variant={emailOnly ? 'soft' : 'ghost'}
          color={emailOnly ? 'module' : 'neutral'}
          leftIcon={<Mail className="h-4 w-4" />}
          onClick={() => setEmailOnly((v) => !v)}
          aria-pressed={emailOnly}
        >
          Email · {emailIds.size}
        </Button>
      </Stack>

      {rows.length === 0 ? (
        <Text size="sm" variant="muted">
          No {emailOnly ? 'email ' : ''}automations match these filters.
        </Text>
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
    </Stack>
  );
}
