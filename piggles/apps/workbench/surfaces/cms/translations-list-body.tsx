'use client';

// What the translations card shows: the failed load, the wait, the empty state, or
// the products with the languages each one is written in.

import { EmptyState } from '@wizeworks/silicaui-react';
import { faLanguage } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Table } from '../../components/table';
import type { ProductTranslation, TranslatableProduct } from './translations-data';
import { TranslationRow } from './translation-row';

type OpenProduct = (
  product: TranslatableProduct,
  event: { shiftKey: boolean; altKey: boolean }
) => void;

interface TranslationsBodyProps {
  error: unknown;
  isLoading: boolean;
  narrowed: boolean;
  rows: TranslatableProduct[];
  byProduct: Map<string, ProductTranslation[]>;
  coverageLoading: boolean;
  onRetry: () => void;
  onOpen: OpenProduct;
}

function TranslationsTable({ rows, byProduct, coverageLoading, onOpen }: TranslationsBodyProps) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Product</th>
          <th className="hidden @2xl:table-cell">Status</th>
          <th className="hidden @4xl:table-cell">Last translated</th>
          <th>Languages</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((product) => (
          <TranslationRow
            key={product.id}
            product={product}
            languages={byProduct.get(product.id)}
            coverageLoading={coverageLoading}
            onOpen={onOpen}
          />
        ))}
      </tbody>
    </Table>
  );
}

// A failed load REPLACES the table: "no products yet" over a failure is a lie
// about their catalog.
export function TranslationsBody(props: TranslationsBodyProps) {
  const { error, narrowed } = props;
  if (error) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faLanguage} className="size-6" aria-hidden />}
        title="Could not load your products"
        description="This is a problem reaching the server. Nothing you have written or translated is affected: none of it has been lost."
        error={error}
        onRetry={props.onRetry}
      />
    );
  }
  if (props.isLoading) return <PaneWaiting />;
  if (props.rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faLanguage} className="size-6" aria-hidden />}
        title={narrowed ? 'Nothing matches that' : 'No products to translate yet'}
        description={
          narrowed
            ? 'Try part of the product name, or widen the filter to see the rest of your catalog.'
            : 'Once you add a product, this is where you translate its name and description into the other languages your customers read.'
        }
      />
    );
  }
  return <TranslationsTable {...props} />;
}
