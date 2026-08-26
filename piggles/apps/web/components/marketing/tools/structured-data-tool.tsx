'use client';

import { useMemo, useState } from 'react';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { useLocalStorage } from './lib/use-local-storage';
import {
  Aside,
  AreaField,
  CheckField,
  CodeOut,
  Panel,
  SelectField,
  TextField,
  ToolLayout,
} from './ui-kit';
import { MAX_LINE_VALUE, useReportToolResult } from './tool-result-context';

/**
 * The hidden lines that let Google show your opening hours instead of a link.
 *
 * ── THE FORM NEVER SAYS "SCHEMA" ────────────────────────────────────────────
 *
 * The whole point of this page is that somebody can produce valid schema.org
 * markup without learning what schema.org is. So the picker asks "what is this
 * page about?" and offers "a local business", not "LocalBusiness"; the fields say
 *"when you are open", not "openingHoursSpecification".
 *
 * The generated code still contains all of it, because that is what a search
 * engine reads. The jargon belongs in the output, where a machine reads it, and
 * nowhere else.
 */

type Kind = 'business' | 'product' | 'article' | 'faq' | 'event';

const DAYS = [
  ['Monday', 'Mo'],
  ['Tuesday', 'Tu'],
  ['Wednesday', 'We'],
  ['Thursday', 'Th'],
  ['Friday', 'Fr'],
  ['Saturday', 'Sa'],
  ['Sunday', 'Su'],
] as const;

interface Hours {
  open: boolean;
  from: string;
  to: string;
}

/** The picker's own words, reused so the email describes the page the same way
 *  the screen did. The word "schema" appears nowhere here either. */
const KIND_LABELS: Record<Kind, string> = {
  business: 'Your business — address, hours, phone',
  product: 'One thing you sell',
  article: 'Something you wrote',
  event: 'Something happening on a date',
  faq: 'Questions and answers',
};

