'use client';

// The automations list body — status filter chips + a card per rule. Quick
// enable/pause runs through the status Server Action (which revalidates, so the
// row reflects the new status). Locked (platform-managed) rules show the badge
// but no toggle — they're adapted via "Duplicate to edit" on the detail page.

import * as React from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Button, Card, CardContent, Stack, Switch, Text, toast } from '@sparx/ui';
import type { AutomationStatus } from '@sparx/automation-schemas';
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

type FilterKey = 'all' | AutomationStatus;

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'draft', label: 'Draft' },
  { key: 'error', label: 'Error' },
];

export function AutomationList({
  automations,
  canWrite,
  initialEmailOnly = false,
}: {
  automations: AutomationDto[];
  canWrite: boolean;
  /** Start narrowed to email automations (the email surface's deep link,
   *  `/automations?focus=email`) — docs/90 Step 5. */
  initialEmailOnly?: boolean;
}) {
  const [filter, setFilter] = React.useState<FilterKey>('all');
  const [emailOnly, setEmailOnly] = React.useState(initialEmailOnly);
  const [pending, startTransition] = React.useTransition();

  // Precompute the email-action membership once (parse actions per row).
  const emailIds = React.useMemo(
    () =>
      new Set(automations.filter((a) => hasEmailAction(parseActions(a.actions))).map((a) => a.id)),
    [automations]
  );

  const counts: Record<FilterKey, number> = {
    all: automations.length,
    active: 0,
    paused: 0,
    draft: 0,
    error: 0,
  };
  for (const a of automations) counts[a.status] = (counts[a.status] ?? 0) + 1;

  const rows = automations.filter(
    (a) => (filter === 'all' || a.status === filter) && (!emailOnly || emailIds.has(a.id))
  );

  function toggle(a: AutomationDto, next: boolean) {
    startTransition(async () => {
      const result = await setAutomationStatusAction(a.id, next ? 'active' : 'paused');
      if (result.ok) toast.success(`${a.name} ${next ? 'activated' : 'paused'}.`);
      else toast.error(result.error.message);
    });
  }

  return (
    <Stack gap={4}>
      <Stack direction="row" align="center" gap={2} wrap>
        {TABS.map((t) => (
          <Button
            key={t.key}
            type="button"
            size="sm"
            variant={filter === t.key ? 'soft' : 'ghost'}
            color={filter === t.key ? 'module' : 'neutral'}
            onClick={() => setFilter(t.key)}
          >
            {t.label} · {counts[t.key]}
          </Button>
        ))}
        {/* Action-type filter (a second axis): narrow to rules that send email —
            the unified replacement for the old standalone Email Automations page. */}
        <span className="mx-1 h-4 w-px bg-[var(--color-border-default)]" aria-hidden />
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
          No {emailOnly ? 'email ' : ''}
          {filter === 'all' ? '' : `${filter} `}automations.
        </Text>
      ) : (
        <Stack gap={3}>
          {rows.map((a) => (
            <Card key={a.id} variant={a.status === 'active' ? 'module' : 'default'}>
              <CardContent>
                <Stack direction="row" align="center" justify="between" wrap gap={3}>
                  <Stack gap={1} className="min-w-0 flex-1">
                    <Stack direction="row" align="center" gap={2} wrap>
                      <Link
                        href={`/automations/${a.id}`}
                        className="text-base font-medium hover:text-[var(--module-active)] hover:underline"
                      >
                        {a.name}
                      </Link>
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

                    {canWrite && !a.locked && (
                      <Switch
                        checked={a.status === 'active'}
                        disabled={pending}
                        onCheckedChange={(next) => toggle(a, next)}
                        aria-label={
                          a.status === 'active' ? 'Pause automation' : 'Activate automation'
                        }
                      />
                    )}

                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/automations/${a.id}`}>Open</Link>
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
