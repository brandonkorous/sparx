'use client';

// What you buy from this supplier: each item with their code and price, a
// way to stop buying one here, and a way to add another.

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { faPlus, faStar, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { formatCents } from './data';
import type { SupplierVariant } from './suppliers-data';
import { AddSupplierLink } from './supplier-detail-link-form';
import { useSupplierLinks, type SupplierLinks } from './use-supplier-links';

function LinkRow({
  link,
  currency,
  links,
}: {
  link: SupplierVariant;
  currency: string;
  links: SupplierLinks;
}) {
  return (
    <li className="border-base-300 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Text className="truncate font-medium">
            {link.productTitle ?? link.variantSku ?? 'Item'}
          </Text>
          {link.isPreferred ? (
            <Badge color="module" variant="soft" size="sm">
              <Icon glyph={faStar} className="size-3" aria-hidden />
              Preferred
            </Badge>
          ) : null}
        </div>
        <Text className="text-sm">
          {link.variantSku ? `Your code ${link.variantSku}` : 'No product code'}
          {link.supplierSku ? ` · Their code ${link.supplierSku}` : ''}
          {link.unitCostCents !== null
            ? ` · ${formatCents(link.unitCostCents, currency)} each`
            : ''}
        </Text>
      </div>
      <Button
        size="sm"
        variant="ghost"
        color="danger"
        shape="square"
        aria-label={`Stop buying ${link.productTitle ?? link.variantSku ?? 'this item'} here`}
        onClick={() => {
          void links.removeLink(link);
        }}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
      </Button>
    </li>
  );
}

export function PurchasingLinks({
  supplierId,
  variants,
  currency,
}: {
  supplierId: string;
  variants: SupplierVariant[];
  currency: string;
}) {
  const links = useSupplierLinks(supplierId);
  return (
    <FormSection
      title="What you buy from this supplier"
      description="The items you source here, with the code and price this supplier charges. An order to them starts from this list."
      action={
        links.adding ? null : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              links.setAdding(true);
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add an item
          </Button>
        )
      }
    >
      {variants.length === 0 && !links.adding ? (
        <Text className="text-sm">
          Nothing recorded yet. Add the items you buy here so their supplier code and price fill in
          automatically on an order to this supplier.
        </Text>
      ) : null}

      {variants.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {variants.map((link) => (
            <LinkRow key={link.id} link={link} currency={currency} links={links} />
          ))}
        </ul>
      ) : null}

      {links.adding ? <AddSupplierLink links={links} variants={variants} /> : null}
    </FormSection>
  );
}
