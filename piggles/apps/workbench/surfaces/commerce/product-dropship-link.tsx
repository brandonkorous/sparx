'use client';

// "Have a supplier ship this" (sparx persona issue 171). A maker or wholesaler
// who ships when sent the order has no product list to import from: the owner
// already sells the product, so they choose the supplier here, and every sale of
// it is emailed to that supplier from then on.

import { useState } from 'react';
import { Button, Text, useToast } from '@wizeworks/silicaui-react';
import { faLinkSlash, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  productErrorMessage,
  type DropshipLink,
  type Product,
  type ProductDropship,
} from './products-data';
import { useHandLinkedSuppliers, useStopSupplierShipping } from './product-dropship-link-data';
import { ShipFromSupplierForm } from './product-dropship-link-form';

function AddSupplierFirst({ ctx }: { ctx: SurfaceContext }) {
  return (
    <div className="flex flex-col gap-3">
      <Text className="text-sm">
        A maker or wholesaler who ships to your customer when you send them the order can ship this
        for you. Add them first, with the email address they take orders at.
      </Text>
      <div className="flex justify-start">
        <Button
          size="sm"
          color="module"
          onClick={() => {
            ctx.open('dropship.supplier.detail', { id: 'new', type: 'direct' }, { target: 'tab' });
          }}
        >
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          Add a supplier you send orders to
        </Button>
      </div>
    </div>
  );
}

/** On a product nobody ships for the business: choose the supplier who will. */
export function ShipFromSupplierSection({
  ctx,
  product,
  data,
}: {
  ctx: SurfaceContext;
  product: Product;
  data: ProductDropship;
}) {
  const { suppliers, isError } = useHandLinkedSuppliers();
  if (isError) {
    return (
      <Text className="text-sm">
        Your suppliers could not be loaded, so nobody can be chosen to ship this right now.
      </Text>
    );
  }
  if (suppliers === undefined) {
    return (
      <p className="text-sm" role="status">
        Loading your suppliers…
      </p>
    );
  }
  if (suppliers.length === 0) return <AddSupplierFirst ctx={ctx} />;
  return (
    <div className="flex flex-col gap-2">
      <Text className="text-sm">
        Have a supplier ship {product.title} to your customer. Each time someone buys it, we email
        them the order from your business, with your customer’s address.
      </Text>
      <ShipFromSupplierForm product={product} data={data} suppliers={suppliers} />
    </div>
  );
}

/** Asks, then stops the supplier shipping the product. */
function useStop(link: DropshipLink, product: Product) {
  const toast = useToast();
  const confirm = useConfirm();
  const stop = useStopSupplierShipping(product.id);
  const onStop = async () => {
    const ok = await confirm({
      title: `Stop ${link.supplier.name} shipping ${product.title}?`,
      description:
        'From now on, when someone buys it, the order is not emailed to them: you pick, pack and post it yourself. Orders already sent to them are not changed.',
      confirmLabel: 'Stop them shipping it',
      cancelLabel: 'Keep it with them',
      color: 'warning',
    });
    if (!ok) return;
    stop.mutate(link.id, {
      onSuccess: () => {
        toast.add({ title: `You ship ${product.title} yourself now`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not change who ships it',
          description: productErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };
  return { onStop, isPending: stop.isPending };
}

/** Change a hand-made link's code or price, or stop the supplier shipping it.
 *  Takes the place of "Pull it again", which needs a product list. */
export function HandLinkedActions({
  link,
  product,
  data,
}: {
  link: DropshipLink;
  product: Product;
  data: ProductDropship;
}) {
  const [editing, setEditing] = useState(false);
  const { onStop, isPending } = useStop(link, product);
  if (editing) {
    return (
      <div className="border-base-300 border-t pt-4">
        <ShipFromSupplierForm
          product={product}
          data={data}
          suppliers={[{ id: link.supplier.id, name: link.supplier.name }]}
          link={link}
          onDone={() => {
            setEditing(false);
          }}
        />
      </div>
    );
  }
  return (
    <div className="border-base-300 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
      <Button
        size="sm"
        variant="outline"
        color="module"
        onClick={() => {
          setEditing(true);
        }}
      >
        Change their code or price
      </Button>
      <Button
        size="sm"
        variant="outline"
        color="warning"
        loading={isPending}
        onClick={() => {
          void onStop();
        }}
      >
        <Icon glyph={faLinkSlash} className="size-4" aria-hidden />
        Stop them shipping it
      </Button>
    </div>
  );
}
