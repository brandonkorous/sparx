'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import { Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { AdaptiveLabel, ModuleProvider, toast } from '@sparx/ui';

import { SeoMetaFields } from '@/components/seo/seo-meta-fields';

import { updateProductAction } from '../../../product-actions';
import { DetailFooterSlot } from '../../../../_components/detail-header-slot';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

interface Props {
  productId: string;
  title: string;
  handle: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

// SEO tab for a product — the single home for the search-engine title +
// description (moved off the Overview tab so each concern lives in one place,
// docs/86 §5). Uses the shared <SeoMetaFields> (inherited value as placeholder +
// per-field "Use name/description"), shows a live Google-style preview, and
// saves on its own (explicit save, no autosave — matches the platform standard).

export function ProductSeoForm({
  productId,
  title,
  handle,
  description,
  seoTitle,
  seoDescription,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const initialTitle = seoTitle ?? '';
  const initialDescription = seoDescription ?? '';
  const [seoTitleValue, setSeoTitle] = React.useState(initialTitle);
  const [seoDescriptionValue, setSeoDescription] = React.useState(initialDescription);

  const dirty = seoTitleValue !== initialTitle || seoDescriptionValue !== initialDescription;

  // Unsaved-changes guard — same shared channel the overlay chrome's Close /
  // Switch / backdrop-Esc consult before leaving, so SEO edits aren't silently
  // dropped on an accidental close.
  useUnsavedGuard(dirty, {
    title: 'Discard unsaved changes?',
    description: 'Your SEO edits haven’t been saved. Leaving now will discard them.',
  });

  // What the storefront/search actually renders: SEO field if set, else inherit.
  const previewTitle = seoTitleValue.trim() || title;
  const previewDescription =
    seoDescriptionValue.trim() ||
    (description ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavedAt(null);
    startTransition(async () => {
      const result = await updateProductAction(productId, {
        seoTitle: seoTitleValue.trim() || null,
        seoDescription: seoDescriptionValue.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    // SEO is its own module — the tab wears SEO yellow (color-follows-functionality,
    // like the Inventory tab's amber). The footer Save teleports out of this
    // provider, so the page-primary action keeps the active commerce accent.
    <ModuleProvider module="seo">
      <form id="product-seo-form" onSubmit={onSubmit} noValidate>
        <Card>
          <CardBody>
            <h2 className="text-xl font-semibold">Search engine listing</h2>
            <p className="opacity-70">What this product looks like in Google / Bing results.</p>
            <div className="flex flex-col gap-4">
              <div className="border-base-300 bg-base-200 flex flex-col gap-1 rounded-md border p-3">
                <p className="text-info text-sm">{previewTitle}</p>
                <p className="text-base-content text-xs">storefront.example/products/{handle}</p>
                <p className="text-xs">{previewDescription || '(set a description to preview)'}</p>
              </div>

              <SeoMetaFields
                type="product"
                id={productId}
                nameSource={title}
                descriptionSource={description}
                seoTitle={seoTitleValue}
                seoDescription={seoDescriptionValue}
                onSeoTitleChange={setSeoTitle}
                onSeoDescriptionChange={setSeoDescription}
                className="border-base-300 border-t pt-4"
              />
            </div>
          </CardBody>
        </Card>

        <DetailFooterSlot>
          <div className="flex items-center gap-2">
            {savedAt !== null && !dirty && (
              <span className="text-success flex items-center gap-1 text-xs">
                <Check className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
            <Button
              type="submit"
              form="product-seo-form"
              size="sm"
              color="module"
              disabled={pending || !dirty}
              loading={pending}
            >
              <AdaptiveLabel label={{ full: 'Save changes', short: 'Save' }} />
            </Button>
          </div>
        </DetailFooterSlot>
      </form>
    </ModuleProvider>
  );
}
