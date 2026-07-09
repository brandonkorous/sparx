'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Archive, RotateCcw, Send, Undo } from 'lucide-react';

import { Badge, Button, Tooltip } from '@wizeworks/silicaui-react';
import { statusLabel, statusTone, toast, useConfirm } from '@sparx/ui';

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
  /** Rendered right after the badge — read-only/exploratory actions (Preview)
   *  before anything that mutates state, escalating left→right into Archive
   *  (rare, demoted) then the primary lifecycle action (rightmost, closest to
   *  the Form-actions divider — toolbar zone system). */
  children?: React.ReactNode;
}

// Lifecycle controls for a product, teleported into the detail frame's header
// (drawer/modal chrome or the full-page shell) via the shared header slot. The
// status badge sits with the matching lifecycle actions so the header reads as
// one cluster — a draft's one commit is Publish, an archived product's is
// Restore; an active product has no commit at all, just the reversals
// (Unpublish, Archive), so it renders visibly quieter. Errors surface as a
// toast: the header bar has no room for the inline error text the old
// in-body status bar used.
export function ProductStatusBar({ productId, status, hasVariants, children }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
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

  // Archive is reversible (Restore undoes it) but still pulls the product off
  // the site immediately, so it's gated like any other hide/remove action —
  // same rule the bulk Archive action follows.
  async function runArchive() {
    const ok = await confirm({
      title: 'Archive this product?',
      description: 'It’ll be hidden from your site and lists. Restore it any time.',
      confirmLabel: 'Archive',
      tone: 'warning',
    });
    if (!ok) return;
    run(archiveProductAction);
  }

  return (
    <div className="flex flex-row items-center gap-2">
      <Badge color={statusTone(status)} variant="soft">
        {statusLabel(status)}
      </Badge>

      {/* Read-only/exploratory first (Preview, via children) — before anything
          that mutates the record. */}
      {children}

      {/* Archive and Unpublish are both reversals, not forward commits — same
          treatment as each other: permanently icon-only + tooltip, borderless,
          so neither outweighs the actual primary action (or, for an active
          product with no primary action at all, doesn't manufacture false
          importance just because its label is long — a bordered "Unpublish"
          was the only boxed shape in an otherwise flat row and read as more
          prominent than it should. Restore stays a real labeled button below:
          it's the ONE meaningful thing to do with an archived product, not a
          reversal-among-others. */}
      {status !== 'archived' && (
        <Tooltip content="Archive">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Archive"
            disabled={pending}
            loading={pending}
            onClick={() => void runArchive()}
          >
            <Archive className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}
      {status === 'active' && (
        <Tooltip content="Unpublish">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Unpublish"
            disabled={pending}
            loading={pending}
            onClick={() => run(unpublishProductAction)}
          >
            <Undo className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}

      {/* Primary lifecycle action — the ONE forward/recovery commit for a
          state, rightmost within this zone, closest to the Form-actions
          divider (escalating left→right into the strongest action, same
          logic as Cancel→Save in Form-actions). Active has none — it's a
          steady state, nothing to push forward — so its toolbar is quieter
          than draft's or archived's by design. */}
      {status === 'draft' && (
        <Button
          type="button"
          color="module"
          size="sm"
          disabled={pending}
          loading={pending}
          iconStart={<Send className="h-4 w-4" />}
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
      {status === 'archived' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          loading={pending}
          iconStart={<RotateCcw className="h-4 w-4" />}
          onClick={() => run(restoreProductAction)}
        >
          Restore
        </Button>
      )}
    </div>
  );
}
