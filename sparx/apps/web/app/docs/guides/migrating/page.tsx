import type { Metadata } from 'next';
import {
  DocArticle,
  DocSection,
  DocSubsection,
  Callout,
  DocTable,
  EndpointChip,
  InlineCode,
  DocLink,
} from '@/components/docs/prose';
import { CodeBlock } from '@/components/docs/code-block';
import {
  CANONICAL_ENTITIES,
  ENTITY_FIELDS,
  ENTITY_LABEL,
  ENTITY_MODULE,
} from '@wizeworks/migration';

export const metadata: Metadata = {
  title: 'Importing from another platform',
  description:
    'Move a business onto sparx over the API. Read the vendor catalogue, validate rows, start a migration run, and poll it — plus the canonical row contract and the live-connection endpoints.',
  alternates: { canonical: '/docs/guides/migrating' },
};

// The entity table is GENERATED from the same registry the importer runs on, for
// the same reason the marketing pages are: a hand-written list here would be a
// third copy, and the first thing it would do is drift. Adding an entity to
// `@wizeworks/migration` adds a row to this table.
const ENTITY_ROWS = CANONICAL_ENTITIES.map((entity) => ({
  entity,
  label: ENTITY_LABEL[entity].many,
  module: ENTITY_MODULE[entity],
  required: ENTITY_FIELDS[entity]
    .filter((field) => field.required === true)
    .map((field) => field.key),
  keys: ENTITY_FIELDS[entity]
    .filter((field) => field.naturalKey === true)
    .map((field) => field.key),
}));

const VENDORS_CURL = `curl https://api.sparx.works/v1/migration/vendors \\
  -H "Authorization: Bearer $SPARX_KEY"`;

const VENDORS_RESPONSE = `{
  "success": true,
  "data": {
    "vendors": [
      {
        "slug": "shopify",
        "name": "Shopify",
        "kind": "commerce",
        "hasConnector": true,
        "modules": ["commerce", "inventory", "builder"],
        "entities": [
          { "entity": "products", "label": "Products", "module": "commerce",
            "available": true, "connectorOnly": false },
          { "entity": "collections", "label": "Collections", "module": "commerce",
            "available": true, "connectorOnly": true }
        ],
        "sources": [
          {
            "id": "shopify.products",
            "entity": "products",
            "label": "Products",
            "file": "products_export.csv",
            "where": "Products → Export → All products",
            "format": "csv"
          }
        ],
        "connector": { "slug": "shopify", "fields": [ /* … */ ] }
      }
    ]
  }
}`;

const PREVIEW_CURL = `curl https://api.sparx.works/v1/migration/preview \\
  -H "Authorization: Bearer $SPARX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "entity": "products",
    "rows": [
      { "handle": "merino-beanie", "title": "Merino Beanie", "sku": "BEANIE-S", "price": "24.00" },
      { "handle": "nameless", "sku": "X" }
    ]
  }'`;

const PREVIEW_RESPONSE = `{
  "success": true,
  "data": {
    "report": {
      "entity": "products",
      "rowCount": 2,
      "okCount": 1,
      "errorCount": 1,
      "warningCount": 0,
      "blocked": false,
      "errorRows": [1],
      "issues": [
        {
          "severity": "error",
          "rowIndex": 1,
          "column": "title",
          "code": "required_missing",
          "message": "This product has no title.",
          "hint": "A product cannot be created without one. Fill it in, or remove the row."
        }
      ],
      "unmappedColumns": [],
      "duplicates": []
    }
  }
}`;

const RUN_CURL = `curl https://api.sparx.works/v1/migration/runs \\
  -H "Authorization: Bearer $SPARX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "vendor": "shopify",
    "fileName": "products_export.csv",
    "dryRun": true,
    "upsert": true,
    "entities": [
      {
        "entity": "products",
        "rows": [
          { "handle": "merino-beanie", "title": "Merino Beanie", "sku": "BEANIE-S", "price": "24.00" }
        ]
      },
      {
        "entity": "inventory_levels",
        "rows": [
          { "sku": "BEANIE-S", "location": "Studio", "quantity": "9" }
        ]
      }
    ]
  }'`;

