'use client';

import { useCallback, useEffect, useState } from 'react';
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

import type {
  AssignmentStrategy,
  BookingPolicy,
  BookingType,
  ResourceRequirement,
  SchedulingService,
} from '../../_lib/types';
import { BOOKING_TYPE_LABEL } from '../../_lib/format';
import { RequirementEditor } from '../../_components/requirement-editor';
import {
  createServiceAction,
  listBookingPoliciesAction,
  updateServiceAction,
} from '../../_lib/actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// Service create/edit on the standard form surface (docs/86 F layout). ONE
// component drives all three presentations the host picks:
//   - presentation="page"    → SurfaceFrame `embedded` at /scheduling/services/new
//   - presentation="overlay" → SurfaceFrame `inline` inside the @detail drawer/modal
//   - presentation="modal"   → SurfaceFrame `modal` (self-owned dialog) for edit
//     from the list row (the list has no detail view, so editing rides a modal —
//     the same blessed pattern as the new-site wizard).
// Create has no detail view, so a successful create returns to the list.

type Presentation = 'page' | 'overlay' | 'modal';

interface ServiceFormProps {
  presentation: Presentation;
  /** Present → edit; absent → create. */
  service?: SchedulingService;
  /** Modal (edit) only — controlled open state owned by the list. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TYPES: BookingType[] = ['appointment', 'class', 'reservation', 'rental'];
const STRATEGIES: { value: AssignmentStrategy; label: string }[] = [
  { value: 'any_available', label: 'Any available' },
  { value: 'round_robin', label: 'Round-robin (balance load)' },
  { value: 'customer_choice', label: 'Customer chooses' },
  { value: 'collective', label: 'Collective (all required)' },
];

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function ServiceForm({ presentation, service, open, onOpenChange }: ServiceFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(service?.name ?? '');
  const [bookingType, setBookingType] = useState<BookingType>(
    service?.bookingType ?? 'appointment'
  );
  const [description, setDescription] = useState(service?.description ?? '');
  const [durationMinutes, setDuration] = useState(service?.durationMinutes ?? 60);
  const [bufferBeforeMin, setBufferBefore] = useState(service?.bufferBeforeMin ?? 0);
  const [bufferAfterMin, setBufferAfter] = useState(service?.bufferAfterMin ?? 0);
  const [priceDollars, setPriceDollars] = useState((service?.priceCents ?? 0) / 100);
  const [capacity, setCapacity] = useState(service?.capacity ?? 1);
  const [slotIntervalMin, setSlotInterval] = useState(service?.slotIntervalMin ?? 15);
  const [minLeadMinutes, setMinLead] = useState(service?.minLeadMinutes ?? 0);
  const [maxAdvanceDays, setMaxAdvance] = useState(service?.maxAdvanceDays ?? 365);
  const [strategy, setStrategy] = useState<AssignmentStrategy>(
    service?.assignmentStrategy ?? 'any_available'
  );
  const [requirements, setRequirements] = useState<ResourceRequirement[]>(
    service?.resourceRequirements ?? []
  );
  const [bookableOnline, setBookableOnline] = useState(service?.bookableOnline ?? true);
  const [requiresApproval, setRequiresApproval] = useState(service?.requiresApproval ?? false);
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [policyId, setPolicyId] = useState(service?.policyId ?? '');
  const [policies, setPolicies] = useState<BookingPolicy[]>([]);

  const v = useFieldValidation({ name }, { name: rule.required('Name is required.') });

  // Load policies for the picker — attaching one opts the service into deposits,
  // cancellation fees, and reminders (docs/79 §9).
  useEffect(() => {
    void listBookingPoliciesAction().then((r) => {
      if (r.ok) setPolicies(r.data);
    });
  }, []);

  // Dirty = current field set differs from the snapshot captured on mount (empty
  // defaults for create, the record's values for edit). One mechanism covers
  // both, and the lazy initializer is StrictMode-safe (no skip-first-render ref).
  const snapshot = () =>
    JSON.stringify({
      name,
      bookingType,
      description,
      durationMinutes,
      bufferBeforeMin,
      bufferAfterMin,
      priceDollars,
      capacity,
      slotIntervalMin,
      minLeadMinutes,
      maxAdvanceDays,
      strategy,
      requirements,
      bookableOnline,
      requiresApproval,
      isActive,
      policyId,
    });
  const [initial] = useState(snapshot);
  const dirty = snapshot() !== initial;

  const guardLeave = useUnsavedGuard(
    dirty,
    service ? { kind: 'edit', noun: 'service' } : { kind: 'create', noun: 'service' }
  );

  // Leave WITHOUT the guard — the success path and (through the guarded paths) a
  // confirmed discard. Modal hands control back to the list; the overlay clears
  // the detail token; the page returns to the list.
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
    router.push('/scheduling/services');
  }, [presentation, onOpenChange, pathname, searchParams, router]);

  const cancel = useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // Modal-only dismissal guards (Radix backdrop/Esc want a sync boolean; the
  // footer Cancel is async). Mirrors the new-site wizard.
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
    const body = {
      name: name.trim(),
      bookingType,
      description: description.trim() || null,
      durationMinutes,
      bufferBeforeMin,
      bufferAfterMin,
      priceCents: Math.round(priceDollars * 100),
      capacity,
      slotIntervalMin,
      minLeadMinutes,
      maxAdvanceDays,
      assignmentStrategy: strategy,
      resourceRequirements: requirements.filter((r) => r.role.trim()),
      policyId: policyId || null,
      bookableOnline,
      requiresApproval,
      isActive,
    };
    const result = service
      ? await updateServiceAction(service.id, body)
      : await createServiceAction(body);
    setSaving(false);
    if (result.ok) {
      toast.success(service ? 'Service updated' : 'Service created');
      close();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const heading = service ? 'Edit service' : 'New service';

  const body = (
    <SurfaceStep
      header={{
        title: heading,
        supporting: 'Define something bookable and how it gets staffed.',
      }}
      actions={{
        onNext: () => void submit(),
        nextLabel: service ? 'Save changes' : 'Create service',
        nextLoading: saving,
        nextDisabled: saving,
      }}
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardBody className="py-6">
            <CardTitle>Basics</CardTitle>
            <div className="flex flex-col gap-4">
              <Field {...v.field('name')}>
                <FieldLabel required>Name</FieldLabel>
                <FieldControl
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Haircut, Yoga class, Dinner table"
                  {...v.control('name')}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Booking type</FieldLabel>
                  <NativeSelect
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value as BookingType)}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {BOOKING_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel>Assignment</FieldLabel>
                  <NativeSelect
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as AssignmentStrategy)}
                  >
                    {STRATEGIES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <Field>
                <FieldLabel>Description</FieldLabel>
                <FieldControl
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  render={<Textarea rows={2} />}
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <NumberField
                  label="Duration (min)"
                  value={durationMinutes}
                  min={1}
                  onChange={setDuration}
                />
                <NumberField
                  label="Buffer before"
                  value={bufferBeforeMin}
                  min={0}
                  onChange={setBufferBefore}
                />
                <NumberField
                  label="Buffer after"
                  value={bufferAfterMin}
                  min={0}
                  onChange={setBufferAfter}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <FieldLabel>Price ($)</FieldLabel>
                  <FieldControl
                    type="number"
                    min={0}
                    step="0.01"
                    value={priceDollars}
                    onChange={(e) => setPriceDollars(Number(e.target.value) || 0)}
                  />
                </Field>
                <NumberField
                  label={bookingType === 'class' ? 'Capacity (seats)' : 'Capacity'}
                  value={capacity}
                  min={1}
                  onChange={setCapacity}
                />
                <NumberField
                  label="Slot interval (min)"
                  value={slotIntervalMin}
                  min={1}
                  onChange={setSlotInterval}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Min lead time (min)"
                  value={minLeadMinutes}
                  min={0}
                  onChange={setMinLead}
                />
                <NumberField
                  label="Max advance (days)"
                  value={maxAdvanceDays}
                  min={0}
                  onChange={setMaxAdvance}
                />
              </div>

              <Field>
                <FieldLabel>Booking policy</FieldLabel>
                <NativeSelect value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
                  <option value="">No policy</option>
                  {policies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="py-6">
            <CardTitle>Staffing &amp; availability</CardTitle>
            <div className="flex flex-col gap-4">
              <RequirementEditor value={requirements} onChange={setRequirements} />

              <div className="flex flex-col gap-2">
                <ToggleRow
                  label="Bookable online"
                  checked={bookableOnline}
                  onChange={setBookableOnline}
                />
                <ToggleRow
                  label="Requires approval"
                  hint="Bookings start as Requested until staff confirm."
                  checked={requiresApproval}
                  onChange={setRequiresApproval}
                />
                <ToggleRow label="Active" checked={isActive} onChange={setIsActive} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
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
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        {body}
      </SurfaceFrame>
    </ModuleProvider>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
      />
    </Field>
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
