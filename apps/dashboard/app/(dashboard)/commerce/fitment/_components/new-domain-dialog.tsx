'use client';

// Build a custom fitment domain from scratch (the "+ New domain" path that
// coexists with the dictionary library). Name it, then declare its DIMENSIONS —
// an ordered list where each is a `level` (a tier in the tree) or a `range` (a
// numeric narrowing axis). There is NO fixed depth and no industry default: add
// as many levels as the catalog needs (Brand → Line → Model → Chip for a
// computer; a single Size for apparel; Make → Model → Engine + a Year range for
// a vehicle). The values are filled in the tree editor afterward. Wrapped in
// <ModuleProvider> for the portal color footgun (packages/ui/CLAUDE.md).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Input,
  Label,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, toast } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import { createFitmentDomainAction } from '../../fitment-actions';

interface DimensionDraft {
  label: string;
  kind: 'level' | 'range';
  unit: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A stable machine key from a human label ("Rim diameter" → "rim_diameter"). */
function dimensionKey(label: string): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(base) ? base : `x_${base}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewDomainDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [dimensions, setDimensions] = React.useState<DimensionDraft[]>([
    { label: '', kind: 'level', unit: '' },
  ]);

  const effectiveSlug = slugEdited ? slug : slugify(name);

  // Field validation. Name + slug are both required; the dimension list is
  // checked separately (a repeater, not a single Field).
  const v = useFieldValidation(
    { name, slug: effectiveSlug },
    {
      name: rule.required('Name is required.'),
      slug: rule.required('Slug is required.'),
    }
  );

  function reset(): void {
    setName('');
    setSlug('');
    setSlugEdited(false);
    setDimensions([{ label: '', kind: 'level', unit: '' }]);
    setError(null);
  }

  function close(next: boolean): void {
    if (!next) reset();
    onOpenChange(next);
  }

  function patchDimension(index: number, patch: Partial<DimensionDraft>): void {
    setDimensions((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function addDimension(): void {
    setDimensions((prev) => [...prev, { label: '', kind: 'level', unit: '' }]);
  }

  function removeDimension(index: number): void {
    setDimensions((prev) => prev.filter((_, i) => i !== index));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);

    if (!v.validate()) return;

    const filled = dimensions.filter((d) => d.label.trim());
    if (filled.length === 0 || !filled.some((d) => d.kind === 'level')) {
      setError('Add at least one level dimension (a tier in the tree).');
      return;
    }
    const built = filled.map((d) => ({
      key: dimensionKey(d.label),
      label: d.label.trim(),
      kind: d.kind,
      ...(d.kind === 'range' && d.unit.trim() ? { unit: d.unit.trim() } : {}),
    }));
    const keys = new Set(built.map((d) => d.key));
    if (keys.size !== built.length) {
      setError('Each dimension needs a distinct name.');
      return;
    }

    startTransition(async () => {
      const res = await createFitmentDomainAction({
        slug: effectiveSlug,
        displayName: name.trim(),
        dimensions: built,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      toast.success(`${name.trim()} created`, {
        description: 'Fill in its values in the tree below.',
      });
      reset();
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <ModuleProvider module="commerce">
          <div className="flex flex-col gap-1">
            <DialogTitle>New fitment domain</DialogTitle>
            <DialogDescription>
              Name your compatibility vocabulary, then add its dimensions — each a level (a tier in
              the tree) or a range (a numeric axis like a year or a weight). Add as many as your
              catalog needs.
            </DialogDescription>
          </div>
          <form onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-4">
              <div className="flex flex-row flex-wrap gap-3">
                <Field {...v.field('name')} className="min-w-[200px] flex-1">
                  <FieldLabel required>Name</FieldLabel>
                  <FieldControl
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What you're matching against"
                    {...v.control('name')}
                  />
                </Field>
                <Field {...v.field('slug')} className="min-w-[160px] flex-1">
                  <FieldLabel required>Slug</FieldLabel>
                  <FieldControl
                    name="slug"
                    value={effectiveSlug}
                    onChange={(e) => {
                      setSlug(slugify(e.target.value));
                      setSlugEdited(true);
                    }}
                    {...v.control('slug')}
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-row items-center justify-between">
                  <Label>Dimensions</Label>
                  <p className="text-base-content text-xs">
                    Levels nest top → bottom; ranges narrow a match
                  </p>
                </div>
                {dimensions.map((dim, i) => (
                  <div key={i} className="flex flex-row flex-wrap items-end gap-2">
                    <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                      {i === 0 && <Label htmlFor={`nd-dim-label-${i}`}>Label</Label>}
                      <Input
                        id={`nd-dim-label-${i}`}
                        value={dim.label}
                        onChange={(e) => patchDimension(i, { label: e.target.value })}
                        placeholder="Level or axis name"
                      />
                    </div>
                    <div className="flex w-[120px] flex-col gap-1">
                      {i === 0 && <Label htmlFor={`nd-dim-kind-${i}`}>Type</Label>}
                      <NativeSelect
                        id={`nd-dim-kind-${i}`}
                        value={dim.kind}
                        onChange={(e) =>
                          patchDimension(i, { kind: e.target.value as DimensionDraft['kind'] })
                        }
                      >
                        <option value="level">Level</option>
                        <option value="range">Range</option>
                      </NativeSelect>
                    </div>
                    <div className="flex w-[120px] flex-col gap-1">
                      {i === 0 && <Label htmlFor={`nd-dim-unit-${i}`}>Unit</Label>}
                      <Input
                        id={`nd-dim-unit-${i}`}
                        value={dim.unit}
                        onChange={(e) => patchDimension(i, { unit: e.target.value })}
                        placeholder="e.g. year"
                        disabled={dim.kind !== 'range'}
                      />
                    </div>
                    <Button
                      shape="square"
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Remove dimension"
                      aria-label={`Remove dimension ${i + 1}`}
                      disabled={dimensions.length === 1}
                      onClick={() => removeDimension(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-row items-center justify-between">
                  <Button
                    type="button"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    iconStart={<Plus className="h-3.5 w-3.5" />}
                    onClick={addDimension}
                  >
                    Add dimension
                  </Button>
                  <Badge variant="soft" size="sm">
                    {dimensions.filter((d) => d.label.trim() && d.kind === 'level').length} level
                    {dimensions.filter((d) => d.label.trim() && d.kind === 'level').length === 1
                      ? ''
                      : 's'}
                  </Badge>
                </div>
              </div>

              {error && (
                <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                  {error}
                </FieldStatus>
              )}
            </div>
            <div className="mt-6 flex flex-row justify-end gap-2">
              <Button type="button" color="neutral" variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" color="module" loading={pending} disabled={pending}>
                Create domain
              </Button>
            </div>
          </form>
        </ModuleProvider>
      </DialogContent>
    </Dialog>
  );
}
