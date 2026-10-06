import { summarizeTrigger } from '../automations-presentation';
import type { Automation } from '../automations-data';
import type { ReaderClock } from '../schedule-clock';

export type SortKey = 'name' | 'trigger' | 'runs' | 'lastRun' | 'status';
export type Dir = 'asc' | 'desc';

const STATUS_RANK: Record<string, number> = { error: 0, active: 1, paused: 2, draft: 3 };

/** Search, then sort, the whole (bounded) rule set on the client. */
export function sortedRows(
  data: Automation[] | undefined,
  needle: string,
  sort: { key: SortKey; dir: Dir },
  clock: ReaderClock
) {
  const all = data ?? [];
  const filtered = needle
    ? all.filter(
        (a) =>
          a.name.toLowerCase().includes(needle) ||
          (a.description ?? '').toLowerCase().includes(needle)
      )
    : all;
  const dir = sort.dir === 'asc' ? 1 : -1;
  const runAt = (a: Automation) => (a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0);
  return [...filtered].sort((a, b) => {
    switch (sort.key) {
      case 'name':
        return dir * a.name.localeCompare(b.name);
      case 'trigger':
        return (
          dir *
          summarizeTrigger(a.triggerType, a.triggerConfig, clock).localeCompare(
            summarizeTrigger(b.triggerType, b.triggerConfig, clock)
          )
        );
      case 'runs':
        return dir * (a.runCount - b.runCount);
      case 'lastRun':
        return dir * (runAt(a) - runAt(b));
      case 'status':
        return dir * ((STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));
    }
  });
}
