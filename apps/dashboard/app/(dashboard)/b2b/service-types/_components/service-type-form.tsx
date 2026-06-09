'use client';

import { useState } from 'react';
import { Button, Stack, Text, Input } from '@sparx/ui';
import { api } from '@/lib/api-rest-client';

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

interface Props {
  type?: ServiceType;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ServiceTypeForm({ type, onSuccess, onCancel }: Props) {
  const [name, setName] = useState(type?.name ?? '');
  const [description, setDescription] = useState(type?.description ?? '');
  const [durationMinutes, setDurationMinutes] = useState(String(type?.durationMinutes ?? 60));
  const [color, setColor] = useState(type?.color ?? '');
  const [requiresVehicle, setRequiresVehicle] = useState(type?.requiresVehicle ?? false);
  const [notes, setNotes] = useState(type?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || duration < 5 || duration > 480) {
      setError('Duration must be between 5 and 480 minutes.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        durationMinutes: duration,
        color: color.trim() || undefined,
        requiresVehicle,
        notes: notes.trim() || undefined,
      };

      if (type) {
        await api.patch(`/v1/b2b/service-types/${type.id}`, body);
      } else {
        await api.post('/v1/b2b/service-types', body);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <Stack gap={4}>
        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Name <span className="text-[var(--color-danger)]">*</span>
          </Text>
          <Input
            placeholder="e.g. Oil Change, Inspection"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        </Stack>

        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Description
          </Text>
          <Input
            placeholder="Brief description for customers"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
          />
        </Stack>

        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Duration (minutes)
          </Text>
          <Input
            type="number"
            min={5}
            max={480}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            disabled={submitting}
          />
        </Stack>

        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Calendar color
          </Text>
          <Stack direction="row" gap={2} className="items-center">
            <input
              type="color"
              value={color || '#6366f1'}
              onChange={(e) => setColor(e.target.value)}
              disabled={submitting}
              className="border-input h-9 w-14 cursor-pointer rounded border"
            />
            <Input
              placeholder="#6366F1"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={submitting}
              className="w-32"
            />
            {color && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setColor('')}
                disabled={submitting}
              >
                Clear
              </Button>
            )}
          </Stack>
        </Stack>

        <Stack direction="row" gap={3} className="items-center">
          <input
            id="requires-vehicle"
            type="checkbox"
            checked={requiresVehicle}
            onChange={(e) => setRequiresVehicle(e.target.checked)}
            disabled={submitting}
            className="border-input h-4 w-4 rounded"
          />
          <label htmlFor="requires-vehicle" className="cursor-pointer text-sm">
            Requires vehicle information
          </label>
        </Stack>

        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Internal notes
          </Text>
          <Input
            placeholder="Notes visible to staff only"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
          />
        </Stack>

        {error && (
          <Text size="sm" className="text-[var(--color-danger)]">
            {error}
          </Text>
        )}

        <Stack direction="row" gap={2} className="justify-end">
          <Button type="button" variant="ghost" disabled={submitting} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" color="primary" disabled={submitting}>
            {submitting ? 'Saving…' : type ? 'Save changes' : 'Create service type'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
