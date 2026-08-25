'use client';

// What the product pane OFFERS, as opposed to what it exists for.
//
// Save is the surface's commit action and stays in the shell's toolbar as
// `primary`. Everything here is secondary: the link to the live page, the
// on-sale switch, and writing a post about it. They are values rather than JSX
// so each keeps its NAME in the overflow popover instead of collapsing to a
// glyph — see pane-toolbar-actions.tsx.

import {
  faArrowUpRightFromSquare,
  faEye,
  faEyeSlash,
  faShareNodes,
} from '@fortawesome/pro-solid-svg-icons';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { useActivePropertyId } from '../../lib/api/shell-data';
import type { ToolbarAction } from '../../components/pane-toolbar-actions';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useDomains } from '../domains/data';
import { productErrorMessage, usePublishProduct, type Product } from './products-data';

/**
 * The pane toolbar's secondary actions, plus the address a shopper would reach
 * this product at on the site being worked in. Every site has at least its
 * piggles.site address, so the URL is normally present.
 */
export function useProductActions(
  ctx: SurfaceContext,
  product: Product
): { actions: ToolbarAction[]; productUrl: string | null } {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: domains } = useDomains();
  const propertyId = useActivePropertyId();
  const publish = usePublishProduct(product.id);

  const retired = product.status === 'archived';
  const onSale = product.status === 'active';

  const mine = (domains ?? []).filter(
    (domain) =>
      domain.status !== 'removed' && (propertyId ? domain.propertyId === propertyId : true)
  );
  const host = (mine.find((domain) => domain.isCanonical) ?? mine[0])?.host ?? null;
  const productUrl = host ? `https://${host}/products/${product.handle}` : null;

  const togglePublished = async () => {
    if (onSale) {
      const ok = await confirm({
        title: `Take ${product.title} off sale?`,
        description:
          'It disappears from your website and nobody can buy it. Everything about it is kept, and putting it back on sale is one click.',
        confirmLabel: 'Take it off sale',
        cancelLabel: 'Leave it on sale',
        color: 'warning',
      });
      if (!ok) return;
    }
    publish.mutate(!onSale, {
      onSuccess: () => {
        toast.add({
          title: onSale ? `${product.title} is off sale` : `${product.title} is on sale`,
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not change that',
          description: productErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const actions: ToolbarAction[] = [
    ...(onSale && productUrl
      ? [{ label: 'View on your website', icon: faArrowUpRightFromSquare, href: productUrl }]
      : []),
    ...(retired
      ? []
      : [
          {
            label: onSale ? 'Take off sale' : 'Put on sale',
            icon: onSale ? faEyeSlash : faEye,
            loading: publish.isPending,
            onClick: () => {
              void togglePublished();
            },
          },
        ]),
    // The moment someone is most likely to want a social post is right after
    // putting something on sale. Wears SOCIAL's hue, because color follows
    // functionality rather than the page it appears on.
    ...(onSale
      ? [
          {
            label: 'Write a social post',
            icon: faShareNodes,
            module: 'social' as const,
            onClick: () => {
              ctx.open(
                'social.composer',
                { id: 'new', seedType: 'product', seedId: product.id },
                { target: 'beside' }
              );
            },
          },
        ]
      : []),
  ];

  return { actions, productUrl };
}
