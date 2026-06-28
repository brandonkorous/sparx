'use client';

// Build a custom fitment domain from scratch (the "+ New domain" path that
// coexists with the dictionary library). Name it, then declare how many levels
// it has and what they're called — Make → Model → Engine for a vehicle shop,
// or a single Size axis for apparel. Categories/items/variants are added in the
// tree editor afterward. Wrapped in <ModuleProvider> for the portal color
// footgun (packages/ui/CLAUDE.md).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
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

const RANGE_UNITS = ['year', 'lb', 'kg', 'month', 'us_shoe', 'eu_shoe', 'mm', 'in'] as const;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  const [l1, setL1] = React.useState('');
  const [l2, setL2] = React.useState('');
  const [l3, setL3] = React.useState('');
  const [rangeUnit, setRangeUnit] = React.useState('');
  const [rangeLabel, setRangeLabel] = React.useState('');

  const effectiveSlug = slugEdited ? slug : slugify(name);

  function reset(): void {
    setName('');
    setSlug('');
    setSlugEdited(false);
    setL1('');
    setL2('');
    setL3('');
    setRangeUnit('');
    setRangeLabel('');
    setError(null);
  }

  function close(next: boolean): void {
    if (!next) reset();
    onOpenChange(next);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !effectiveSlug || !l1.trim()) {
      setError('Name, slug, and the first level label are required.');
      return;
    }
    startTransition(async () => {
      const labels: Record<string, string> = { l1: l1.trim() };
      if (l2.trim()) labels.l2 = l2.trim();
      if (l2.trim() && l3.trim()) labels.l3 = l3.trim();
      if (rangeUnit && rangeLabel.trim()) labels.range = rangeLabel.trim();
      const res = await createFitmentDomainAction({
        slug: effectiveSlug,
        displayName: name.trim(),
        labels,
        ...(rangeUnit ? { rangeUnit } : {}),
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      toast.success(`${name.trim()} created`, {
        description: 'Add its categories, items, and variants in the tree.',
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
              Build a custom compatibility vocabulary — name it, then choose how many levels it has
              (e.g. Make → Model → Engine, or just Size).
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
                    placeholder="Vehicle"
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
              <Stack gap={1}>
                <Label htmlFor="nd-l1">First level label</Label>
                <Input
                  id="nd-l1"
                  value={l1}
                  onChange={(e) => setL1(e.target.value)}
                  placeholder="Make"
                  required
                />
              </Stack>
              <Stack direction="row" gap={3} className="flex-wrap">
                <Stack gap={1} className="min-w-[160px] flex-1">
                  <Label htmlFor="nd-l2">Second level (optional)</Label>
                  <Input
                    id="nd-l2"
                    value={l2}
                    onChange={(e) => setL2(e.target.value)}
                    placeholder="Model"
                  />
                </Stack>
                <Stack gap={1} className="min-w-[160px] flex-1">
                  <Label htmlFor="nd-l3">Third level (optional)</Label>
                  <Input
                    id="nd-l3"
                    value={l3}
                    onChange={(e) => setL3(e.target.value)}
                    placeholder="Engine"
                    disabled={!l2.trim()}
                  />
                </Stack>
              </Stack>
              <Stack direction="row" gap={3} className="flex-wrap">
                <Stack gap={1} className="min-w-[160px] flex-1">
                  <Label htmlFor="nd-range-unit">Numeric range (optional)</Label>
                  <NativeSelect
                    id="nd-range-unit"
                    value={rangeUnit}
                    onChange={(e) => setRangeUnit(e.target.value)}
                  >
                    <option value="">None</option>
                    {RANGE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </NativeSelect>
                </Stack>
                <Stack gap={1} className="min-w-[160px] flex-1">
                  <Label htmlFor="nd-range-label">Range label</Label>
                  <Input
                    id="nd-range-label"
                    value={rangeLabel}
                    onChange={(e) => setRangeLabel(e.target.value)}
                    placeholder="Year"
                    disabled={!rangeUnit}
                  />
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
