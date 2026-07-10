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

import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import {
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { createTaskAction } from '../../../activity-task-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';
import { useDetailFooterNode } from '../../../../_components/detail-header-slot';
import { CREATE_SENTINEL } from '../../../../_shell/detail-registry';
import { ViewSwitcher } from '../../../../_components/detail-panel';

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
  // The overlay host (drawer/modal) already renders a footer-slot row for
  // Cancel/Save; handing it to SurfaceFrame merges the frame's own toolbar
  // into THAT row instead of stacking a second one underneath it — null
  // until the host mounts.
  const overlayActionsTarget = useDetailFooterNode();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [assignedToUserId, setAssignedToUserId] = React.useState(currentUserId);
  const [priority, setPriority] = React.useState('medium');
  const [dueAt, setDueAt] = React.useState('');
  const [customerId, setCustomerId] = React.useState(preselectedCustomerId ?? '');

  const v = useFieldValidation({ title }, { title: rule.required('Title is required.') });

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
    if (!v.validate()) return;
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
        backLabel="Tasks"
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher typeId="task" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
        actionsTarget={surface === 'overlay' ? overlayActionsTarget : undefined}
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
          <Card>
            <CardBody>
              <CardTitle>Task details</CardTitle>
              <div className="flex flex-col gap-4">
                <Field {...v.field('title')}>
                  <FieldLabel required>Title</FieldLabel>
                  <FieldControl
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    {...v.control('title')}
                    placeholder="Follow up on Acme renewal"
                  />
                </Field>
                <Field>
                  <FieldLabel>Description</FieldLabel>
                  <FieldControl
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    render={<Textarea rows={3} />}
                  />
                </Field>
                <div className="flex flex-row flex-wrap gap-4">
                  <Field className="flex-1">
                    <FieldLabel>Assigned to</FieldLabel>
                    <NativeSelect
                      value={assignedToUserId}
                      onChange={(e) => setAssignedToUserId(e.target.value)}
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field className="w-40">
                    <FieldLabel>Priority</FieldLabel>
                    <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </NativeSelect>
                  </Field>
                  <Field className="w-44">
                    <FieldLabel>Due date</FieldLabel>
                    <FieldControl
                      name="dueAt"
                      type="date"
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                    />
                  </Field>
                </div>
                {!preselectedDealId && (
                  <Field>
                    <FieldLabel>Customer</FieldLabel>
                    <NativeSelect
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
                  </Field>
                )}

                {error && (
                  <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                    {error}
                  </FieldStatus>
                )}
              </div>
            </CardBody>
          </Card>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
