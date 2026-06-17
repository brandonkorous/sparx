'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Textarea, NativeSelect } from '@sparx/ui';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton } from './ui-kit';

type SchemaType = 'LocalBusiness' | 'Product' | 'Article' | 'FAQPage';
type Fields = Record<string, string>;
interface Qa {
  q: string;
  a: string;
}

const TYPES: { value: SchemaType; label: string }[] = [
  { value: 'LocalBusiness', label: 'Local business' },
  { value: 'Product', label: 'Product' },
  { value: 'Article', label: 'Article' },
  { value: 'FAQPage', label: 'FAQ' },
];

function prune<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(prune).filter((v) => v !== undefined && v !== '') as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const pv = prune(v);
      if (pv !== undefined && pv !== '' && !(typeof pv === 'object' && pv !== null && Object.keys(pv).length === 0)) {
        out[k] = pv;
      }
    }
    return out as T;
  }
  return obj;
}

function build(type: SchemaType, f: Fields, faq: Qa[]): object {
  const base = { '@context': 'https://schema.org', '@type': type };
  if (type === 'LocalBusiness')
    return {
      ...base,
      name: f.name,
      url: f.url,
      telephone: f.phone,
      priceRange: f.priceRange,
      address: {
        '@type': 'PostalAddress',
        streetAddress: f.street,
        addressLocality: f.city,
        addressRegion: f.region,
        postalCode: f.postal,
        addressCountry: f.country,
      },
    };
  if (type === 'Product')
    return {
      ...base,
      name: f.name,
      image: f.image,
      description: f.description,
      brand: f.brand ? { '@type': 'Brand', name: f.brand } : '',
      offers: {
        '@type': 'Offer',
        price: f.price,
        priceCurrency: f.currency,
        availability: `https://schema.org/${f.availability ?? 'InStock'}`,
      },
    };
  if (type === 'Article')
    return {
      ...base,
      headline: f.headline,
      image: f.image,
      author: f.author ? { '@type': 'Person', name: f.author } : '',
      datePublished: f.date,
      publisher: f.publisher ? { '@type': 'Organization', name: f.publisher } : '',
    };
  return {
    ...base,
    mainEntity: faq
      .filter((x) => x.q.trim())
      .map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
  };
}

export function StructuredDataTool() {
  const [type, setType] = React.useState<SchemaType>('LocalBusiness');
  const [fields, setFields] = React.useState<Fields>({ name: 'Acme Co.', url: 'https://acme.co' });
  const [faq, setFaq] = React.useState<Qa[]>([{ q: '', a: '' }]);
  const set = (k: string, v: string) => setFields((p) => ({ ...p, [k]: v }));
  const val = (k: string) => fields[k] ?? '';

  const json = JSON.stringify(prune(build(type, fields, faq)), null, 2);
  const snippet = `<script type="application/ld+json">\n${json}\n</script>`;

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Schema type">
          <div className="mkt-cluster" style={{ gap: '8px' }}>
            {TYPES.map((t) => (
              <Button
                key={t.value}
                type="button"
                size="sm"
                variant={type === t.value ? 'solid' : 'outline'}
                color={type === t.value ? 'module' : 'neutral'}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel title="Details">
          {type === 'LocalBusiness' ? (
            <>
              <div className="tool-fieldgrid">
                <Field label="Business name"><Input value={val('name')} onChange={(e) => set('name', e.target.value)} /></Field>
                <Field label="Website"><Input value={val('url')} onChange={(e) => set('url', e.target.value)} /></Field>
              </div>
              <div className="tool-fieldgrid">
                <Field label="Phone"><Input value={val('phone')} onChange={(e) => set('phone', e.target.value)} /></Field>
                <Field label="Price range" hint="e.g. $$"><Input value={val('priceRange')} onChange={(e) => set('priceRange', e.target.value)} /></Field>
              </div>
              <Field label="Street"><Input value={val('street')} onChange={(e) => set('street', e.target.value)} /></Field>
              <div className="tool-fieldgrid">
                <Field label="City"><Input value={val('city')} onChange={(e) => set('city', e.target.value)} /></Field>
                <Field label="Region / state"><Input value={val('region')} onChange={(e) => set('region', e.target.value)} /></Field>
              </div>
              <div className="tool-fieldgrid">
                <Field label="Postal code"><Input value={val('postal')} onChange={(e) => set('postal', e.target.value)} /></Field>
                <Field label="Country" hint="2-letter code, e.g. US"><Input value={val('country')} onChange={(e) => set('country', e.target.value)} /></Field>
              </div>
            </>
          ) : null}

          {type === 'Product' ? (
            <>
              <Field label="Product name"><Input value={val('name')} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Description"><Textarea rows={2} value={val('description')} onChange={(e) => set('description', e.target.value)} /></Field>
              <div className="tool-fieldgrid">
                <Field label="Brand"><Input value={val('brand')} onChange={(e) => set('brand', e.target.value)} /></Field>
                <Field label="Image URL"><Input value={val('image')} onChange={(e) => set('image', e.target.value)} /></Field>
              </div>
              <div className="tool-fieldgrid">
                <Field label="Price"><Input type="number" value={val('price')} onChange={(e) => set('price', e.target.value)} /></Field>
                <Field label="Currency" hint="e.g. USD"><Input value={val('currency')} onChange={(e) => set('currency', e.target.value)} /></Field>
              </div>
              <Field label="Availability">
                <NativeSelect value={val('availability') || 'InStock'} onChange={(e) => set('availability', e.target.value)}>
                  <option value="InStock">In stock</option>
                  <option value="OutOfStock">Out of stock</option>
                  <option value="PreOrder">Pre-order</option>
                </NativeSelect>
              </Field>
            </>
          ) : null}

          {type === 'Article' ? (
            <>
              <Field label="Headline"><Input value={val('headline')} onChange={(e) => set('headline', e.target.value)} /></Field>
              <Field label="Image URL"><Input value={val('image')} onChange={(e) => set('image', e.target.value)} /></Field>
              <div className="tool-fieldgrid">
                <Field label="Author"><Input value={val('author')} onChange={(e) => set('author', e.target.value)} /></Field>
                <Field label="Published date" hint="YYYY-MM-DD"><Input type="date" value={val('date')} onChange={(e) => set('date', e.target.value)} /></Field>
              </div>
              <Field label="Publisher"><Input value={val('publisher')} onChange={(e) => set('publisher', e.target.value)} /></Field>
            </>
          ) : null}

          {type === 'FAQPage' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {faq.map((item, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)' }}>
                  <Input placeholder="Question" value={item.q} onChange={(e) => setFaq((p) => p.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <Textarea rows={2} placeholder="Answer" value={item.a} onChange={(e) => setFaq((p) => p.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                    <Button type="button" variant="ghost" color="neutral" size="sm" shape="square" aria-label="Remove" disabled={faq.length === 1} onClick={() => setFaq((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div>
                <Button type="button" variant="outline" color="neutral" size="sm" onClick={() => setFaq((p) => [...p, { q: '', a: '' }])}>
                  <Plus className="h-4 w-4" /> Add question
                </Button>
              </div>
            </div>
          ) : null}
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="JSON-LD" action={<CopyButton value={snippet} label="Copy script" toastLabel="Script copied" color="module" variant="solid" />}>
          <pre className="tool-code">{snippet}</pre>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-tertiary)', margin: 0 }}>
            Paste this into your page&apos;s HTML, then verify it with Google&apos;s Rich Results Test.
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
