'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Archive, RotateCcw, Send, Undo } from 'lucide-react';

import { Badge, Button, Stack, statusLabel, statusTone, toast } from '@sparx/ui';

import {
  archiveProductAction,
  publishProductAction,
  restoreProductAction,
  unpublishProductAction,
} from '../../../product-actions';

interface Props {
  productId: string;
  status: 'draft' | 'active' | 'archived';
  hasVariants: boolean;
}

// Lifecycle controls for a product, teleported into the detail frame's header
// (drawer/modal chrome or the full-page shell) via the shared header slot. The
// status badge sits with the matching lifecycle action so the header reads as
// one cluster — a draft offers Publish, an active product Unpublish, an archived
// one Restore. Errors surface as a toast: the header bar has no room for the
// inline error text the old in-body status bar used.
export function ProductStatusBar({ productId, status, hasVariants }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(
    action: (
      id: string
    ) => Promise<{ ok: true; data: unknown } | { ok: false; error: { message: string } }>
  ) {
    startTransition(async () => {
      const result = await action(productId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Stack direction="row" align="center" gap={2}>
      <Badge color={statusTone(status)} variant="soft">
        {statusLabel(status)}
      </Badge>
      {status === 'draft' && (
        <Button
          type="button"
          color="module"
          size="sm"
          disabled={pending}
          loading={pending}
          leftIcon={<Send className="h-4 w-4" />}
          onClick={() => run(publishProductAction)}
          title={
            hasVariants
              ? 'Publish to the storefront'
              : 'No variants yet — published without a price'
          }
        >
          Publish
        </Button>
      )}
      {status === 'active' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          loading={pending}
          leftIcon={<Undo className="h-4 w-4" />}
          onClick={() => run(unpublishProductAction)}
        >
          Unpublish
        </Button>
      )}
      {status === 'archived' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          loading={pending}
          leftIcon={<RotateCcw className="h-4 w-4" />}
          onClick={() => run(restoreProductAction)}
        >
          Restore
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          loading={pending}
          leftIcon={<Archive className="h-4 w-4" />}
          onClick={() => run(archiveProductAction)}
        >
          Archive
        </Button>
      )}
    </Stack>
  );
}
