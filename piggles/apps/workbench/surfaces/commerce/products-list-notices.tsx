'use client';

// Ways a healthy-looking catalog is quietly costing her something, and one way
// the screen itself is out of date.
//
// Each is worded as a consequence to the BUSINESS rather than as a system state:
// "customers can't find these" rather than "search index empty". None of them is
// rendered from a guess — `null` means the check could not run and says nothing
// at all, because a failed request must never accuse a business of something
// that may not be true.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  useToast,
} from '@wizeworks/silicaui-react';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useReindexSearch } from './products-data';

export function ProductsListNotices({
  ctx,
  cannotBePaid,
  invisibleShop,
  staleAfterFailure,
  onRetry,
}: {
  ctx: SurfaceContext;
  cannotBePaid: boolean;
  invisibleShop: boolean;
  staleAfterFailure: boolean;
  onRetry: () => void;
}) {
  const toast = useToast();
  const reindex = useReindexSearch();

  return (
    <>
      {cannotBePaid ? (
        <Alert color="warning" className="m-2">
          <AlertContent>
            <AlertTitle>Nobody can pay you on your site yet</AlertTitle>
            <AlertDescription>
              Customers can fill a basket and reach the last step, and then there is no way for them
              to hand over the money — so the order is lost right at the end. Connect a card
              processor and they can pay you.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            onClick={() => {
              ctx.open('commerce.providers', {}, { target: 'tab' });
            }}
          >
            Set this up
          </Button>
        </Alert>
      ) : null}
      {invisibleShop ? (
        // INFO, not warning. Since issue 203 the shop falls back to the catalog
        // when this list is empty, so what is broken is the search box beside it
        // — not the shop, and not louder than nobody being able to pay her.
        <Alert color="info" className="m-2">
          <AlertContent>
            <AlertTitle>Searching your shop won’t find these</AlertTitle>
            <AlertDescription>
              Your products are on your site and people can buy them. What isn’t working is the
              search box and the filters beside your shop — those look things up in a separate list,
              and yours is empty, so a customer searching for something by name may be told you
              don’t have it.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            loading={reindex.isPending}
            onClick={() => {
              reindex.mutate(undefined, {
                onSuccess: () => {
                  // No time estimate. The rebuild runs somewhere else, and this
                  // screen cannot see whether it started — promising "a minute or
                  // two" would be inventing a fact. The message above IS the
                  // status: it disappears when the products are findable again.
                  toast.add({
                    title: 'Asked for your products to be put back',
                    description:
                      'The message above will go when searching finds them again. If it is still there tomorrow, tell us.',
                    type: 'success',
                  });
                },
                onError: () => {
                  toast.add({
                    title: 'Could not start that',
                    description: 'Nothing changed. Try again in a moment.',
                    type: 'error',
                  });
                },
              });
            }}
          >
            Put them back
          </Button>
        </Alert>
      ) : null}

      {staleAfterFailure ? (
        <Alert color="warning" className="m-2">
          <AlertContent>
            <AlertTitle>Could not check for changes just now</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server. The products below are what loaded last, and
              may be out of date.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            variant="soft"
            onClick={() => {
              onRetry();
            }}
          >
            Try again
          </Button>
        </Alert>
      ) : null}
    </>
  );
}
