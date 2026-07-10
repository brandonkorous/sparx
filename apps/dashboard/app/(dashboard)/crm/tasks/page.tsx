import { CheckSquare, Plus, Calendar, AlertCircle } from 'lucide-react';

import { requireSession } from '@sparx/auth';
import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, CardTitle, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { TasksList } from './_components/tasks-list';
import type { TaskCard } from './_components/task-row';

// Tasks — a standard docs/34 List surface, but the data stays GROUPED (overdue
// / open / completed): each group keeps its own card + heading and renders one
// `<TasksList>` (a SelectionList) so all three share the single Table/Cards
// toggle + the user's `defaultListView`. The me/all scope (already a
// searchParam) is surfaced as a ListToolbar filter.

interface TaskListItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  customerId: string | null;
  dealId: string | null;
  assignedToUserId: string;
}

export const dynamic = 'force-dynamic';

const SCOPE_OPTIONS = [
  { value: 'me', label: 'My tasks' },
  { value: 'all', label: 'Team tasks' },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TasksPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const scope = stringParam(params.scope) === 'all' ? 'all' : 'me';

  const mine = scope === 'me' ? `&assigned_to_user_id=${session.user.id}` : '';
  const overdueQuery = scope === 'me' ? `?user_id=${session.user.id}` : '';
  // Only the "open" list grows, so it's the one that paginates; the overdue and
  // completed sub-lists stay capped helper queries (their `take` caps unchanged).
  const [prefs, { data: openTasks, meta: openMeta }, overdueTasks, completedTasks] =
    await Promise.all([
      getUserPreferences(),
      api.getPaged<TaskListItem[]>(`/v1/crm/tasks?status=open&take=${take}&skip=${skip}${mine}`),
      api.get<TaskListItem[]>(`/v1/crm/tasks/overdue${overdueQuery}`),
      api.get<TaskListItem[]>(`/v1/crm/tasks?status=completed&take=25${mine}`),
    ]);
  const openTotal = (openMeta?.total as number | undefined) ?? openTasks.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<CheckSquare className="h-5 w-5" />}
          title="Tasks"
          badge={
            <>
              <Badge color="module">{openTotal} open</Badge>
              {overdueTasks.length > 0 && (
                <Badge color="danger">{overdueTasks.length} overdue</Badge>
              )}
            </>
          }
          description="Follow-ups attached to customers, deals, or standalone reminders. Overdue tasks trigger an email reminder to the assignee via the automation engine."
        />
      }
      toolbar={
        <ListToolbar
          searchable={false}
          filters={[{ key: 'scope', label: 'Scope', options: SCOPE_OPTIONS, defaultValue: 'me' }]}
          enableViewToggle
          primaryAction={
            <EntityCreateButton
              entityType="task"
              newHref="/crm/tasks/new"
              color="module"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />
      }
      // Paginates the OPEN list only — the overdue/completed groups below are
      // capped helper queries, so the pager total reflects open tasks.
      pager={<ListPager total={openTotal} />}
    >
      {overdueTasks.length > 0 && (
        <Card className="bg-module bg-soft">
          <CardBody>
            <CardTitle>
              <div className="flex flex-row items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Overdue
                <Badge color="danger">{overdueTasks.length}</Badge>
              </div>
            </CardTitle>
            <TasksList tasks={overdueTasks.map(serializeTask)} view={view} overdue />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <CardTitle>
            <div className="flex flex-row items-center gap-2">
              <Calendar className="h-4 w-4" /> Open
              <Badge color="neutral" variant="soft" size="sm">
                {openTotal}
              </Badge>
            </div>
          </CardTitle>
          {openTasks.length === 0 ? (
            <EmptyState
              title="No open tasks"
              description="Create a task to track follow-ups, calls, or to-dos for yourself or your team."
            />
          ) : (
            <TasksList tasks={openTasks.map(serializeTask)} view={view} />
          )}
        </CardBody>
      </Card>

      {completedTasks.length > 0 && (
        <Card>
          <CardBody>
            <CardTitle>Recently completed</CardTitle>
            <TasksList tasks={completedTasks.map(serializeTask)} view={view} />
          </CardBody>
        </Card>
      )}
    </ListPageShell>
  );
}

function serializeTask(task: TaskListItem): TaskCard {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt,
    customerId: task.customerId,
    dealId: task.dealId,
    assignedToUserId: task.assignedToUserId,
  };
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
