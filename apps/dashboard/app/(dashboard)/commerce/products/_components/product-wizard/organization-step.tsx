'use client';

// Product wizard — Organization step (slice 2).
//
// Walks the merchant through the product's merchandising relations against the
// already-created draft: which collections it belongs to, which categories
// classify it, and (multi-site tenants) which sites show it. Purpose-built for
// the wizard — it owns its own state and calls the set-* actions directly rather
// than embedding the detail panels (those re-pull server props via
// router.refresh, which doesn't fit the client wizard).

import * as React from 'react';
import { Card, CardContent, Checkbox, Label, Spinner, Text, SurfaceStep } from '@sparx/ui';

import { updateProductAction } from '../../../product-actions';
import { listSitesAction, type SiteOption } from '../../../product-actions';
import { listCollectionsAction, setProductCollectionsAction } from '../../../collection-actions';
import type { CollectionOption } from '../../../collection-actions';
import { listCategoriesAction, setProductCategoriesAction } from '../../../category-actions';
import type { CategoryOption } from '../../../category-actions';

interface OrganizationStepProps {
  productId: string;
  onBack: () => void;
  /** Advance to the next step (called after a successful save, or on skip). */
  onComplete: () => void;
}

export function OrganizationStep({ productId, onBack, onComplete }: OrganizationStepProps) {
  const [loading, setLoading] = React.useState(true);
  const [collections, setCollections] = React.useState<CollectionOption[]>([]);
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [sites, setSites] = React.useState<SiteOption[]>([]);

  const [collectionIds, setCollectionIds] = React.useState<Set<string>>(new Set());
  const [categoryIds, setCategoryIds] = React.useState<Set<string>>(new Set());
  const [allSites, setAllSites] = React.useState(true);
  const [siteIds, setSiteIds] = React.useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([listCollectionsAction(), listCategoriesAction(), listSitesAction()]).then(
      ([cRes, catRes, sRes]) => {
        if (cancelled) return;
        if (cRes.ok) setCollections(cRes.data);
        if (catRes.ok) setCategories(catRes.data);
        if (sRes.ok) setSites(sRes.data);
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      if (collectionIds.size > 0) {
        const res = await setProductCollectionsAction(productId, [...collectionIds]);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
      }
      if (categoryIds.size > 0) {
        const res = await setProductCategoriesAction(productId, [...categoryIds]);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
      }
      // Visibility: empty propertyIds = all sites (docs/49 Model B).
      if (sites.length > 1) {
        const res = await updateProductAction(productId, {
          propertyIds: allSites ? [] : [...siteIds],
        });
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
      }
      onComplete();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SurfaceStep
      header={{
        title: 'Organize & merchandise',
        supporting:
          'Group this product into collections and categories, and choose where it shows.',
      }}
      actions={{
        onBack,
        onNext: () => void save(),
        onSkip: onComplete,
        nextLabel: 'Save & continue',
        nextLoading: submitting,
        nextDisabled: submitting,
      }}
    >
      <Card variant="default">
        <CardContent className="py-6">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-[var(--color-text-muted)]">
              <Spinner className="h-4 w-4" /> Loading collections & categories…
            </div>
          ) : (
            <div className="flex flex-col gap-7">
              <PickerSection
                title="Collections"
                empty="No collections yet — create them under Commerce → Collections."
                items={collections.map((c) => ({ id: c.id, label: c.name }))}
                selected={collectionIds}
                onToggle={(id) => setCollectionIds((s) => toggle(s, id))}
              />

              <PickerSection
                title="Categories"
                empty="No categories yet — create them under Commerce → Categories."
                items={categories.map((c) => ({ id: c.id, label: c.path || c.name }))}
                selected={categoryIds}
                onToggle={(id) => setCategoryIds((s) => toggle(s, id))}
              />

              {sites.length > 1 && (
                <div className="flex flex-col gap-2">
                  <Text size="sm" weight="medium">
                    Visible on
                  </Text>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSites}
                      onCheckedChange={(v) => setAllSites(v === true)}
                      aria-label="All sites"
                    />
                    <span className="text-sm">All sites</span>
                  </div>
                  {!allSites &&
                    sites.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 pl-6">
                        <Checkbox
                          checked={siteIds.has(s.id)}
                          onCheckedChange={() => setSiteIds((set) => toggle(set, s.id))}
                          aria-label={s.name}
                        />
                        <span className="text-sm">
                          {s.name}
                          {s.isPrimary ? ' · primary' : ''}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {error && (
                <Text size="sm" variant="danger" role="alert">
                  {error}
                </Text>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </SurfaceStep>
  );
}

function PickerSection({
  title,
  empty,
  items,
  selected,
  onToggle,
}: {
  title: string;
  empty: string;
  items: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{title}</Label>
      {items.length === 0 ? (
        <Text size="sm" variant="muted">
          {empty}
        </Text>
      ) : (
        <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--color-bg-subtle)]"
            >
              <Checkbox
                checked={selected.has(it.id)}
                onCheckedChange={() => onToggle(it.id)}
                aria-label={it.label}
              />
              <span className="truncate text-sm">{it.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
