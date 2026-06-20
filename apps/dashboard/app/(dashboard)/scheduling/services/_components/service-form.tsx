'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Grid,
  Input,
  Label,
  NativeSelect,
  Stack,
  Switch,
  Textarea,
  toast,
} from '@sparx/ui';

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

interface Props {
  service?: SchedulingService;
  onSuccess: () => void;
  onCancel: () => void;
}

const TYPES: BookingType[] = ['appointment', 'class', 'reservation', 'rental'];
const STRATEGIES: { value: AssignmentStrategy; label: string }[] = [
  { value: 'any_available', label: 'Any available' },
  { value: 'round_robin', label: 'Round-robin (balance load)' },
  { value: 'customer_choice', label: 'Customer chooses' },
  { value: 'collective', label: 'Collective (all required)' },
];

export function ServiceForm({ service, onSuccess, onCancel }: Props) {
  const router = useRouter();
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

  // Load policies for the picker — attaching one opts the service into deposits,
  // cancellation fees, and reminders (docs/79 §9).
  useEffect(() => {
    void listBookingPoliciesAction().then((r) => {
      if (r.ok) setPolicies(r.data);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
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
      onSuccess();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack gap={4} className="px-1 py-2">
        <div>
          <Label htmlFor="svc-name">Name</Label>
          <Input
            id="svc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Haircut, Yoga class, Dinner table"
            required
          />
        </div>

        <Grid cols={2} gap={3}>
          <div>
            <Label htmlFor="svc-type">Booking type</Label>
            <NativeSelect
              id="svc-type"
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value as BookingType)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {BOOKING_TYPE_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="svc-strategy">Assignment</Label>
            <NativeSelect
              id="svc-strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as AssignmentStrategy)}
            >
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </Grid>

        <div>
          <Label htmlFor="svc-desc">Description</Label>
          <Textarea
            id="svc-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <Grid cols={3} gap={3}>
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
        </Grid>

        <Grid cols={3} gap={3}>
          <div>
            <Label htmlFor="svc-price">Price ($)</Label>
            <Input
              id="svc-price"
              type="number"
              min={0}
              step="0.01"
              value={priceDollars}
              onChange={(e) => setPriceDollars(Number(e.target.value) || 0)}
            />
          </div>
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
        </Grid>

        <Grid cols={2} gap={3}>
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
        </Grid>

        <div>
          <Label htmlFor="svc-policy">Booking policy</Label>
          <NativeSelect
            id="svc-policy"
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
          >
            <option value="">No policy</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <RequirementEditor value={requirements} onChange={setRequirements} />

        <Stack gap={2}>
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
        </Stack>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" color="module" loading={saving}>
            {service ? 'Save changes' : 'Create service'}
          </Button>
        </div>
      </Stack>
    </form>
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
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
      />
    </div>
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
        <span className="text-sm font-medium">{label}</span>
        {hint ? (
          <span className="block text-xs text-[var(--color-muted-foreground)]">{hint}</span>
        ) : null}
      </span>
      <Switch color="module" checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
