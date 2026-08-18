'use client';

// What a template page renders, and which of them it is for.
//
// A template has no single address — it is one design used for every product, post
// or service. What an author CAN choose is how narrow it is: the design every
// product uses, or the one just for a kind of product they sell differently.

import { Field, FieldDescription, FieldLabel, NativeSelect } from '@wizeworks/silicaui-react';
import type { PageDoc } from '@wizeworks/studio';
import { useApply } from '@wizeworks/studio/react';
import { useProductTypeChoices } from '../../lib/studio/site-data';

/** What one record of this type is called, in the words a shop owner uses. */
const RECORD_LABELS: Record<string, string> = {
  'commerce.product': 'product',
  'commerce.category': 'category',
  'commerce.collection': 'collection',
  'cms.blog_post': 'post',
  'cms.post': 'post',
  'scheduling.service': 'service',
};

/** The one record type that can be narrowed further — a shop sells apparel and
 *  machinery differently, and each can have its own design. */
const PRODUCT_TYPE = 'commerce.product';

export function RecordTarget({ doc }: { doc: PageDoc }) {
  const noun = RECORD_LABELS[doc.recordType ?? ''] ?? 'record';

  return (
    <>
      <Field>
        <FieldLabel>What this page shows</FieldLabel>
        <p className="text-base-content text-sm">
          One {noun} at a time, using this design for every one of them.
        </p>
        <FieldDescription>
          There is no single address for a template — each {noun} gets its own.
        </FieldDescription>
      </Field>
      {doc.recordType === PRODUCT_TYPE ? <ProductTypeTarget doc={doc} /> : null}
    </>
  );
}

/**
 * Which products this design is for.
 *
 * "Every product" is the default and stays selectable, because narrowing a page is
 * reversible and an author who narrowed it by mistake needs the way back to be as
 * plain as the way in.
 */
function ProductTypeTarget({ doc }: { doc: PageDoc }) {
  const apply = useApply();
  const types = useProductTypeChoices(true);
  const current = doc.recordSubtype ?? '';

  return (
    <Field>
      <FieldLabel>Which products</FieldLabel>
      <NativeSelect
        value={current}
        onChange={(event) => {
          const value = event.currentTarget.value || null;
          if (value === doc.recordSubtype) return;
          apply('Change which products', [
            { kind: 'page.setRecord', recordType: doc.recordType, recordSubtype: value },
          ]);
        }}
      >
        <option value="">Every product</option>
        {(types.data ?? []).map((type) => (
          <option key={type.key} value={type.key}>
            Only {type.name}
          </option>
        ))}
      </NativeSelect>
      <FieldDescription>
        Pick a kind of product to give it its own design. Everything else keeps the “Every product”
        one.
      </FieldDescription>
    </Field>
  );
}
