'use client';

import { useState } from 'react';
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

import type { ResourceKind, SchedulingResource } from '../../_lib/types';
import { RESOURCE_KIND_LABEL } from '../../_lib/format';
import { createResourceAction, updateResourceAction } from '../../_lib/actions';

interface Props {
  resource?: SchedulingResource;
  onSuccess: () => void;
  onCancel: () => void;
}

const KINDS: ResourceKind[] = ['staff', 'asset', 'table', 'space', 'equipment'];

export function ResourceForm({ resource, onSuccess, onCancel }: Props) {
  const router = useRouter();
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
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
      onSuccess();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack gap={4} className="px-1 py-2">
        <Grid cols={2} gap={3}>
          <div>
            <Label htmlFor="res-name">Name</Label>
            <Input
              id="res-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Rivera, Table 4, Bay 2"
              required
            />
          </div>
          <div>
            <Label htmlFor="res-kind">Type</Label>
            <NativeSelect
              id="res-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ResourceKind)}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {RESOURCE_KIND_LABEL[k]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </Grid>

        <Grid cols={2} gap={3}>
          <div>
            <Label htmlFor="res-tz">Time zone</Label>
            <Input
              id="res-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. America/New_York"
            />
          </div>
          <div>
            <Label htmlFor="res-color">Accent color</Label>
            <Input
              id="res-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#6366F1"
            />
          </div>
        </Grid>

        <Grid cols={isTable ? 3 : 1} gap={3}>
          <div>
            <Label htmlFor="res-cap">{exclusive ? 'Seats / capacity' : 'Pooled units'}</Label>
            <Input
              id="res-cap"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          {isTable ? (
            <>
              <div>
                <Label htmlFor="res-min">Min party</Label>
                <Input
                  id="res-min"
                  type="number"
                  min={0}
                  value={capacityMin}
                  onChange={(e) => setCapacityMin(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div>
                <Label htmlFor="res-max">Max party</Label>
                <Input
                  id="res-max"
                  type="number"
                  min={0}
                  value={capacityMax}
                  onChange={(e) => setCapacityMax(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </>
          ) : null}
        </Grid>

        <div>
          <Label htmlFor="res-skills">Skills / tags</Label>
          <Input
            id="res-skills"
            value={skillTags}
            onChange={(e) => setSkillTags(e.target.value)}
            placeholder="comma-separated, e.g. color, balayage"
          />
        </div>

        <div>
          <Label htmlFor="res-desc">Description</Label>
          <Textarea
            id="res-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <Stack gap={2}>
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
        </Stack>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" color="module" loading={saving}>
            {resource ? 'Save changes' : 'Create resource'}
          </Button>
        </div>
      </Stack>
    </form>
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
