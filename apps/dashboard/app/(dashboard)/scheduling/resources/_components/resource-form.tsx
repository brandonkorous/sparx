'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldLabel,
  NativeSelect,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, toast, type SurfaceStepDef } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import type { ResourceKind, SchedulingResource } from '../../_lib/types';
import { RESOURCE_KIND_LABEL } from '../../_lib/format';
import { createResourceAction, updateResourceAction } from '../../_lib/actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';
import { CREATE_SENTINEL } from '../../../_shell/detail-registry';
import { ViewSwitcher } from '../../../_components/detail-panel';

// Resource create/edit on the standard form surface (docs/86 F layout). ONE
// component drives page / overlay / modal — see service-form.tsx for the shape.
// No detail view: a created resource returns to the list; edit rides a modal.

type Presentation = 'page' | 'overlay' | 'modal';

interface ResourceFormProps {
  presentation: Presentation;
  resource?: SchedulingResource;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const KINDS: ResourceKind[] = ['staff', 'asset', 'table', 'space', 'equipment'];
const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function ResourceForm({ presentation, resource, open, onOpenChange }: ResourceFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(resource?.name ?? '');
  const [kind, setKind] = useState<ResourceKind>(resource?.kind ?? 'staff');
  const [timezone, setTimezone] = useState(resource?.timezone ?? 'UTC');
  const [description, setDescription] = useState(resource?.description ?? '');
  const [color, setColor] = useState(resource?.color ?? '');
  const [exclusive, setExclusive] = useState(resource?.exclusive ?? true);
  const [capacity, setCapacity] = useState(resource?.capacity ?? 1);
  const [capacityMin, setCapacityMin] = useState(resource?.capacityMin ?? 0);
  const [capacityMax, setCapacityMax] = useState(resource?.capacityMax ?? 0);
  const [skillTags, setSkillTags] = useState((resource?.skillTags ?? []).join(', '));
  const [bookableOnline, setBookableOnline] = useState(resource?.bookableOnline ?? true);
  const [isActive, setIsActive] = useState(resource?.isActive ?? true);

  const isTable = kind === 'table';

  const v = useFieldValidation({ name }, { name: rule.required('Name is required.') });

  const snapshot = () =>
    JSON.stringify({
      name,
      kind,
      timezone,
      description,
      color,
      exclusive,
      capacity,
      capacityMin,
      capacityMax,
      skillTags,
      bookableOnline,
      isActive,
    });
  const [initial] = useState(snapshot);
  const dirty = snapshot() !== initial;

  const guardLeave = useUnsavedGuard(
    dirty,
    resource ? { kind: 'edit', noun: 'resource' } : { kind: 'create', noun: 'resource' }
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
    router.push('/scheduling/resources');
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
    if (!v.validate()) return;
    setSaving(true);
    const tags = skillTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const body = {
      name: name.trim(),
      kind,
      timezone: timezone.trim() || 'UTC',
      description: description.trim() || null,
      color: color.trim() || null,
      exclusive,
      capacity,
      capacityMin: isTable && capacityMin > 0 ? capacityMin : null,
      capacityMax: isTable && capacityMax > 0 ? capacityMax : null,
      skillTags: tags,
      bookableOnline,
      isActive,
    };
    const result = resource
      ? await updateResourceAction(resource.id, body)
      : await createResourceAction(body);
    setSaving(false);
    if (result.ok) {
      toast.success(resource ? 'Resource updated' : 'Resource created');
      close();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const heading = resource ? 'Edit resource' : 'New resource';

  const body = (
    <SurfaceStep
      header={{
        title: heading,
        supporting: 'Staff, assets, tables, spaces, or equipment a booking consumes.',
      }}
      actions={{
        onNext: () => void submit(),
        nextLabel: resource ? 'Save changes' : 'Create resource',
        nextLoading: saving,
        nextDisabled: saving,
      }}
    >
      <Card>
        <CardBody className="py-6">
          <CardTitle>Resource details</CardTitle>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field {...v.field('name')}>
                <FieldLabel required>Name</FieldLabel>
                <FieldControl
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera, Table 4, Bay 2"
                  {...v.control('name')}
                />
              </Field>
              <Field>
                <FieldLabel>Type</FieldLabel>
                <NativeSelect
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ResourceKind)}
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {RESOURCE_KIND_LABEL[k]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Time zone</FieldLabel>
                <FieldControl
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g. America/New_York"
                />
              </Field>
              <Field>
                <FieldLabel>Accent color</FieldLabel>
                <FieldControl
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#6366F1"
                />
              </Field>
            </div>

            <div className={`grid gap-3 ${isTable ? 'grid-cols-3' : 'grid-cols-1'}`}>
              <Field>
                <FieldLabel>{exclusive ? 'Seats / capacity' : 'Pooled units'}</FieldLabel>
                <FieldControl
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
              {isTable ? (
                <>
                  <Field>
                    <FieldLabel>Min party</FieldLabel>
                    <FieldControl
                      type="number"
                      min={0}
                      value={capacityMin}
                      onChange={(e) => setCapacityMin(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Max party</FieldLabel>
                    <FieldControl
                      type="number"
                      min={0}
                      value={capacityMax}
                      onChange={(e) => setCapacityMax(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </Field>
                </>
              ) : null}
            </div>

            <Field>
              <FieldLabel>Skills / tags</FieldLabel>
              <FieldControl
                value={skillTags}
                onChange={(e) => setSkillTags(e.target.value)}
                placeholder="comma-separated, e.g. color, balayage"
              />
            </Field>

            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldControl
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                render={<Textarea rows={2} />}
              />
            </Field>

            <div className="flex flex-col gap-2">
              <ToggleRow
                label="Exclusive"
                hint="On: one booking at a time (double-booking blocked). Off: pooled / overbookable."
                checked={exclusive}
                onChange={setExclusive}
              />
              <ToggleRow
                label="Bookable online"
                checked={bookableOnline}
                onChange={setBookableOnline}
              />
              <ToggleRow label="Active" checked={isActive} onChange={setIsActive} />
            </div>
          </div>
        </CardBody>
      </Card>
    </SurfaceStep>
  );

  if (presentation === 'modal') {
    return (
      <ModuleProvider module="scheduling">
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
    <ModuleProvider module="scheduling" className="h-full">
      <SurfaceFrame
        variant={presentation === 'overlay' ? 'inline' : 'embedded'}
        title={heading}
        backLabel="Resources"
        headerActions={
          presentation === 'page' ? (
            <ViewSwitcher typeId="resource" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        {body}
      </SurfaceFrame>
    </ModuleProvider>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-base-content/70 text-xs">{hint}</p> : null}
      </span>
      <Switch color="module" checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
