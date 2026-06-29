'use client';

// New-task form, on the standard create surface (docs/86 F layout, WS2). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// Single-step form. Tasks have no detail-view drawer, so a created task returns to
// the list (the overlay clears its token in place). The frame supplies the title +
// window controls + the pinned floor toolbar (ghost Cancel + module primary).

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createTaskAction } from '../../../activity-task-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

interface NewTaskFormProps {
  surface: 'page' | 'overlay';
  currentUserId: string;
  users: { id: string; label: string }[];
  customers: { id: string; label: string }[];
  preselectedCustomerId: string | null;
  preselectedDealId: string | null;
}

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

export function NewTaskForm({
  surface,
  currentUserId,
  users,
  customers,
  preselectedCustomerId,
  preselectedDealId,
}: NewTaskFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [assignedToUserId, setAssignedToUserId] = React.useState(currentUserId);
  const [priority, setPriority] = React.useState('medium');
  const [dueAt, setDueAt] = React.useState('');
  const [customerId, setCustomerId] = React.useState(preselectedCustomerId ?? '');

  // Unsaved-changes guard. "Dirty" is "the user entered or changed anything" off
  // the defaults (assignee defaults to the current user; priority to medium).
  const dirty =
    title.trim() !== '' ||
    description.trim() !== '' ||
    dueAt.trim() !== '' ||
    priority !== 'medium' ||
    assignedToUserId !== currentUserId ||
    customerId !== (preselectedCustomerId ?? '');
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'task' });

  // Leave WITHOUT the guard (the success path + the guarded Cancel both route here).
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/crm/tasks');
    }
  }, [surface, pathname, searchParams, router]);

  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    const input = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueAt: dueAt.trim() ? new Date(`${dueAt.trim()}T00:00:00Z`).toISOString() : undefined,
      priority,
      assignedToUserId,
      customerId: customerId.trim() !== '' ? customerId : (preselectedCustomerId ?? undefined),
      dealId: preselectedDealId ?? undefined,
    };
    startTransition(async () => {
      const result = await createTaskAction(input);
      if (result.ok) {
        // No detail view — a created task returns to the list.
        close();
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <ModuleProvider module="crm" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New task"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Task details',
            supporting:
              'Assign a follow-up to yourself or a teammate. Tasks linked to a customer or deal show up on that record’s task list as well.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create task',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="default">
            <CardHeader>
              <CardTitle>Task details</CardTitle>
            </CardHeader>
            <CardContent>
              <Stack gap={4}>
                <Stack gap={2}>
                  <Label htmlFor="task-title">Title</Label>
                  <Input
                    id="task-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Follow up on Acme renewal"
                  />
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="task-description">Description</Label>
                  <Textarea
                    id="task-description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Stack>
                <Stack direction="row" gap={4} wrap>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="task-assignee">Assigned to</Label>
                    <NativeSelect
                      id="task-assignee"
                      value={assignedToUserId}
                      onChange={(e) => setAssignedToUserId(e.target.value)}
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Stack>
                  <Stack gap={2} className="w-40">
                    <Label htmlFor="task-priority">Priority</Label>
                    <NativeSelect
                      id="task-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </NativeSelect>
                  </Stack>
                  <Stack gap={2} className="w-44">
                    <Label htmlFor="task-due">Due date</Label>
                    <Input
                      id="task-due"
                      type="date"
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                    />
                  </Stack>
                </Stack>
                {!preselectedDealId && (
                  <Stack gap={2}>
                    <Label htmlFor="task-customer">Customer</Label>
                    <NativeSelect
                      id="task-customer"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                    >
                      <option value="">(none)</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Stack>
                )}

                {error && (
                  <Text size="sm" variant="danger" role="alert" aria-live="polite">
                    {error}
                  </Text>
                )}
              </Stack>
            </CardContent>
          </Card>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
