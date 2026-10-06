'use client';

// A core charge sold as a CHOICE, the way a store with no core deposit had to fake
// one (issue 057). Removing the choice by hand stops versions being sold, so the
// notice points at the screen that merges them safely instead.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { isCoreOptionName } from '@wizeworks/commerce-schemas';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useProductOptions, type Product } from './products-data';

export function CoreChoiceNotice({ ctx, product }: { ctx: SurfaceContext; product: Product }) {
  // The SAVED choices: a name still being typed is not how the product is sold.
  const options = useProductOptions(product.id);
  const coreOption = (options.data ?? []).find((option) => isCoreOptionName(option.name));
  if (!coreOption) return null;

  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>This choice is a core charge set up the way your old store did it</AlertTitle>
        <AlertDescription>
          “{coreOption.name}” sells one rebuilt part as two versions, so its stock is split in two
          and the extra a buyer pays is not a deposit you can give back. Change it to one part with
          a real core deposit. Buyers can still send their old part first instead.
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button
          size="sm"
          color="warning"
          variant="outline"
          onClick={() => {
            ctx.open('commerce.core-choices.list', undefined, { target: 'beside' });
          }}
        >
          Change it to a core deposit
        </Button>
      </AlertActions>
    </Alert>
  );
}