const RUN_RESPONSE = `{
  "success": true,
  "data": {
    "runId": "576083dd-328e-48d0-9adc-bfa81c8c41dc",
    "vendor": "shopify",
    "dryRun": true,
    "jobs": [
      { "id": "ad87dd2c-…", "entityType": "products", "status": "pending", "rowCount": 1 },
      { "id": "b1f2e3d4-…", "entityType": "inventory_levels", "status": "pending", "rowCount": 1 }
    ],
    "skipped": [],
    "reports": { "products": { "okCount": 1, "…": "…" } }
  }
}`;

const POLL_CURL = `curl https://api.sparx.works/v1/migration/runs/$RUN_ID \\
  -H "Authorization: Bearer $SPARX_KEY"`;

const POLL_RESPONSE = `{
  "success": true,
  "data": {
    "run": {
      "runId": "576083dd-…",
      "vendor": "shopify",
      "dryRun": true,
      "status": "completed",
      "entities": [
        { "entity": "products", "rowCount": 1, "imported": 1,
          "updated": 0, "errors": 0, "done": true }
      ]
    },
    "jobs": [ /* one per chunk */ ],
    "problems": [
      {
        "entity": "products",
        "rowIndex": 83,
        "status": "error",
        "naturalKey": "BEANIE-XL",
        "message": "This product has no title."
      }
    ]
  }
}`;

const CONNECT_CURL = `curl https://api.sparx.works/v1/migration/connect \\
  -H "Authorization: Bearer $SPARX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "vendor": "shopify",
    "credentials": {
      "shop": "your-store.myshopify.com",
      "accessToken": "shpat_…"
    }
  }'`;

const PULL_CURL = `curl https://api.sparx.works/v1/migration/pull \\
  -H "Authorization: Bearer $SPARX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "vendor": "shopify",
    "entity": "products",
    "cursor": null,
    "credentials": { "shop": "your-store.myshopify.com", "accessToken": "shpat_…" }
  }'`;

const PULL_RESPONSE = `{
  "success": true,
  "data": {
    "entity": "products",
    "rows": [
      { "handle": "merino-beanie", "title": "Merino Beanie", "sku": "BEANIE-S",
        "price": "24.00", "option1_name": "Size", "option1_value": "Small" }
    ],
    "nextCursor": "eyJsYXN0X2lkIjo0MDcxNzk4NDE5NzR9",
    "fetched": 25
  }
}`;

const LOOP_NODE = `const key = process.env.SPARX_KEY;
const api = (path, body) =>
  fetch(\`https://api.sparx.works/v1/migration/\${path}\`, {
    method: "POST",
    headers: { Authorization: \`Bearer \${key}\`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const credentials = { shop: "your-store.myshopify.com", accessToken: process.env.SHOPIFY_TOKEN };

// 1. Prove the credentials before doing anything long.
const { data: account } = await api("connect", { vendor: "shopify", credentials });
console.log("connected to", account.account.account);

// 2. Page through one entity until the cursor runs out.
const rows = [];
let cursor = null;
do {
  const { data: page } = await api("pull", {
    vendor: "shopify", entity: "products", cursor, credentials,
  });
  rows.push(...page.rows);
  cursor = page.nextCursor;
} while (cursor !== null);

// 3. Practice first. Then run it again with dryRun: false.
const { data: run } = await api("runs", {
  vendor: "shopify", dryRun: true, entities: [{ entity: "products", rows }],
});
console.log(run.runId, run.jobs.length, "jobs");`;

