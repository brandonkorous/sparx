'use client';

import { Button, Input, Label, NativeSelect } from 'silicaui-react';
import { Plus, Trash2 } from 'lucide-react';

import type { ResourceKind, ResourceRequirement } from '../_lib/types';
import { RESOURCE_KIND_LABEL } from '../_lib/format';

// Edits a service's resourceRequirements[] — the roles a booking must fill (e.g.
// a salon "color" service needs { role: stylist, kind: staff } AND { role: chair,
// kind: space }). An empty list means a single default "staff" role.
interface Props {
  value: ResourceRequirement[];
  onChange: (next: ResourceRequirement[]) => void;
}

const KINDS: ResourceKind[] = ['staff', 'asset', 'table', 'space', 'equipment'];

export function RequirementEditor({ value, onChange }: Props) {
  function update(i: number, patch: Partial<ResourceRequirement>) {
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...value, { role: '', kind: 'staff', count: 1, skillTags: [] }]);
  }

  return (
    <div className="flex flex-col gap-3">
      <Label>Resource requirements</Label>
      {value.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No explicit roles — a single staff member is assigned automatically.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.map((req, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_5rem_auto] items-end gap-2">
              <div>
                <Label className="text-xs">Role</Label>
                <Input
                  value={req.role}
                  placeholder="e.g. stylist"
                  onChange={(e) => update(i, { role: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <NativeSelect
                  value={req.kind}
                  onChange={(e) => update(i, { kind: e.target.value as ResourceKind })}
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {RESOURCE_KIND_LABEL[k]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label className="text-xs">Count</Label>
                <Input
                  type="number"
                  min={1}
                  value={req.count ?? 1}
                  onChange={(e) => update(i, { count: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
              <Button
                type="button"
                color="danger"
                variant="ghost"
                shape="square"
                aria-label="Remove requirement"
                onClick={() => remove(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 h-4 w-4" />
          Add requirement
        </Button>
      </div>
    </div>
  );
}