export function StructuredDataTool() {
  const [kind, setKind] = useState<Kind>('business');

  const [business, setBusiness] = useLocalStorage('piggles.tools.schema.business', {
    name: '',
    description: '',
    url: '',
    phone: '',
    street: '',
    city: '',
    region: '',
    postcode: '',
    country: '',
    priceRange: '',
  });

  const [hours, setHours] = useState<Record<string, Hours>>(() =>
    Object.fromEntries(
      DAYS.map(([day]) => [day, { open: day !== 'Sunday', from: '09:00', to: '17:00' }])
    )
  );

  const [product, setProduct] = useState({
    name: '',
    description: '',
    brand: '',
    price: '',
    currency: 'USD',
    availability: 'InStock',
    sku: '',
  });

  const [article, setArticle] = useState({
    headline: '',
    author: '',
    published: '',
    description: '',
  });
  const [event, setEvent] = useState({ name: '', start: '', end: '', venue: '', address: '' });
  const [faqs, setFaqs] = useState([{ q: '', a: '' }]);

  const json = useMemo(() => {
    const graph = buildGraph(kind, { business, hours, product, article, event, faqs });
    return `<script type="application/ld+json">\n${JSON.stringify(graph, null, 2)}\n</script>`;
  }, [kind, business, hours, product, article, event, faqs]);

  // The code travels whole or not at all. A long list of questions can outgrow
  // one email line, and half a block of code looks perfectly valid while being
  // useless — so an oversized one is described rather than cut in two.
  const subject =
    kind === 'business'
      ? business.name
      : kind === 'product'
        ? product.name
        : kind === 'article'
          ? article.headline
          : kind === 'event'
            ? event.name
            : faqs.filter((f) => f.q.trim()).length > 0
              ? `${faqs.filter((f) => f.q.trim()).length} questions`
              : '';
  const codeFits = json.length <= MAX_LINE_VALUE;

  useReportToolResult(
    subject.trim()
      ? {
          lines: [
            { label: 'What the page is about', value: KIND_LABELS[kind] },
            { label: kind === 'faq' ? 'How many' : 'Which one', value: subject },
            ...(codeFits ? [{ label: 'Code to add', value: json }] : []),
          ],
          note: codeFits
            ? 'This goes inside the <head> of that one page, and only that page — it describes that page specifically. If somebody else looks after your website, forward this to them.'
            : 'Your code is too long to send by email in one piece. Open the tool again and use the copy button, then paste it into the <head> of that page.',
        }
      : null
  );

  return (
    <ToolLayout
      form={
        <>
          <Panel title="What is this page about?">
            <SelectField
              label="This page is…"
              value={kind}
              onChange={(v) => setKind(v)}
              options={[
                { value: 'business', label: 'Your business — address, hours, phone' },
                { value: 'product', label: 'One thing you sell' },
                { value: 'article', label: 'Something you wrote' },
                { value: 'event', label: 'Something happening on a date' },
                { value: 'faq', label: 'Questions and answers' },
              ]}
            />
            <Aside>
              <strong>It has to be true.</strong> Markup describing things that are not on the page
              — a rating for reviews you do not have, a price you do not charge — is the fastest
              route to a manual penalty, and those are much harder to undo than to avoid.
            </Aside>
          </Panel>

          {kind === 'business' ? (
            <>
              <Panel title="Your business">
                <TextField
                  label="Name"
                  value={business.name}
                  onChange={(v) => setBusiness({ ...business, name: v })}
                />
                <AreaField
                  label="What you do, in a sentence"
                  value={business.description}
                  onChange={(v) => setBusiness({ ...business, description: v })}
                  rows={2}
                />
                <TextField
                  label="Website"
                  value={business.url}
                  onChange={(v) => setBusiness({ ...business, url: v })}
                  inputMode="url"
                  spellCheck={false}
                />
                <TextField
                  label="Phone"
                  value={business.phone}
                  onChange={(v) => setBusiness({ ...business, phone: v })}
                  inputMode="tel"
                />
                <TextField
                  label="Price range"
                  hint="The $ to $$$$ shorthand, or leave it empty. Google shows it beside your name."
                  value={business.priceRange}
                  onChange={(v) => setBusiness({ ...business, priceRange: v })}
                />
              </Panel>

              <Panel title="Where you are">
                <TextField
                  label="Street"
                  value={business.street}
                  onChange={(v) => setBusiness({ ...business, street: v })}
                />
                <TextField
                  label="Town or city"
                  value={business.city}
                  onChange={(v) => setBusiness({ ...business, city: v })}
                />
                <TextField
                  label="County, state or region"
                  value={business.region}
                  onChange={(v) => setBusiness({ ...business, region: v })}
                />
                <TextField
                  label="Postcode"
                  value={business.postcode}
                  onChange={(v) => setBusiness({ ...business, postcode: v })}
                />
                <TextField
                  label="Country"
                  value={business.country}
                  onChange={(v) => setBusiness({ ...business, country: v })}
                />
              </Panel>

              <Panel
                title="When you are open"
                description="The part most likely to show up directly in a search result."
              >
                {DAYS.map(([day]) => (
                  <div key={day} className="flex flex-wrap items-center gap-3">
                    <div className="w-32 shrink-0">
                      <CheckField
                        label={day}
                        checked={hours[day]!.open}
                        onChange={(open) => setHours({ ...hours, [day]: { ...hours[day]!, open } })}
                      />
                    </div>
                    {hours[day]!.open ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          aria-label={`${day} opens`}
                          className="input input-module input-md"
                          value={hours[day]!.from}
                          onChange={(e) =>
                            setHours({ ...hours, [day]: { ...hours[day]!, from: e.target.value } })
                          }
                        />
                        <span className="text-base">to</span>
                        <input
                          type="time"
                          aria-label={`${day} closes`}
                          className="input input-module input-md"
                          value={hours[day]!.to}
                          onChange={(e) =>
                            setHours({ ...hours, [day]: { ...hours[day]!, to: e.target.value } })
                          }
                        />
                      </div>
                    ) : (
                      <span className="text-base">Closed</span>
                    )}
                  </div>
                ))}
              </Panel>
            </>
          ) : null}

          {kind === 'product' ? (
            <Panel title="The thing you sell">
              <TextField
                label="Name"
                value={product.name}
                onChange={(v) => setProduct({ ...product, name: v })}
              />
              <AreaField
                label="Description"
                value={product.description}
                onChange={(v) => setProduct({ ...product, description: v })}
                rows={3}
              />
              <TextField
                label="Brand or maker"
                value={product.brand}
                onChange={(v) => setProduct({ ...product, brand: v })}
              />
              <TextField
                label="Price"
                value={product.price}
                onChange={(v) => setProduct({ ...product, price: v })}
                inputMode="decimal"
              />
              <TextField
                label="Currency"
                value={product.currency}
                onChange={(v) => setProduct({ ...product, currency: v.toUpperCase() })}
              />
              <SelectField
                label="Availability"
                value={product.availability}
                onChange={(v) => setProduct({ ...product, availability: v })}
                options={[
                  { value: 'InStock', label: 'In stock' },
                  { value: 'OutOfStock', label: 'Out of stock' },
                  { value: 'PreOrder', label: 'Available to pre-order' },
                  { value: 'BackOrder', label: 'On back order' },
                ]}
              />
              <TextField
                label="Your own code for it (optional)"
                value={product.sku}
                onChange={(v) => setProduct({ ...product, sku: v })}
              />
            </Panel>
          ) : null}

          {kind === 'article' ? (
            <Panel title="What you wrote">
              <TextField
                label="Headline"
                value={article.headline}
                onChange={(v) => setArticle({ ...article, headline: v })}
              />
              <AreaField
                label="What it is about"
                value={article.description}
                onChange={(v) => setArticle({ ...article, description: v })}
                rows={3}
              />
              <TextField
                label="Who wrote it"
                value={article.author}
                onChange={(v) => setArticle({ ...article, author: v })}
              />
              <TextField
                label="Published on"
                type="date"
                value={article.published}
                onChange={(v) => setArticle({ ...article, published: v })}
              />
            </Panel>
          ) : null}

          {kind === 'event' ? (
            <Panel title="What is happening">
              <TextField
                label="Name"
                value={event.name}
                onChange={(v) => setEvent({ ...event, name: v })}
              />
              <TextField
                label="Starts"
                type="datetime-local"
                value={event.start}
                onChange={(v) => setEvent({ ...event, start: v })}
              />
              <TextField
                label="Ends"
                type="datetime-local"
                value={event.end}
                onChange={(v) => setEvent({ ...event, end: v })}
              />
              <TextField
                label="Where"
                value={event.venue}
                onChange={(v) => setEvent({ ...event, venue: v })}
              />
              <TextField
                label="Address"
                value={event.address}
                onChange={(v) => setEvent({ ...event, address: v })}
              />
            </Panel>
          ) : null}

          {kind === 'faq' ? (
            <Panel
              title="Questions and answers"
              description="These can appear in the search result itself, unfolding when somebody taps them."
              actions={
                <button
                  type="button"
                  className="text-base font-semibold underline underline-offset-4"
                  onClick={() => setFaqs([...faqs, { q: '', a: '' }])}
                >
                  Add another
                </button>
              }
            >
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border-base-300 flex flex-col gap-4 border-b pb-5 last:border-0 last:pb-0"
                >
                  <TextField
                    label={`Question ${i + 1}`}
                    value={faq.q}
                    onChange={(v) => setFaqs(faqs.map((f, j) => (i === j ? { ...f, q: v } : f)))}
                  />
                  <AreaField
                    label="Answer"
                    hint="Write it so it stands alone — it may be read in a search result, away from this page."
                    value={faq.a}
                    onChange={(v) => setFaqs(faqs.map((f, j) => (i === j ? { ...f, a: v } : f)))}
                    rows={3}
                  />
                  {faqs.length > 1 ? (
                    <button
                      type="button"
                      className="self-start text-base font-semibold underline underline-offset-4"
                      onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                    >
                      Remove this one
                    </button>
                  ) : null}
                </div>
              ))}
            </Panel>
          ) : null}
        </>
      }
      output={
        <>
          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">Paste this into your page</h3>
              <p className="mt-2 text-base">
                It goes inside the {'<head>'}, or anywhere in the body — search engines read it
                either way. It is invisible to visitors and changes nothing about how the page
                looks.
              </p>
              <div className="mt-4">
                <CodeOut code={json} language="json" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">Then check it</h3>
              <p className="mt-2 text-base">
                Once the page is live, put its address into Google&rsquo;s Rich Results Test. It
                reports what it found and what it would be eligible to show — which is the only way
                to know this worked, since none of it is visible on the page.
              </p>
              <p className="mt-3 text-base">
                Being eligible is not a promise. A search engine decides what to display and often
                shows nothing extra at all. Without the markup it cannot show anything.
              </p>
            </CardBody>
          </Card>
        </>
      }
    />
  );
}

