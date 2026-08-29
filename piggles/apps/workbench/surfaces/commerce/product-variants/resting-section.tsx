'use client';

// Stopped versions whose combination is being sold by something else.
//
// Nothing is wrong with these. Retiring a version and selling a new one on the
// same combination is how anybody replaces a line, and the old one settles here.
//
// They are listed rather than hidden because their codes stay RESERVED, and a
// code held by a row nobody can see is what makes "that code already exists"
// impossible to answer. They carry no "Sell it again" either: two versions on
// sale in one combination is exactly the state this tab exists to prevent, so
// the way back is to stop the one on sale first, which the sentence says.

import { Badge, Text } from '@wizeworks/silicaui-react';

import { FormSection } from '../../../components/form-section';
import { formatCents, type Variant } from '../products-data';

export function RestingSection({ resting }: { resting: Variant[] }) {
  if (resting.length === 0) return null;

  return (
    <FormSection
      title="Kept, but not sold"
      description="Each of these sits on a combination you are already selling something else in, so nothing needs doing. They are kept because past orders refer to them and their codes stay reserved. To go back to one, stop selling the version in its combination and it appears there ready to sell again."
    >
      {resting.map((variant) => (
        // The code gets a line of its own when the row is narrow, and never a
        // "…". These are listed BECAUSE of their codes, and at 360px truncation
        // cut two of five to the same "THE-EVERYDAY-X…" and a third lost its
        // size — which is the one thing the list is for.
        <div
          key={variant.id}
          className="border-base-300 flex flex-col gap-1 border-b pb-2 last:border-b-0 @md:flex-row @md:items-center @md:gap-2"
        >
          <Text className="min-w-0 flex-1 break-all">{variant.sku}</Text>
          <div className="flex items-center gap-2">
            <Text as="span" className="tabular-nums">
              {formatCents(variant.priceCents, variant.currency)}
            </Text>
            <Badge variant="outline" size="sm">
              Not sold
            </Badge>
          </div>
        </div>
      ))}
    </FormSection>
  );
}
