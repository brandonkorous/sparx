'use client';

// The rows of the activity feed: one line per thing that happened, with runs of
// identical lines folded into one with a count.

import { Badge, Text } from '@wizeworks/silicaui-react';
import { describeAgo, type ActivityItem } from '../../lib/api/activity';
import {
  ModuleScope,
  WORKBENCH_MODULES,
  type WorkbenchModule,
} from '../../components/module-scope';
import { productName } from '../../lib/product';

/** Only a module we carry a token for gets a hue; anything else stays plain. */
function asModule(slug: string | null): WorkbenchModule | null {
  return slug !== null && (WORKBENCH_MODULES as readonly string[]).includes(slug)
    ? (slug as WorkbenchModule)
    : null;
}

/** An activity line, plus how many identical ones it stands for. */
interface ActivityRun {
  item: ActivityItem;
  count: number;
}

// Folds CONSECUTIVE rows with the same action, actor and subject into one line
// with a count, so one bulk edit cannot own the whole first screen. Per window:
// a run across a window boundary shows as two lines.
function collapseRuns(items: readonly ActivityItem[]): ActivityRun[] {
  const runs: ActivityRun[] = [];
  for (const item of items) {
    const previous = runs[runs.length - 1];
    if (
      previous?.item.action === item.action &&
      previous.item.actor.id === item.actor.id &&
      previous.item.subject === item.subject
    ) {
      previous.count += 1;
      continue;
    }
    runs.push({ item, count: 1 });
  }
  return runs;
}

/** When no person did it, the actor is named by CHANNEL: an AI assistant and a
 *  scheduled job are different facts an owner reacts to differently. */
function actorLabel(actor: ActivityItem['actor']): string {
  if (actor.name) return actor.name;
  if (actor.type === 'mcp') return 'AI assistant';
  if (actor.type === 'customer') return 'a customer';
  if (actor.type === 'api') return 'an integration';
  return productName();
}

// One thing that happened. The dot wears its own module's hue through a nested
// `ModuleScope`: color follows functionality, not the pane.
function ActivityRow({ item, count = 1 }: { item: ActivityItem; count?: number }) {
  const module = asModule(item.module);
  const row = (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="flex min-w-0 items-baseline gap-2">
        <span
          className={`size-1.5 shrink-0 rounded-full ${module ? 'bg-module' : 'bg-base-300'}`}
          aria-hidden
        />
        <span className="min-w-0 truncate">
          {item.title}
          {item.subject ? ` (${item.subject})` : ''}
        </span>
        {count > 1 ? (
          <Badge color="neutral" variant="soft" size="sm" className="shrink-0">
            ×{String(count)}
          </Badge>
        ) : null}
      </span>
      <Text className="shrink-0 text-sm">
        {actorLabel(item.actor)} · {describeAgo(item.at)}
      </Text>
    </div>
  );
  return module ? <ModuleScope module={module}>{row}</ModuleScope> : row;
}

/** The window's rows, folded into runs. */
export function ActivityList({ items }: { items: readonly ActivityItem[] }) {
  return (
    <ul className="divide-base-300 flex flex-col divide-y">
      {collapseRuns(items).map((run) => (
        <li key={run.item.id}>
          <ActivityRow item={run.item} count={run.count} />
        </li>
      ))}
    </ul>
  );
}
