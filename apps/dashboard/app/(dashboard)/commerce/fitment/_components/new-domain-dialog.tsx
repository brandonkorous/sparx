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
  Input,
  Label,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModuleProvider,
  NativeSelect,
  Stack,
  Text,
  toast,
} from '@sparx/ui';

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

    const filled = dimensions.filter((d) => d.label.trim());
    if (!name.trim() || !effectiveSlug) {
      setError('Name and slug are required.');
      return;
    }
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
    <Modal open={open} onOpenChange={close}>
      <ModalContent size="lg">
        <ModuleProvider module="commerce">
          <ModalHeader>
            <ModalTitle>New fitment domain</ModalTitle>
            <ModalDescription>
              Name your compatibility vocabulary, then add its dimensions — each a level (a tier in
              the tree) or a range (a numeric axis like a year or a weight). Add as many as your
              catalog needs.
            </ModalDescription>
          </ModalHeader>
          <form onSubmit={onSubmit} noValidate>
            <Stack gap={4}>
              <Stack direction="row" gap={3} className="flex-wrap">
                <Stack gap={1} className="min-w-[200px] flex-1">
                  <Label htmlFor="nd-name">Name</Label>
                  <Input
                    id="nd-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What you're matching against"
                    required
                  />
                </Stack>
                <Stack gap={1} className="min-w-[160px] flex-1">
                  <Label htmlFor="nd-slug">Slug</Label>
                  <Input
                    id="nd-slug"
                    value={effectiveSlug}
                    onChange={(e) => {
                      setSlug(slugify(e.target.value));
                      setSlugEdited(true);
                    }}
                    required
                  />
                </Stack>
              </Stack>

              <Stack gap={2}>
                <Stack direction="row" align="center" justify="between">
                  <Label>Dimensions</Label>
                  <Text size="xs" variant="muted">
                    Levels nest top → bottom; ranges narrow a match
                  </Text>
                </Stack>
                {dimensions.map((dim, i) => (
                  <Stack key={i} direction="row" gap={2} align="end" className="flex-wrap">
                    <Stack gap={1} className="min-w-[160px] flex-1">
                      {i === 0 && <Label htmlFor={`nd-dim-label-${i}`}>Label</Label>}
                      <Input
                        id={`nd-dim-label-${i}`}
                        value={dim.label}
                        onChange={(e) => patchDimension(i, { label: e.target.value })}
                        placeholder="Level or axis name"
                      />
                    </Stack>
                    <Stack gap={1} className="w-[120px]">
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
                    </Stack>
                    <Stack gap={1} className="w-[120px]">
                      {i === 0 && <Label htmlFor={`nd-dim-unit-${i}`}>Unit</Label>}
                      <Input
                        id={`nd-dim-unit-${i}`}
                        value={dim.unit}
                        onChange={(e) => patchDimension(i, { unit: e.target.value })}
                        placeholder="e.g. year"
                        disabled={dim.kind !== 'range'}
                      />
                    </Stack>
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
                  </Stack>
                ))}
                <Stack direction="row" align="center" justify="between">
                  <Button
                    type="button"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
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
                </Stack>
              </Stack>

              {error && (
                <Text size="sm" variant="danger" role="alert">
                  {error}
                </Text>
              )}
            </Stack>
            <ModalFooter>
              <Button type="button" color="neutral" variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" color="module" loading={pending} disabled={pending}>
                Create domain
              </Button>
            </ModalFooter>
          </form>
        </ModuleProvider>
      </ModalContent>
    </Modal>
  );
}
