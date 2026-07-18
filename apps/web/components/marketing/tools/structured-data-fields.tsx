'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, Input, Textarea, NativeSelect } from '@wizeworks/silicaui-react';
import { Field } from './ui-kit';

/**
 * The per-schema-type field sets for the structured-data tool.
 *
 * These live apart from the tool shell because they are a different
 * responsibility: the shell owns state, JSON-LD assembly, and the output pane,
 * while this file is purely the declaration of "which inputs does schema.org's
 * LocalBusiness / Product / Article / FAQPage want". Adding a schema type means
 * touching only this file plus `build()`.
 */

export type SchemaType = 'LocalBusiness' | 'Product' | 'Article' | 'FAQPage';
export type Fields = Record<string, string>;

export interface Qa {
  q: string;
  a: string;
}

export const SCHEMA_TYPES: { value: SchemaType; label: string }[] = [
  { value: 'LocalBusiness', label: 'Local business' },
  { value: 'Product', label: 'Product' },
  { value: 'Article', label: 'Article' },
  { value: 'FAQPage', label: 'FAQ' },
];

interface FieldSetProps {
  val: (key: string) => string;
  set: (key: string, value: string) => void;
}

function LocalBusinessFields({ val, set }: FieldSetProps) {
  return (
    <>
      <div className="tool-fieldgrid">
        <Field label="Business name">
          <Input value={val('name')} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Website">
          <Input value={val('url')} onChange={(e) => set('url', e.target.value)} />
        </Field>
      </div>
      <div className="tool-fieldgrid">
        <Field label="Phone">
          <Input value={val('phone')} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Price range" hint="e.g. $$">
          <Input value={val('priceRange')} onChange={(e) => set('priceRange', e.target.value)} />
        </Field>
      </div>
      <Field label="Street">
        <Input value={val('street')} onChange={(e) => set('street', e.target.value)} />
      </Field>
      <div className="tool-fieldgrid">
        <Field label="City">
          <Input value={val('city')} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="Region / state">
          <Input value={val('region')} onChange={(e) => set('region', e.target.value)} />
        </Field>
      </div>
      <div className="tool-fieldgrid">
        <Field label="Postal code">
          <Input value={val('postal')} onChange={(e) => set('postal', e.target.value)} />
        </Field>
        <Field label="Country" hint="2-letter code, e.g. US">
          <Input value={val('country')} onChange={(e) => set('country', e.target.value)} />
        </Field>
      </div>
    </>
  );
}

function ProductFields({ val, set }: FieldSetProps) {
  return (
    <>
      <Field label="Product name">
        <Input value={val('name')} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea
          rows={2}
          value={val('description')}
          onChange={(e) => set('description', e.target.value)}
        />
      </Field>
      <div className="tool-fieldgrid">
        <Field label="Brand">
          <Input value={val('brand')} onChange={(e) => set('brand', e.target.value)} />
        </Field>
        <Field label="Image URL">
          <Input value={val('image')} onChange={(e) => set('image', e.target.value)} />
        </Field>
      </div>
      <div className="tool-fieldgrid">
        <Field label="Price">
          <Input
            type="number"
            value={val('price')}
            onChange={(e) => set('price', e.target.value)}
          />
        </Field>
        <Field label="Currency" hint="e.g. USD">
          <Input value={val('currency')} onChange={(e) => set('currency', e.target.value)} />
        </Field>
      </div>
      <Field label="Availability">
        <NativeSelect
          value={val('availability') || 'InStock'}
          onChange={(e) => set('availability', e.target.value)}
        >
          <option value="InStock">In stock</option>
          <option value="OutOfStock">Out of stock</option>
          <option value="PreOrder">Pre-order</option>
        </NativeSelect>
      </Field>
    </>
  );
}

function ArticleFields({ val, set }: FieldSetProps) {
  return (
    <>
      <Field label="Headline">
        <Input value={val('headline')} onChange={(e) => set('headline', e.target.value)} />
      </Field>
      <Field label="Image URL">
        <Input value={val('image')} onChange={(e) => set('image', e.target.value)} />
      </Field>
      <div className="tool-fieldgrid">
        <Field label="Author">
          <Input value={val('author')} onChange={(e) => set('author', e.target.value)} />
        </Field>
        <Field label="Published date" hint="YYYY-MM-DD">
          <Input type="date" value={val('date')} onChange={(e) => set('date', e.target.value)} />
        </Field>
      </div>
      <Field label="Publisher">
        <Input value={val('publisher')} onChange={(e) => set('publisher', e.target.value)} />
      </Field>
    </>
  );
}

export interface FaqFieldsProps {
  faq: Qa[];
  setFaq: React.Dispatch<React.SetStateAction<Qa[]>>;
}

/** Repeating question/answer rows, each on its own silica `Card`. */
export function FaqFields({ faq, setFaq }: FaqFieldsProps) {
  const patch = (i: number, key: keyof Qa, value: string) =>
    setFaq((p) => p.map((x, j) => (j === i ? { ...x, [key]: value } : x)));

  return (
    <div className="flex flex-col gap-3">
      {faq.map((item, i) => (
        <Card key={i}>
          <CardBody className="flex flex-col gap-2 p-3">
            <Input
              placeholder="Question"
              value={item.q}
              onChange={(e) => patch(i, 'q', e.target.value)}
            />
            <div className="flex items-start gap-2">
              <Textarea
                rows={2}
                placeholder="Answer"
                value={item.a}
                onChange={(e) => patch(i, 'a', e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                color="neutral"
                size="sm"
                shape="square"
                aria-label="Remove"
                disabled={faq.length === 1}
                onClick={() => setFaq((p) => p.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          color="neutral"
          size="sm"
          onClick={() => setFaq((p) => [...p, { q: '', a: '' }])}
        >
          <Plus className="h-4 w-4" /> Add question
        </Button>
      </div>
    </div>
  );
}

export interface SchemaFieldsProps extends FieldSetProps {
  type: SchemaType;
  faq: Qa[];
  setFaq: React.Dispatch<React.SetStateAction<Qa[]>>;
}

/** Renders the field set for the selected schema type. */
export function SchemaFields({ type, val, set, faq, setFaq }: SchemaFieldsProps) {
  if (type === 'LocalBusiness') return <LocalBusinessFields val={val} set={set} />;
  if (type === 'Product') return <ProductFields val={val} set={set} />;
  if (type === 'Article') return <ArticleFields val={val} set={set} />;
  return <FaqFields faq={faq} setFaq={setFaq} />;
}
