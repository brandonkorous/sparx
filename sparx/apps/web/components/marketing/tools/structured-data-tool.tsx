'use client';

import * as React from 'react';
import { Button, Text } from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel, CopyButton, CodeBlock } from './ui-kit';
import { MAX_LINE_VALUE, useReportToolResult } from './tool-result-context';
import {
  SCHEMA_TYPES,
  SchemaFields,
  type Fields,
  type Qa,
  type SchemaType,
} from './structured-data-fields';

function prune<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(prune).filter((v) => v !== undefined && v !== '') as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const pv = prune(v);
      if (
        pv !== undefined &&
        pv !== '' &&
        !(typeof pv === 'object' && pv !== null && Object.keys(pv).length === 0)
      ) {
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
      .map((x) => ({
        '@type': 'Question',
        name: x.q,
        acceptedAnswer: { '@type': 'Answer', text: x.a },
      })),
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

  // The generated markup is the whole point, so it travels verbatim. It is
  // something this tool COMPUTED, never a file anyone uploaded.
  //
  // A long FAQ can outgrow what one email line may carry. Half a snippet looks
  // valid and is not, so an oversized one is not sent truncated — the email says
  // so plainly and the markup stays on the screen, where the copy button is.
  const fits = snippet.length <= MAX_LINE_VALUE;
  useReportToolResult({
    lines: [
      { label: 'Schema type', value: type },
      ...(fits ? [{ label: 'Markup', value: snippet }] : []),
    ],
    note: fits
      ? 'Paste this into the <head> of the page it describes.'
      : 'Your markup is too long to send by email in one piece. Open the tool again and use Copy, then paste it into the <head> of the page it describes.',
  });

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Schema type">
          <div className="flex flex-wrap items-center gap-2">
            {SCHEMA_TYPES.map((t) => (
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
          <SchemaFields type={type} val={val} set={set} faq={faq} setFaq={setFaq} />
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel
          title="JSON-LD"
          action={
            <CopyButton
              value={snippet}
              label="Copy script"
              toastLabel="Script copied"
              color="module"
              variant="solid"
            />
          }
        >
          <CodeBlock>{snippet}</CodeBlock>
          <Text className="m-0">
            Paste this into your page&apos;s HTML, then verify it with Google&apos;s Rich Results
            Test.
          </Text>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
