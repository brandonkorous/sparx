'use client';

// One cart — what a shopper put together, and whether they went through with it.
//
// A cart is a TRANSACTION-in-waiting, not a draft you author, so this reads like
// the order pane: whose cart it is rides the TAB, then the state it is in, what
// is in it, and what it comes to. Nothing here is editable — a cart belongs to
// the shopper. The one staff move is recovering an abandoned cart, and it is
// offered only when the cart was actually abandoned.

import { useEffect } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  EmptyState,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { faCartShopping } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { CartLines } from './cart-lines';
import { CartShopper } from './cart-shopper';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { deferTick } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatDateTime } from './data';
import {
  cartChannelLabel,
  cartMoney as money,
  cartErrorMessage,
  cartShopperName,
  cartStateFrom,
  useCart,
  useRecoverCart,
  type CartDetail,
} from './carts-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

export function CartDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';
  const toast = useToast();
  const confirm = useConfirm();

  const { data, isPending, isError, error, refetch } = useCart(id);
  const recover = useRecoverCart(id);

  // The tab is where a cart says whose it is — a basket has no name of its own,
  // so the shopper plus the noun is the only label that reads on its own.
  const shopperName = data ? cartShopperName(null, data.contact) : null;
  useEffect(() => {
    if (shopperName) ctx.setTitle(`${shopperName} · basket`);
  }, [ctx, shopperName]);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={error}
            noun="basket"
            title="Could not load this cart"
            description="This is a problem reaching the server. The cart itself is unaffected — nothing has been changed or lost."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending) {
    return <PaneWaiting />;
  }

  // The endpoint answers null for a cart that no longer exists (carts are swept
  // once past their hold). A dead link degrades to a clear message, never a
  // blank pane with a dead action beside it.
  if (!data) {
    return (
      <div className={PANE_SHELL}>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={<Icon glyph={faCartShopping} className="size-6" aria-hidden />}
            title="This cart is no longer here"
            description="It may have been paid for and turned into an order, or cleared away after sitting untouched. Nothing is wrong — there is just nothing to show."
          />
        </div>
      </div>
    );
  }

  const cart: CartDetail = data;
  const state = cartStateFrom(cart);
  const shopper = cartShopperName(null, cart.contact);
  // Not `&& !cart.recoveredAt`: a basket that came back once and went quiet
  // again is abandoned again, and she can win it back again. `recoveredAt` is
  // the history of that, not a door that closes (persona issue 289).
  const canRecover = Boolean(cart.abandonedAt);

  const lines = cart.items.length;
  const facts = [
    cartChannelLabel(cart.channel),
    `${String(lines)} ${lines === 1 ? 'line' : 'lines'}`,
  ];

  const onRecover = async () => {
    const ok = await confirm({
      title: 'Mark this cart as recovered?',
      description:
        `This records that ${shopper} came back to this cart. Use it when you have confirmed the ` +
        'sale went through another way — it does not charge anyone or send anything.',
      confirmLabel: 'Mark as recovered',
      cancelLabel: 'Leave it',
      color: 'module',
    });
    if (!ok) return;
    await deferTick();
    recover.mutate(undefined, {
      onSuccess: () => {
        toast.add({ title: 'Cart marked as recovered', type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not mark this cart as recovered',
          description: cartErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Cart actions"
        status={
          <>
            <Badge color={state.tone} variant="soft" size="sm">
              {state.label}
            </Badge>
            <div className="flex-1" />
            <Text className="text-sm tabular-nums">
              {money(cart.totals.totalCents, cart.currency)}
            </Text>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className={COLUMN}>
          <Text className="text-sm">{facts.join(' · ')}</Text>

          <Alert color={state.tone} variant="soft">
            <AlertContent>
              <AlertTitle>{state.label}</AlertTitle>
              <AlertDescription>
                {state.detail}
                {cart.abandonedAt ? ` Left ${formatDateTime(cart.abandonedAt)}.` : ''}
                {cart.recoveredAt ? ` Came back ${formatDateTime(cart.recoveredAt)}.` : ''}
              </AlertDescription>
            </AlertContent>
          </Alert>

          <CartLines cart={cart} />

          <CartShopper customer={null} contact={cart.contact} />

          {canRecover ? (
            <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Text className="text-base font-medium">Mark this cart as recovered</Text>
                <Text className="text-sm">
                  Records that the shopper came back to it. It does not charge anyone or send any
                  email — it just updates the cart’s state for your reports.
                </Text>
              </div>
              <Button
                size="sm"
                color="module"
                variant="soft"
                loading={recover.isPending}
                onClick={() => {
                  void onRecover();
                }}
              >
                Mark recovered
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
