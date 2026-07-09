'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardBody, Field, FieldControl } from '@wizeworks/silicaui-react';
import { toast } from '@sparx/ui';
import { Plus, Trash2 } from 'lucide-react';

import type { AvailabilityWindow } from '../../_lib/types';
import { DAY_LABELS } from '../../_lib/format';
import { setAvailabilityWindowsAction } from '../../_lib/actions';

interface Range {
  start: number; // minutes from midnight
  end: number;
}

function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
function fromHHMM(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function group(windows: AvailabilityWindow[]): Range[][] {
  const byDay: Range[][] = [[], [], [], [], [], [], []];
  for (const w of windows) {
    byDay[w.dayOfWeek]?.push({ start: w.startMinute, end: w.endMinute });
  }
  for (const day of byDay) day.sort((a, b) => a.start - b.start);
  return byDay;
}

export function WeeklyEditor({
  resourceId,
  initialWindows,
}: {
  resourceId: string;
  initialWindows: AvailabilityWindow[];
}) {
  const router = useRouter();
  const [days, setDays] = useState<Range[][]>(() => group(initialWindows));
  const [saving, setSaving] = useState(false);

  function addRange(d: number) {
    setDays((prev) =>
      prev.map((ranges, i) => (i === d ? [...ranges, { start: 9 * 60, end: 17 * 60 }] : ranges))
    );
  }
  function removeRange(d: number, idx: number) {
    setDays((prev) =>
      prev.map((ranges, i) => (i === d ? ranges.filter((_, j) => j !== idx) : ranges))
    );
  }
  function setRange(d: number, idx: number, patch: Partial<Range>) {
    setDays((prev) =>
      prev.map((ranges, i) =>
        i === d ? ranges.map((r, j) => (j === idx ? { ...r, ...patch } : r)) : ranges
      )
    );
  }
  function copyToAll(d: number) {
    setDays((prev) => prev.map(() => prev[d]!.map((r) => ({ ...r }))));
  }

  async function save() {
    for (let d = 0; d < 7; d++) {
      for (const r of days[d]!) {
        if (r.end <= r.start) {
          toast.error(`${DAY_LABELS[d]}: end time must be after start time`);
          return;
        }
      }
    }
    setSaving(true);
    const windows = days.flatMap((ranges, dayOfWeek) =>
      ranges.map((r) => ({ dayOfWeek, startMinute: r.start, endMinute: r.end }))
    );
    const result = await setAvailabilityWindowsAction(resourceId, windows);
    setSaving(false);
    if (result.ok) {
      toast.success('Availability saved');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardBody className="py-4">
        <div className="flex flex-col gap-3">
          {DAY_LABELS.map((label, d) => (
            <div
              key={d}
              className="border-base-300 grid grid-cols-[7rem_1fr] items-start gap-3 border-b pb-3 last:border-0"
            >
              <div className="pt-2 text-sm font-medium">{label}</div>
              <div className="flex flex-col gap-2">
                {days[d]!.length === 0 ? (
                  <span className="text-base-content/70 pt-2 text-sm">Closed</span>
                ) : (
                  days[d]!.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Field className="w-32">
                        <FieldControl
                          type="time"
                          value={toHHMM(r.start)}
                          onChange={(e) => setRange(d, idx, { start: fromHHMM(e.target.value) })}
                        />
                      </Field>
                      <span className="text-base-content/70">to</span>
                      <Field className="w-32">
                        <FieldControl
                          type="time"
                          value={toHHMM(r.end)}
                          onChange={(e) => setRange(d, idx, { end: fromHHMM(e.target.value) })}
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        shape="square"
                        size="sm"
                        aria-label="Remove range"
                        onClick={() => removeRange(d, idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
                <div className="flex gap-3">
                  <Button type="button" variant="link" size="sm" onClick={() => addRange(d)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add hours
                  </Button>
                  {days[d]!.length > 0 ? (
                    <Button type="button" variant="link" size="sm" onClick={() => copyToAll(d)}>
                      Copy to all days
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button color="module" loading={saving} onClick={save}>
              Save availability
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
