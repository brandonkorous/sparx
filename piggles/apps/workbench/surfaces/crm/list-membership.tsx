'use client';

// Membership of a HAND-PICKED list (docs/144 §10).
//
// A rule-driven segment's membership is a consequence — you edit the rules and
// the members follow. A hand-picked list has no rules, so its membership IS the
// content, and this is the editor for it.
//
// TWO DELIBERATE DIFFERENCES FROM THE RULES EDITOR:
//
// 1. Adding and removing SAVE IMMEDIATELY, rather than joining the surface's
//    dirty state. Membership is not part of the list's definition — it is a set
//    of rows — and holding forty additions in a draft would mean a Save button
//    that sometimes saves a name and sometimes saves people, which is the kind of
//    ambiguity that gets a broadcast sent to the wrong audience.
//
// 2. The history is shown NEXT TO the members, not behind a tab. "Who is on this"
//    and "who came off it" are the same question asked at two moments, and the
//    second is the one a business cannot answer anywhere else.

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Combobox,
  Heading,
  Table,
  Text,
  Timestamp,
  useToast,
} from '@wizeworks/silicaui-react';
import { faUserMinus, faUserPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import { customerName, useCustomers } from './customers-data';
import {
  MEMBERSHIP_SOURCE_LABEL,
  useAddListMembers,
  useRemoveListMembers,
  useSegmentHistory,
  useSegmentMembers,
  type MembershipEvent,
} from './segments-data';

/** The people currently on the list, and the picker that adds more. */
function Members({ segmentId, segmentName }: { segmentId: string; segmentName: string }) {
  const toast = useToast();
  const confirm = useConfirm();

  const { data: memberPage } = useSegmentMembers(segmentId, 500);
  const { data: candidatePage } = useCustomers({});
  const add = useAddListMembers(segmentId);
  const remove = useRemoveListMembers(segmentId);

  const onList = useMemo(
    () => new Set((memberPage?.items ?? []).map((m) => m.customerId)),
    [memberPage]
  );

  // Anybody already on it is filtered OUT of the picker rather than shown
  // greyed: a list of names where half do nothing when clicked is a worse
  // affordance than a shorter list.
  const options = useMemo(
    () =>
      (candidatePage?.items ?? [])
        .filter((c) => !onList.has(c.id))
        .map((c) => ({ value: c.id, label: customerName(c) })),
    [candidatePage, onList]
  );

  async function onRemove(customerId: string, name: string) {
    const ok = await confirm({
      title: `Take ${name} off ${segmentName}?`,
      description:
        'They stay a customer — this only removes them from this list. It is recorded, so you will still be able to see they were on it.',
      confirmLabel: 'Take them off',
      cancelLabel: 'Keep them on',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate([customerId], {
      onSuccess: () => {
        toast.add({ title: `${name} taken off the list`, type: 'success' });
      },
    });
  }

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Heading level={3} className="text-lg font-semibold">
          Who is on it
        </Heading>
        <Badge color="module" variant="soft">
          {(memberPage?.items ?? []).length}
        </Badge>
      </div>

      {/* The Combobox filters `items` itself as you type, so the picker searches
          the customers already loaded rather than querying per keystroke. That
          is a real limit on a big list, and the honest answer for one is the
          "put them on a list" automation action or the MCP tool — both take
          hundreds at a time, which no picker should be asked to do. */}
      <Combobox
        color="module"
        aria-label="Add somebody to this list"
        placeholder="Search for somebody to add"
        emptyMessage="Nobody matching — try a different spelling."
        items={options}
        value={null}
        onValueChange={(next) => {
          const chosen = next as { value: string; label: string } | null;
          if (!chosen) return;
          add.mutate([chosen.value], {
            onSuccess: (result) => {
              toast.add({
                title:
                  result.added > 0
                    ? `${chosen.label} added`
                    : `${chosen.label} was already on this list`,
                type: result.added > 0 ? 'success' : 'info',
              });
            },
            onError: () => {
              toast.add({
                title: 'Could not add them',
                description: 'Nothing was changed. Try again in a moment.',
                type: 'error',
              });
            },
          });
        }}
      />

      {(memberPage?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-start gap-2 py-4">
          <Icon glyph={faUserPlus} className="size-5" aria-hidden />
          <Text className="text-base">
            Nobody is on this list yet. Search above to put somebody on it — or have an automation
            do it, which is how most lists fill up.
          </Text>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Name</th>
                <th className="hidden @lg:table-cell">Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(memberPage?.items ?? []).map((m) => (
                <tr key={m.customerId}>
                  <td className="font-medium">{customerName(m.customer)}</td>
                  <td className="hidden text-sm @lg:table-cell">
                    <Timestamp value={m.enteredAt} format="relative" />
                  </td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      color="danger"
                      size="sm"
                      aria-label={`Take ${customerName(m.customer)} off the list`}
                      onClick={() => {
                        void onRemove(m.customerId, customerName(m.customer));
                      }}
                    >
                      <Icon glyph={faUserMinus} className="size-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Card>
  );
}

/** Joins and departures — the record that outlives membership. */
function History({ segmentId }: { segmentId: string }) {
  const [filter, setFilter] = useState<'all' | 'entered' | 'exited'>('all');
  const { data: events } = useSegmentHistory(segmentId, filter === 'all' ? undefined : filter);

  const rows: MembershipEvent[] = events?.items ?? [];

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Heading level={3} className="text-lg font-semibold">
          Comings and goings
        </Heading>
        <div className="ml-auto flex gap-1">
          {(
            [
              ['all', 'Everything'],
              ['entered', 'Joined'],
              ['exited', 'Left'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? 'soft' : 'ghost'}
              color={filter === value ? 'module' : 'neutral'}
              onClick={() => {
                setFilter(value);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Text className="text-base">
          Nothing yet. Once people start joining and leaving, this is where you can see who — and
          when, which is the part a membership list on its own can never tell you.
        </Text>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center gap-2">
              <Badge
                color={event.kind === 'entered' ? 'success' : 'warning'}
                variant="soft"
                size="sm"
              >
                {event.kind === 'entered' ? 'Joined' : 'Left'}
              </Badge>
              <span className="min-w-0 truncate text-base font-medium">
                {customerName(event.customer)}
              </span>
              <Text className="text-sm">{MEMBERSHIP_SOURCE_LABEL[event.source]}</Text>
              <Text className="ml-auto text-sm">
                <Timestamp value={event.occurredAt} format="relative" />
              </Text>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ListMembership({
  segmentId,
  segmentName,
}: {
  segmentId: string;
  segmentName: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
      <Members segmentId={segmentId} segmentName={segmentName} />
      <History segmentId={segmentId} />
    </div>
  );
}

/** The history alone — for a RULE-driven list, where membership is not editable
 *  but "who dropped out this month" is still the interesting question. */
export function ListHistoryOnly({ segmentId }: { segmentId: string }) {
  return <History segmentId={segmentId} />;
}
