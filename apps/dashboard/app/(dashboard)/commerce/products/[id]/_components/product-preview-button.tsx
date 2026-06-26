'use client';

// "Copy preview link" for a DRAFT (or archived) product — mints a short-lived
// token via the server action and writes a copy-able storefront URL to the
// clipboard. The URL points at the tenant's storefront on <slug>.sparx.zone
// with the token in `?sparxPreview=`; the PDP reads it and relaxes the
// published-only filter so the draft renders. Mirrors the CMS PreviewButton
// (docs/86 §5.1): icon-only in the frame header, label via tooltip + toast.

import * as React from 'react';
import { Check, Eye } from 'lucide-react';

import { Button, toast } from '@sparx/ui';

import { mintProductPreviewUrl } from '../../../product-actions';

const ZONE_DOMAIN = process.env.NEXT_PUBLIC_SPARX_ZONE_DOMAIN ?? 'sparx.zone';

export function ProductPreviewButton({
  productId,
  handle,
  tenantSlug,
}: {
  productId: string;
  handle: string;
  tenantSlug: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [recentlyCopied, setRecentlyCopied] = React.useState(false);

  function onClick() {
    startTransition(async () => {
      const result = await mintProductPreviewUrl(productId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      // The mint returns the current handle; prefer it over a stale prop.
      const slug = result.data.handle || handle;
      const url = `https://${tenantSlug}.${ZONE_DOMAIN}/products/${slug}?sparxPreview=${encodeURIComponent(result.data.token)}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(
          'Preview link copied — opens the draft on your storefront (expires in 15 min).'
        );
        setRecentlyCopied(true);
        setTimeout(() => setRecentlyCopied(false), 2000);
      } catch {
        toast.error('Clipboard blocked — copy the URL manually from the address bar.');
      }
    });
  }

  const label = recentlyCopied ? 'Preview link copied' : 'Copy preview link';
  return (
    <Button
      type="button"
      color={recentlyCopied ? 'module' : 'neutral'}
      variant={recentlyCopied ? 'outline' : 'ghost'}
      size="sm"
      leftIcon={
        recentlyCopied ? <Check className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />
      }
      onClick={onClick}
      disabled={pending}
      loading={pending}
      aria-label={label}
      title={label}
    >
      {recentlyCopied ? 'Copied' : 'Preview'}
    </Button>
  );
}
