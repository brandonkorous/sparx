'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  Stack,
  Text,
  useConfirm,
} from '@sparx/ui';

import { SeoMetaFields } from '@/components/seo/seo-meta-fields';

import { updateProductAction } from '../../../product-actions';
import { DetailFooterSlot } from '../../../../_components/detail-header-slot';
import { useRegisterLeaveGuard } from '../../../../_components/unsaved-guard';

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
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const initialTitle = seoTitle ?? '';
  const initialDescription = seoDescription ?? '';
  const [seoTitleValue, setSeoTitle] = React.useState(initialTitle);
  const [seoDescriptionValue, setSeoDescription] = React.useState(initialDescription);

  const dirty = seoTitleValue !== initialTitle || seoDescriptionValue !== initialDescription;

  // Unsaved-changes guard — same shared channel the overlay chrome's Close /
  // Switch / backdrop-Esc consult before leaving, so SEO edits aren't silently
  // dropped on an accidental close.
  const confirm = useConfirm();
  const guardLeave = React.useCallback(async (): Promise<boolean> => {
    if (!dirty) return true;
    return confirm({
      title: 'Discard unsaved changes?',
      description: 'Your SEO edits haven’t been saved. Leaving now will discard them.',
      confirmLabel: 'Discard changes',
      tone: 'danger',
    });
  }, [dirty, confirm]);
  useRegisterLeaveGuard(guardLeave);

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
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const result = await updateProductAction(productId, {
        seoTitle: seoTitleValue.trim() || null,
        seoDescription: seoDescriptionValue.trim() || null,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <form id="product-seo-form" onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <Heading level={3} as="h2">
            Search engine listing
          </Heading>
          <CardDescription>What this product looks like in Google / Bing results.</CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack
              gap={1}
              className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3"
            >
              <Text size="sm" className="text-[var(--color-info)]">
                {previewTitle}
              </Text>
              <Text size="xs" variant="muted">
                storefront.example/products/{handle}
              </Text>
              <Text size="xs">{previewDescription || '(set a description to preview)'}</Text>
            </Stack>

            <SeoMetaFields
              type="product"
              id={productId}
              nameSource={title}
              descriptionSource={description}
              seoTitle={seoTitleValue}
              seoDescription={seoDescriptionValue}
              onSeoTitleChange={setSeoTitle}
              onSeoDescriptionChange={setSeoDescription}
              className="border-t border-[var(--color-border-default)] pt-4"
            />
          </Stack>
        </CardContent>
      </Card>

      <DetailFooterSlot>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-3">
          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mr-auto">
              {error}
            </Text>
          )}
          {savedAt !== null && !dirty && (
            <Stack
              direction="row"
              align="center"
              gap={1}
              className="text-[var(--color-success-text)]"
            >
              <Check className="h-4 w-4" />
              <Text size="sm" variant="success">
                Saved
              </Text>
            </Stack>
          )}
          <Button
            type="submit"
            form="product-seo-form"
            color="module"
            disabled={pending || !dirty}
            loading={pending}
          >
            Save changes
          </Button>
        </div>
      </DetailFooterSlot>
    </form>
  );
}