export default function MigrationGuidePage() {
  return (
    <DocArticle
      breadcrumb={[
        { label: 'Docs', href: '/docs' },
        { label: 'Guides' },
        { label: 'Importing from another platform' },
      ]}
      title="Importing from another platform"
      lede="Move a business onto sparx from Shopify, WooCommerce, HubSpot and seventeen others — over the API, in the same four steps the app takes: read what a vendor can give you, check the rows, practice, then run it."
      meta={
        <>
          <span>Updated 2026-08-13</span>
          <span>10 min read</span>
        </>
      }
      toc={[
        { id: 'shape', label: 'How a migration works' },
        { id: 'vendors', label: 'What a vendor can give you' },
        { id: 'rows', label: 'The canonical row' },
        { id: 'preview', label: 'Check the rows' },
        { id: 'runs', label: 'Start a run' },
        { id: 'poll', label: 'Watch it land' },
        { id: 'live', label: 'Live connections' },
        { id: 'entities', label: 'Every entity' },
      ]}
      editPath="sparx/apps/web/app/docs/guides/migrating/page.tsx"
      updated="2026-08-13"
      prev={{ title: 'Webhooks & events', href: '/docs/guides/webhooks' }}
      next={{ title: 'Authentication', href: '/docs/authentication' }}
    >
      <DocSection id="shape" title="How a migration works">
        <p>
          A migration is <strong>rows in, jobs out</strong>. You send arrays of{' '}
          <InlineCode>Record&lt;string, string&gt;</InlineCode> — one shape for all twenty vendors —
          and sparx creates a background <InlineCode>ImportJob</InlineCode> per entity, processes
          them in dependency order, and reports what happened row by row.
        </p>
        <p>
          Nothing about the vendor survives past your request. Reading a{' '}
          <InlineCode>products_export.csv</InlineCode> into canonical rows happens in{' '}
          <InlineCode>@wizeworks/migration</InlineCode>, which runs in a browser, in a worker, or in
          your own script — the API only ever sees rows. That is why one endpoint serves every
          platform and why your own spreadsheet works exactly as well as a competitor&rsquo;s
          export.
        </p>

        <Callout type="note" title="A run is a group of jobs, not a table">
          <p>
            <InlineCode>runId</InlineCode> is an id shared by every job in one migration. There is
            no migration table — which is why a run can be reported on and cancelled, but not
            edited.
          </p>
        </Callout>

        <p>The four calls, in order:</p>
        <DocTable>
          <thead>
            <tr>
              <th className="w-[46%]">Endpoint</th>
              <th>What it is for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <EndpointChip method="GET" path="/v1/migration/vendors" />
              </td>
              <td>What each platform can give you, and which parts this tenant can receive.</td>
            </tr>
            <tr>
              <td>
                <EndpointChip method="POST" path="/v1/migration/preview" />
              </td>
              <td>Check rows without writing anything. Pure and synchronous.</td>
            </tr>
            <tr>
              <td>
                <EndpointChip method="POST" path="/v1/migration/runs" />
              </td>
              <td>Start the run. Returns 202 with a run id.</td>
            </tr>
            <tr>
              <td>
                <EndpointChip method="GET" path="/v1/migration/runs/{runId}" />
              </td>
              <td>Per-entity progress plus the rows that need a person.</td>
            </tr>
          </tbody>
        </DocTable>
        <p>
          Two more exist for live connections —{' '}
          <DocLink href="#live">
            <InlineCode>connect</InlineCode> and <InlineCode>pull</InlineCode>
          </DocLink>{' '}
          — and <EndpointChip method="POST" path="/v1/migration/runs/{runId}/cancel" /> stops
          anything that has not started.
        </p>
      </DocSection>

      <DocSection id="vendors" title="What a vendor can give you">
        <p>
          The catalogue is computed from the adapters, so it can never advertise something the
          importer does not do. Each entity is marked <InlineCode>available</InlineCode> against{' '}
          <em>this</em> tenant&rsquo;s modules — a locked entity is reported with the module that
          would unlock it rather than hidden.
        </p>
        <CodeBlock caption="Request" tabs={[{ label: 'cURL', code: VENDORS_CURL }]} />
        <CodeBlock
          caption="Response"
          variant="resp"
          status="200"
          tabs={[{ label: '200', code: VENDORS_RESPONSE }]}
        />
        <p>
          <InlineCode>sources</InlineCode> names the vendor&rsquo;s own file and the menu it is
          under, verbatim — use it in your own UI rather than writing your own copy of it.{' '}
          <InlineCode>connectorOnly</InlineCode> marks entities that platform has no export for at
          all; those only arrive through a <DocLink href="#live">live connection</DocLink>.
        </p>
      </DocSection>

      <DocSection id="rows" title="The canonical row">
        <p>
          Every entity is a flat <InlineCode>Record&lt;string, string&gt;</InlineCode>. Strings
          throughout — numbers, booleans and dates are coerced on the way in, so{' '}
          <InlineCode>&quot;24.00&quot;</InlineCode>, <InlineCode>&quot;1,200&quot;</InlineCode> and{' '}
          <InlineCode>&quot;true&quot;</InlineCode> are all fine.
        </p>
        <p>Two rules decide whether a row lands:</p>
        <ul>
          <li>
            <strong>Required fields</strong> must be present and non-empty, or the row is skipped.
          </li>
          <li>
            <strong>At least one natural key</strong> must carry a value. The natural key is also
            what makes an import idempotent: send the same file twice and matching records are
            updated, not duplicated.
          </li>
        </ul>
        <Callout type="warn" title="Omit a key rather than sending an empty one">
          <p>
            <InlineCode>{'{ "price": "" }'}</InlineCode> and <InlineCode>{'{}'}</InlineCode> mean
            different things to an upsert: the first says &ldquo;set the price to nothing&rdquo;,
            the second says &ldquo;leave it alone&rdquo;. Drop keys you have no value for.
          </p>
        </Callout>
        <p>
          A product spread across several rows — one per variant, which is how every commerce
          platform exports — is grouped by <InlineCode>handle</InlineCode>. Send the option matrix
          on each row (<InlineCode>option1_name</InlineCode> /{' '}
          <InlineCode>option1_value</InlineCode>) and the product&rsquo;s own fields on the first.
        </p>
      </DocSection>

      <DocSection id="preview" title="Check the rows">
        <p>
          <EndpointChip method="POST" path="/v1/migration/preview" /> validates and writes nothing.
          It is the same function the app runs in the browser before a byte is uploaded, so a
          preview and an import can never disagree about what is wrong.
        </p>
        <CodeBlock caption="Request" tabs={[{ label: 'cURL', code: PREVIEW_CURL }]} />
        <CodeBlock
          caption="Response"
          variant="resp"
          status="200"
          tabs={[{ label: '200', code: PREVIEW_RESPONSE }]}
        />
        <p>
          <InlineCode>errorRows</InlineCode> is uncapped and is the list to act on;{' '}
          <InlineCode>issues</InlineCode> is capped at 500 for display.{' '}
          <InlineCode>blocked</InlineCode> means a required column is missing from every row, so the
          whole set is unusable rather than some of it.
        </p>
        <Callout type="note" title="severity has a precise meaning">
          <p>
            <InlineCode>error</InlineCode> — this row cannot be written and will be skipped.{' '}
            <InlineCode>warning</InlineCode> — the row will be written, but something was changed or
            dropped to make that possible.
          </p>
        </Callout>
      </DocSection>

      <DocSection id="runs" title="Start a run">
        <p>
          <EndpointChip method="POST" path="/v1/migration/runs" /> accepts up to 20 entities and
          200,000 rows, chunks them into jobs of 5,000, and returns <InlineCode>202</InlineCode>{' '}
          immediately. Requires the <strong>editor</strong> role.
        </p>
        <CodeBlock caption="Request" tabs={[{ label: 'cURL', code: RUN_CURL }]} />
        <CodeBlock
          caption="Response"
          variant="resp"
          status="202"
          tabs={[{ label: '202', code: RUN_RESPONSE }]}
        />
        <p>
          <strong>Send everything in one call.</strong> Entities are reordered into dependency order
          — categories before products, products before stock, customers before orders — so stock
          resolves a SKU that products created. Splitting them across calls hands you that ordering
          problem instead.
        </p>
        <p>
          Rows that fail validation are dropped here rather than becoming error rows later, so the
          count you are given is the count that happens. Entities whose module is off are reported
          in <InlineCode>skipped</InlineCode> and the rest of the run proceeds — a WordPress export
          carrying products for a tenant who only wants the blog imports the blog.
        </p>
        <Callout type="warn" title="Practice first">
          <p>
            <InlineCode>dryRun: true</InlineCode> resolves every row against real data and reports
            what would happen without writing anything. It is a separate read-only path, not a
            transaction that gets rolled back.
          </p>
        </Callout>
      </DocSection>

      <DocSection id="poll" title="Watch it land">
        <p>
          Jobs are processed by a worker, so the run is not finished when the call returns. Poll{' '}
          <EndpointChip method="GET" path="/v1/migration/runs/{runId}" /> until{' '}
          <InlineCode>status</InlineCode> leaves <InlineCode>running</InlineCode>, or subscribe to{' '}
          <DocLink href="/docs/guides/webhooks">webhooks</DocLink> and skip the polling.
        </p>
        <CodeBlock caption="Request" tabs={[{ label: 'cURL', code: POLL_CURL }]} />
        <CodeBlock
          caption="Response"
          variant="resp"
          status="200"
          tabs={[{ label: '200', code: POLL_RESPONSE }]}
        />
        <p>
          <InlineCode>problems</InlineCode> is the list worth surfacing to a person: rows that were
          skipped, and rows that landed but did something worth knowing (an image that had to be
          linked rather than copied, a location that had to be created).{' '}
          <InlineCode>rowIndex</InlineCode> is zero-based against the rows you sent for that entity.
        </p>
      </DocSection>

      <DocSection id="live" title="Live connections">
        <p>
          Three platforms — Shopify, WordPress/WooCommerce and HubSpot — can be read directly
          instead of exported. A connector <em>fetches</em>; it does not import. It returns the same
          canonical rows a file produces, and you hand them to <InlineCode>/runs</InlineCode>{' '}
          exactly as you would rows you parsed yourself.
        </p>

        <Callout type="danger" title="Credentials are yours, and are never stored">
          <p>
            sparx holds no platform-level Shopify or HubSpot credential and never will. The tenant
            supplies their own read-only key, it is sent with each call, used, and forgotten —
            nothing is written to the database. Ask for read scopes only.
          </p>
        </Callout>

        <DocSubsection id="live-connect" title="Prove the credentials">
          <p>
            <EndpointChip method="POST" path="/v1/migration/connect" /> makes one cheap call to the
            vendor and tells you whose account you reached, plus which resources those credentials
            and this tenant&rsquo;s modules actually allow.
          </p>
          <CodeBlock caption="Request" tabs={[{ label: 'cURL', code: CONNECT_CURL }]} />
        </DocSubsection>

        <DocSubsection id="live-pull" title="Page through the data">
          <p>
            <EndpointChip method="POST" path="/v1/migration/pull" /> returns one page and an opaque{' '}
            <InlineCode>nextCursor</InlineCode>. Hand the cursor back to continue; a{' '}
            <InlineCode>null</InlineCode> cursor means you have it all.
          </p>
          <CodeBlock caption="Request" tabs={[{ label: 'cURL', code: PULL_CURL }]} />
          <CodeBlock
            caption="Response"
            variant="resp"
            status="200"
            tabs={[{ label: '200', code: PULL_RESPONSE }]}
          />
          <p>
            <InlineCode>fetched</InlineCode> counts the vendor&rsquo;s own records;{' '}
            <InlineCode>rows.length</InlineCode> counts canonical rows. One product with eight
            variants is one record and nine rows, so the two differ on purpose.
          </p>
        </DocSubsection>

        <DocSubsection id="live-loop" title="The whole loop">
          <p>Pull one entity to exhaustion, then practice, then run it for real.</p>
          <CodeBlock caption="Node" tabs={[{ label: 'Node', code: LOOP_NODE }]} />
          <p>
            Pull entities one at a time rather than in parallel. All three platforms rate limit per
            account, and four concurrent pulls against one store means four pulls all backing off —
            slower than doing them in order, and far more likely to fail.
          </p>
        </DocSubsection>
      </DocSection>

      <DocSection id="entities" title="Every entity">
        <p>
          Seventeen entities. <strong>Required</strong> fields must be present on every row;{' '}
          <strong>natural key</strong> is what a re-import matches on, and a row needs at least one
          of them. A module that is off means the entity is reported as skipped, never an error.
        </p>
        <DocTable>
          <thead>
            <tr>
              <th>Entity</th>
              <th>Module</th>
              <th>Required</th>
              <th>Natural key</th>
            </tr>
          </thead>
          <tbody>
            {ENTITY_ROWS.map((row) => (
              <tr key={row.entity}>
                <td>
                  <InlineCode>{row.entity}</InlineCode>
                </td>
                <td>{row.module === null ? '—' : <InlineCode>{row.module}</InlineCode>}</td>
                <td>
                  {row.required.length === 0
                    ? '—'
                    : row.required.map((field) => <InlineCode key={field}>{field}</InlineCode>)}
                </td>
                <td>
                  {row.keys.length === 0
                    ? '—'
                    : row.keys.map((field) => <InlineCode key={field}>{field}</InlineCode>)}
                </td>
              </tr>
            ))}
          </tbody>
        </DocTable>
        <p>
          The full field list per entity — every optional column, its type and its limit — is{' '}
          <InlineCode>ENTITY_FIELDS</InlineCode> in <InlineCode>@wizeworks/migration</InlineCode>,
          which is what this table is generated from and what the validator checks against.
        </p>
        <p>
          For the platform-by-platform view — the exact file, the exact menu, and what does not come
          across — see <DocLink href="/migrate">the switching pages</DocLink>.
        </p>
      </DocSection>
    </DocArticle>
  );
}
