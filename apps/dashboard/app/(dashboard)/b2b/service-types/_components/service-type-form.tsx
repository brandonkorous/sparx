'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ModuleProvider, SurfaceFrame, SurfaceStep, toast, type SurfaceStepDef } from '@sparx/ui';
import { Button, Card, CardBody, CardTitle, Checkbox, Input, Label } from 'silicaui-react';

import { createServiceType, updateServiceType } from '../_lib/actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// Service-type create/edit on the standard form surface (docs/86 F layout). ONE
// component drives page / overlay / modal — see scheduling/service-form.tsx for
// the shape. No detail view: a created type returns to the list; editing rides a
// self-owned modal (delete stays a useConfirm in service-type-actions).

interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  color: string | null;
  isActive: boolean;
  requiresVehicle: boolean;
  notes: string | null;
}

type Presentation = 'page' | 'overlay' | 'modal';

interface ServiceTypeFormProps {
  presentation: Presentation;
  type?: ServiceType;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function ServiceTypeForm({ presentation, type, open, onOpenChange }: ServiceTypeFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [name, setName] = useState(type?.name ?? '');
  const [description, setDescription] = useState(type?.description ?? '');
  const [durationMinutes, setDurationMinutes] = useState(String(type?.durationMinutes ?? 60));
  const [color, setColor] = useState(type?.color ?? '');
  const [requiresVehicle, setRequiresVehicle] = useState(type?.requiresVehicle ?? false);
  const [notes, setNotes] = useState(type?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const snapshot = () =>
    JSON.stringify({ name, description, durationMinutes, color, requiresVehicle, notes });
  const [initial] = useState(snapshot);
  const dirty = snapshot() !== initial;

  const guardLeave = useUnsavedGuard(
    dirty,
    type ? { kind: 'edit', noun: 'service type' } : { kind: 'create', noun: 'service type' }
  );

  const close = useCallback(() => {
    if (presentation === 'modal') {
      onOpenChange?.(false);
      return;
    }
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
      return;
    }
    router.push('/b2b/service-types');
  }, [presentation, onOpenChange, pathname, searchParams, router]);

  const cancel = useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function onRequestClose(): boolean {
    if (saving) return false;
    if (!dirty) return true;
    void Promise.resolve(guardLeave()).then((ok) => ok && close());
    return false;
  }
  function onCancelClick() {
    if (saving) return;
    void Promise.resolve(guardLeave()).then((ok) => ok && close());
  }

  async function submit() {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || duration < 5 || duration > 480) {
      toast.error('Duration must be between 5 and 480 minutes');
      return;
    }
    setSaving(true);
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      durationMinutes: duration,
      color: color.trim() || undefined,
      requiresVehicle,
      notes: notes.trim() || undefined,
    };
    const { error: err } = type
      ? await updateServiceType(type.id, body)
      : await createServiceType(body);
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(type ? 'Service type updated' : 'Service type created');
    close();
    router.refresh();
  }

  const heading = type ? 'Edit service type' : 'New service type';

  const body = (
    <SurfaceStep
      header={{
        title: heading,
        supporting:
          'A bookable service customers can request — name, duration, and scheduling color.',
      }}
      actions={{
        onNext: () => void submit(),
        nextLabel: type ? 'Save changes' : 'Create service type',
        nextLoading: saving,
        nextDisabled: saving,
      }}
    >
      <Card>
        <CardBody>
          <CardTitle>Service type</CardTitle>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="st-name">
                Name <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input
                id="st-name"
                placeholder="e.g. Oil Change, Inspection"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div>
              <Label htmlFor="st-desc">Description</Label>
              <Input
                id="st-desc"
                placeholder="Brief description for customers"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
              />
            </div>

            <div>
              <Label htmlFor="st-duration">Duration (minutes)</Label>
              <Input
                id="st-duration"
                type="number"
                min={5}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="st-color">Calendar color</Label>
              <div className="flex flex-row items-center gap-2">
                <input
                  type="color"
                  aria-label="Calendar color"
                  value={color || '#6366f1'}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={saving}
                  className="border-input h-9 w-14 cursor-pointer rounded border"
                />
                <Input
                  id="st-color"
                  placeholder="#6366F1"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={saving}
                  className="w-32"
                />
                {color && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setColor('')}
                    disabled={saving}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3">
              <Checkbox
                color="module"
                checked={requiresVehicle}
                onChange={(e) => setRequiresVehicle(e.target.checked)}
                disabled={saving}
              />
              <p className="text-sm">Requires vehicle information</p>
            </label>

            <div>
              <Label htmlFor="st-notes">Internal notes</Label>
              <Input
                id="st-notes"
                placeholder="Notes visible to staff only"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
        </CardBody>
      </Card>
    </SurfaceStep>
  );

  if (presentation === 'modal') {
    return (
      <ModuleProvider module="b2b">
        <SurfaceFrame
          variant="modal"
          title={heading}
          steps={STEPS}
          current={0}
          open={open}
          onOpenChange={(next) => {
            if (!next) close();
          }}
          onRequestClose={onRequestClose}
          footer={
            <Button variant="ghost" color="neutral" size="sm" onClick={onCancelClick}>
              Cancel
            </Button>
          }
        >
          {body}
        </SurfaceFrame>
      </ModuleProvider>
    );
  }

  return (
    <ModuleProvider module="b2b" className="h-full">
      <SurfaceFrame
        variant={presentation === 'overlay' ? 'inline' : 'embedded'}
        title={heading}
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        {body}
      </SurfaceFrame>
    </ModuleProvider>
  );
}