/** Build the graph for the chosen kind. Empty fields are left out entirely
 * rather than emitted as empty strings — a property with no value is worse than
 * an absent one, because a validator reports it as an error. */
function buildGraph(
  kind: Kind,
  data: {
    business: Record<string, string>;
    hours: Record<string, Hours>;
    product: Record<string, string>;
    article: Record<string, string>;
    event: Record<string, string>;
    faqs: { q: string; a: string }[];
  }
): Record<string, unknown> {
  const clean = (obj: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(obj).filter(
        ([, v]) =>
          v !== '' && v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)
      )
    );

  if (kind === 'business') {
    const b = data.business;
    const openingHours = DAYS.filter(([day]) => data.hours[day]!.open).map(([day, code]) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${day}`,
      opens: data.hours[day]!.from,
      closes: data.hours[day]!.to,
      // The two-letter code is not used by schema.org, but keeping the mapping
      // here documents which day each row is for anybody reading the output.
      ...(code ? {} : {}),
    }));

    return clean({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: b.name,
      description: b.description,
      url: b.url,
      telephone: b.phone,
      priceRange: b.priceRange,
      address: clean({
        '@type': 'PostalAddress',
        streetAddress: b.street,
        addressLocality: b.city,
        addressRegion: b.region,
        postalCode: b.postcode,
        addressCountry: b.country,
      }),
      openingHoursSpecification: openingHours,
    });
  }

  if (kind === 'product') {
    const p = data.product;
    return clean({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: p.description,
      sku: p.sku,
      brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
      offers: p.price
        ? clean({
            '@type': 'Offer',
            price: p.price,
            priceCurrency: p.currency,
            availability: `https://schema.org/${p.availability}`,
          })
        : undefined,
    });
  }

  if (kind === 'article') {
    const a = data.article;
    return clean({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.headline,
      description: a.description,
      author: a.author ? { '@type': 'Person', name: a.author } : undefined,
      datePublished: a.published,
    });
  }

  if (kind === 'event') {
    const e = data.event;
    return clean({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: e.name,
      startDate: e.start,
      endDate: e.end,
      location: e.venue
        ? clean({
            '@type': 'Place',
            name: e.venue,
            address: e.address,
          })
        : undefined,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faqs
      .filter((f) => f.q.trim() && f.a.trim())
      .map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
  };
}
