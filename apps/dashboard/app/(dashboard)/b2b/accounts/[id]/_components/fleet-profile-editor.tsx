'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Text,
  Badge,
} from '@sparx/ui';
import { Plus, Trash2, Truck } from 'lucide-react';

interface EngineProfile {
  fitmentCategoryId?: string;
  fitmentItemId?: string;
  fitmentVariantId?: string;
  year?: number;
  displayName: string;
  count: number;
}

interface FitmentNode {
  id: string;
  name: string;
  slug: string;
}

interface FleetProfileEditorProps {
  accountId: string;
  initialProfiles: EngineProfile[];
  fleetSize?: number | null;
}

export function FleetProfileEditor({ accountId, initialProfiles }: FleetProfileEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<EngineProfile[]>(initialProfiles);
  const [saving, setSaving] = useState(false);

  // Fitment vocabulary cascade state
  const [domains, setDomains] = useState<(FitmentNode & { rangeUnit?: string })[]>([]);
  const [categories, setCategories] = useState<FitmentNode[]>([]);
  const [items, setItems] = useState<FitmentNode[]>([]);
  const [variants, setVariants] = useState<FitmentNode[]>([]);

  // Add-profile form state
  const [addOpen, setAddOpen] = useState(false);
  const [selDomain, setSelDomain] = useState('');
  const [selCategory, setSelCategory] = useState('');
  const [selItem, setSelItem] = useState('');
  const [selVariant, setSelVariant] = useState('');
  const [selYear, setSelYear] = useState('');
  const [selCount, setSelCount] = useState('1');

  useEffect(() => {
    if (!addOpen) return;
    fetch('/api/fitment/domains')
      .then((r) => r.json() as Promise<{ data?: (FitmentNode & { rangeUnit?: string })[] }>)
      .then((j) => setDomains(j.data ?? []))
      .catch(() => setDomains([]));
  }, [addOpen]);

  useEffect(() => {
    if (!selDomain) {
      setCategories([]);
      return;
    }
    fetch(`/api/fitment/domains/${selDomain}/categories`)
      .then((r) => r.json() as Promise<{ data?: FitmentNode[] }>)
      .then((j) => setCategories(j.data ?? []))
      .catch(() => setCategories([]));
  }, [selDomain]);

  useEffect(() => {
    if (!selCategory) {
      setItems([]);
      return;
    }
    fetch(`/api/fitment/categories/${selCategory}/items`)
      .then((r) => r.json() as Promise<{ data?: FitmentNode[] }>)
      .then((j) => setItems(j.data ?? []))
      .catch(() => setItems([]));
  }, [selCategory]);

  useEffect(() => {
    if (!selItem) {
      setVariants([]);
      return;
    }
    fetch(`/api/fitment/items/${selItem}/variants`)
      .then((r) => r.json() as Promise<{ data?: FitmentNode[] }>)
      .then((j) => setVariants(j.data ?? []))
      .catch(() => setVariants([]));
  }, [selItem]);

  function handleAddProfile() {
    const cat = categories.find((c) => c.id === selCategory);
    const item = items.find((i) => i.id === selItem);
    const variant = variants.find((v) => v.id === selVariant);

    const parts = [selYear, cat?.name, item?.name, variant?.name].filter(Boolean);
    const displayName = parts.join(' ') || 'Unknown vehicle';

    const profile: EngineProfile = {
      fitmentCategoryId: selCategory || undefined,
      fitmentItemId: selItem || undefined,
      fitmentVariantId: selVariant || undefined,
      year: selYear ? parseInt(selYear, 10) : undefined,
      displayName,
      count: parseInt(selCount, 10) || 1,
    };

    setProfiles((prev) => [...prev, profile]);
    setAddOpen(false);
    setSelDomain('');
    setSelCategory('');
    setSelItem('');
    setSelVariant('');
    setSelYear('');
    setSelCount('1');
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/b2b/accounts/${accountId}/engine-profiles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profiles,
          fleetSize: profiles.reduce((sum, p) => sum + p.count, 0),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        alert(err?.message ?? 'Failed to save');
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Truck className="mr-1 h-4 w-4" />
        Edit fleet
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>Fleet profiles</ModalTitle>
          </ModalHeader>

          <Stack gap={3} className="max-h-96 overflow-y-auto">
            {profiles.length === 0 ? (
              <Text size="sm" variant="muted" className="py-4 text-center">
                No vehicles in fleet yet.
              </Text>
            ) : (
              profiles.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2"
                >
                  <div>
                    <Text size="sm" className="font-medium">
                      {p.displayName}
                    </Text>
                    <Badge color="module" variant="soft" className="mt-1">
                      ×{p.count}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    color="danger"
                    onClick={() => setProfiles((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </Stack>

          {/* Add vehicle sub-dialog */}
          <Modal open={addOpen} onOpenChange={setAddOpen}>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add vehicle
            </Button>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>Add vehicle to fleet</ModalTitle>
              </ModalHeader>
              <Stack gap={4} className="py-2">
                <div>
                  <label htmlFor="fleet-domain" className="mb-1 block text-sm font-medium">
                    Domain
                  </label>
                  <Select value={selDomain} onValueChange={setSelDomain}>
                    <SelectTrigger id="fleet-domain">
                      <SelectValue placeholder="Select domain…" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {categories.length > 0 && (
                  <div>
                    <label htmlFor="fleet-category" className="mb-1 block text-sm font-medium">
                      Make
                    </label>
                    <Select value={selCategory} onValueChange={setSelCategory}>
                      <SelectTrigger id="fleet-category">
                        <SelectValue placeholder="Select make…" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {items.length > 0 && (
                  <div>
                    <label htmlFor="fleet-item" className="mb-1 block text-sm font-medium">
                      Model
                    </label>
                    <Select value={selItem} onValueChange={setSelItem}>
                      <SelectTrigger id="fleet-item">
                        <SelectValue placeholder="Select model…" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {variants.length > 0 && (
                  <div>
                    <label htmlFor="fleet-variant" className="mb-1 block text-sm font-medium">
                      Engine
                    </label>
                    <Select value={selVariant} onValueChange={setSelVariant}>
                      <SelectTrigger id="fleet-variant">
                        <SelectValue placeholder="Select engine…" />
                      </SelectTrigger>
                      <SelectContent>
                        {variants.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label htmlFor="fleet-year" className="mb-1 block text-sm font-medium">
                      Year
                    </label>
                    <Input
                      id="fleet-year"
                      type="number"
                      min={1900}
                      max={2100}
                      value={selYear}
                      onChange={(e) => setSelYear(e.target.value)}
                      placeholder="e.g. 2020"
                    />
                  </div>
                  <div className="w-24">
                    <label htmlFor="fleet-count" className="mb-1 block text-sm font-medium">
                      Count
                    </label>
                    <Input
                      id="fleet-count"
                      type="number"
                      min={1}
                      value={selCount}
                      onChange={(e) => setSelCount(e.target.value)}
                    />
                  </div>
                </div>
              </Stack>
              <ModalFooter>
                <Button variant="ghost" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddProfile} disabled={!selCategory && !selYear}>
                  Add to fleet
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <ModalFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save fleet'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
