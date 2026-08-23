'use client';

// Adding a product — the four answers it takes to exist, and nothing else.
// Everything about it comes after, on the tabs in product-detail.tsx.
//
// ── The price starts BLANK, and that is the whole point ──────────────────
//
// It opened holding "0.00". Not a placeholder — a real value in the box, with
// no way to tell. Click in, type 128.00, and the caret lands in front of the
// zeros: the field settles on 128000.00, a plausible-looking number nobody
// typed and a price a thousand times too high (issue 169).
//
// So it is a `MoneyTextInput`, which owns its text and can be empty. Empty means
// nobody has said yet, which is a different answer from free — and it is
// required, because "every product needs a price" is what this form promises.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { moneyCents, moneyProblem } from '../../components/money-input';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  productErrorMessage,
  slugifyHandle,
  suggestSku,
  useCreateProduct,
  VariantAfterCreateError,
} from './products-data';
import { NewProductFields } from './product-add-fields';

/** The one column everything sits in, matching the manage view beside it. */
const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

export function AddProduct({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const create = useCreateProduct();

  const [title, setTitle] = useState('');
  const [handle, setHandle] = useState('');
  const [touchedHandle, setTouchedHandle] = useState(false);
  const [sku, setSku] = useState('');
  const [touchedSku, setTouchedSku] = useState(false);
  const [price, setPrice] = useState('');
  const [onSale, setOnSale] = useState(false);

  // The web address and the code follow the name until someone edits one
  // themselves, at which point it is theirs and typing more of the name must not
  // overwrite it.
  const effectiveHandle = touchedHandle ? handle : slugifyHandle(title);
  const effectiveSku = touchedSku ? sku : suggestSku(title);

  const trimmed = title.trim();
  const dirty = trimmed !== '' || touchedHandle || touchedSku || price.trim() !== '';
  useDirtySource(dirty && !create.isSuccess, 'This product has not been added yet. Close anyway?');

  const titleError = trimmed === '' ? 'Give the product a name.' : null;
  const skuError = effectiveSku.trim() === '' ? 'Give the product a code.' : null;
  const priceError = price.trim() === '' ? 'Give the product a price.' : moneyProblem(price);
  const blocked = Boolean(titleError) || Boolean(skuError) || Boolean(priceError);

  /**
   * Whether an error may be SHOWN yet — not the same question as whether it is
   * true. The first product form a new business ever opens used to greet them
   * with a red field and "Give the product a code." before they had typed a
   * character, in place of the description explaining what a code even is.
   */
  const started = trimmed !== '' || touchedSku;
  const shownSkuError = started ? skuError : null;
  const shownPriceError = price.trim() === '' ? null : priceError;

  // A half-created product is a real outcome, not a hypothetical: the product and
  // its price are two writes. If the second fails, the product EXISTS, so the only
  // honest thing to do is say so and land on it — a generic "could not create"
  // would send someone to add it again and end up with two.
  const halfCreated = create.error instanceof VariantAfterCreateError;
  const failure = create.isError
    ? productErrorMessage(create.error, 'Could not add that product. Nothing was created.')
    : null;

  const landOn = (
    id: string,
    told: { title: string; description: string; type: 'success' | 'warning' }
  ) => {
    ctx.open('commerce.product.detail', { id }, { target: 'replace' });
    afterPaneChange(() => {
      toast.add(told);
    });
  };

  const submit = () => {
    const cents = moneyCents(price);
    if (blocked || cents === null) return;
    create.mutate(
      {
        title: trimmed,
        ...(effectiveHandle ? { handle: effectiveHandle } : {}),
        status: onSale ? 'active' : 'draft',
        sku: effectiveSku.trim(),
        priceCents: cents,
      },
      {
        onSuccess: (created) => {
          landOn(created.id, {
            title: `${trimmed} added`,
            description: onSale
              ? 'It is on your website now.'
              : 'It is saved but not on sale yet — put it on sale when you are ready.',
            type: 'success',
          });
        },
        onError: (error) => {
          if (!(error instanceof VariantAfterCreateError)) return;
          landOn(error.productId, {
            title: `${trimmed} was added without a price`,
            description: 'Set its price here — nobody can buy it until you do.',
            type: 'warning',
          });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="New product actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            loading={create.isPending}
            disabled={blocked}
            onClick={submit}
          >
            Add product
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <Text>
            A product is one thing you sell. Give it a name and a price now — the description,
            photos and everything else can follow once it exists.
          </Text>

          {/* ONE message, the most specific one. When the product itself was
              created and only its price failed, this says what happened rather
              than claiming nothing was created. */}
          {failure ? (
            <Alert color={halfCreated ? 'warning' : 'error'} variant="soft">
              <AlertContent>
                <AlertTitle>
                  {halfCreated
                    ? 'The product was added, but its price was not'
                    : 'Could not add that product'}
                </AlertTitle>
                <AlertDescription>{failure}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <NewProductFields
            title={title}
            onTitle={setTitle}
            handle={effectiveHandle}
            onHandle={(value) => {
              setTouchedHandle(true);
              setHandle(slugifyHandle(value));
            }}
            price={price}
            onPrice={setPrice}
            priceError={shownPriceError}
            sku={effectiveSku}
            onSku={(value) => {
              setTouchedSku(true);
              setSku(value);
            }}
            skuError={shownSkuError}
            onSale={onSale}
            onOnSale={setOnSale}
          />
        </div>
      </div>
    </div>
  );
}
