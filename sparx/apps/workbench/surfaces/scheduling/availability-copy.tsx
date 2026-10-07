'use client';

// "USE THESE HOURS FOR…" — one resource's week, copied onto others.
//
// Lives on the Availability pane, under the week it copies, rather than in a
// dialog: the pick list can run to sixteen bays and a crew, and the owner wants
// the week they are copying in view while they tick. The one irreversible step
// (replacing everybody's week) sits behind a confirm that names who and how
// many. The rules, the sentences and the writes are in `hours-copy.ts`.
//
// It copies the SAVED week, never the draft. With edits in flight the copy is
// blocked with a sentence saying so, because copying the old hours while the
// screen shows new ones would hand everyone a week the owner was not looking at.

import { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  CheckboxOption,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { Copy } from 'lucide-react';
import { FormSection } from '../../components/form-section';
import { useConfirm } from '../../lib/confirm';
import {
  schedulingErrorMessage,
  useCopyHours,
  type AvailabilityException,
  type AvailabilityWindow,
  type SchedulingResource,
} from './setup-data';
import {
  copyConfirmCopy,
  copyGroups,
  copyToasts,
  ownUpcomingClosures,
  windowsToCopy,
  type CopyGroup,
} from './hours-copy';

export function HoursCopy({
  sourceId,
  sourceName,
  resources,
  windows,
  exceptions,
  dirty,
}: {
  sourceId: string;
  sourceName: string;
  resources: readonly SchedulingResource[];
  /** The source's SAVED week. */
  windows: readonly AvailabilityWindow[];
  /** Every closure, so the copy can tell which this resource owns and which a
   *  target already has. Undefined while they load. */
  exceptions: readonly AvailabilityException[] | undefined;
  /** The week on screen differs from the saved one. */
  dirty: boolean;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const copy = useCopyHours();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [withClosures, setWithClosures] = useState(false);

  const groups = useMemo(() => copyGroups(resources, sourceId), [resources, sourceId]);
  // Read when the section renders, not frozen at mount: a closure that ends
  // while the pane sits open stops counting.
  const closures = ownUpcomingClosures(exceptions ?? [], sourceId, new Date());

  const targets = groups
    .flatMap((group) => group.members)
    .filter((member) => selected.includes(member.id))
    .map((member) => ({
      id: member.id,
      name: member.name,
      hasWeeklyHours: member.hasWeeklyHours,
    }));

  const setGroup = (group: CopyGroup, next: readonly string[]) => {
    const inGroup = new Set(group.members.map((member) => member.id));
    setSelected((previous) => [...previous.filter((id) => !inGroup.has(id)), ...next]);
  };

  const close = () => {
    setOpen(false);
    setSelected([]);
    setWithClosures(false);
  };

  const run = async () => {
    if (dirty || targets.length === 0) return;
    const copied = withClosures ? closures : [];
    const withHours = targets.filter((target) => target.hasWeeklyHours !== false).length;
    const ok = await confirm({
      ...copyConfirmCopy({
        source: sourceName,
        targets: targets.map((target) => target.name),
        closures: copied.length,
        closedAllWeek: windows.length === 0,
        seasonal: windows.some((window) => window.validFrom !== null || window.validTo !== null),
        targetsWithHours: withHours,
      }),
      // Red only when hours are really thrown away; filling in an empty week is
      // ordinary work (sparx persona issue 118).
      color: withHours === 0 ? 'module' : 'danger',
    });
    if (!ok) return;
    // Awaited rather than handed callbacks: a callback passed to `mutate` is
    // dropped if the owner switches to another resource mid-copy, and then
    // nobody would be told who got the hours.
    let results;
    try {
      results = await copy.mutateAsync({
        windows: windowsToCopy(windows),
        targets,
        closures: copied,
        existing: [...(exceptions ?? [])],
      });
    } catch (error) {
      toast.add({
        title: 'Could not copy these hours',
        description: schedulingErrorMessage(error, 'Nothing was changed.'),
        type: 'error',
      });
      return;
    }
    const { success, failure } = copyToasts(sourceName, results);
    if (success) toast.add({ ...success, type: 'success' });
    if (failure) toast.add({ ...failure, type: 'error' });
    // The ones that did not land stay ticked, so trying again is one press.
    const missed = results
      .filter((result) => !result.hours || result.closuresFailed > 0)
      .map((result) => result.id);
    if (missed.length === 0) close();
    else setSelected(missed);
  };

  if (groups.length === 0) {
    return (
      <FormSection title="Use these hours for others">
        <Text>
          There is nobody else to copy {sourceName}’s hours to yet. Once you add more people or
          things under People &amp; equipment, you can give them all the same week from here.
        </Text>
      </FormSection>
    );
  }

  return (
    <FormSection
      title="Use these hours for others"
      description={`Give other people or things the same weekly hours as ${sourceName}, so a team that keeps the same hours is set up once instead of one at a time.`}
    >
      {dirty ? (
        <Text className="text-warning">
          Save {sourceName}’s hours first. Only saved hours are copied, so the others would get the
          old ones.
        </Text>
      ) : null}

      {!open ? (
        <div>
          <Button
            color="module"
            variant="soft"
            size="sm"
            disabled={dirty}
            onClick={() => {
              setOpen(true);
            }}
          >
            <Copy className="size-4" aria-hidden />
            Use these hours for…
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const ids = group.members.map((member) => member.id);
            const ticked = ids.filter((id) => selected.includes(id));
            const all = ticked.length === ids.length;
            const some = ticked.length > 0 && !all;
            return (
              <div key={group.kind} className="flex flex-col gap-2">
                <Checkbox
                  color="module"
                  checked={all}
                  ref={(input) => {
                    if (input) input.indeterminate = some;
                  }}
                  disabled={copy.isPending}
                  onChange={() => {
                    setGroup(group, all ? [] : ids);
                  }}
                >
                  <span className="font-semibold">
                    All {group.label.toLowerCase()} ({ids.length})
                  </span>
                </Checkbox>
                <CheckboxGroup
                  color="module"
                  value={ticked}
                  aria-label={`${group.label} to copy ${sourceName}’s hours to`}
                  disabled={copy.isPending}
                  onValueChange={(next) => {
                    setGroup(group, next);
                  }}
                  className="grid gap-1 pl-7 @lg:grid-cols-2"
                >
                  {group.members.map((member) => (
                    <CheckboxOption key={member.id} value={member.id}>
                      {member.name}
                    </CheckboxOption>
                  ))}
                </CheckboxGroup>
              </div>
            );
          })}

          {closures.length > 0 ? (
            <div className="border-base-300 flex flex-col gap-1 border-t pt-3">
              <Checkbox
                color="module"
                checked={withClosures}
                disabled={copy.isPending}
                onChange={(event) => {
                  setWithClosures(event.target.checked);
                }}
              >
                Also add {sourceName}’s{' '}
                {closures.length === 1
                  ? 'upcoming closure or special day'
                  : `${String(closures.length)} upcoming closures and special days`}
              </Checkbox>
              <Text className="pl-7 text-sm">
                Added alongside their own, which stay as they are. Closures for the whole business
                already apply to everyone.
              </Text>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              color="module"
              size="sm"
              disabled={dirty || targets.length === 0}
              loading={copy.isPending}
              onClick={() => {
                void run();
              }}
            >
              {targets.length === 0
                ? 'Tick who gets these hours'
                : `Copy to ${targets.length === 1 ? (targets[0]?.name ?? '') : `${String(targets.length)} others`}`}
            </Button>
            <Button size="sm" variant="ghost" disabled={copy.isPending} onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </FormSection>
  );
}
