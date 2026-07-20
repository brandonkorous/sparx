import type { Metadata } from 'next';
import { ApiReference, ApiSection, ApiParam, ApiError } from '@/components/docs/api-reference';
import { InlineCode } from '@/components/docs/prose';
import { CodeBlock } from '@/components/docs/code-block';

export const metadata: Metadata = {
  title: 'Create an order',
  description:
    'POST /v1/orders — create an order in sparx. Parameters, line items, computed totals, the response shape, and error codes.',
  alternates: { canonical: '/docs/api/orders/create' },
};

const REQUEST_TABS = [
  {
    label: 'cURL',
    code: `curl https://api.sparx.works/v1/orders \\
  -H "Authorization: Bearer $SPARX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerId": "8a1f0b2c-9d3e-4a5b-8c6d-1e2f3a4b5c6d",
    "currency": "USD",
    "channel": "b2b_portal",
    "items": [
      { "sku": "INJ-6.7-CR", "name": "6.7L Common-Rail Injector", "quantity": 8, "unitPrice": 289.50 }
    ]
  }'`,
  },
  {
    label: 'Node',
    code: `const res = await fetch("https://api.sparx.works/v1/orders", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.SPARX_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    customerId: "8a1f0b2c-9d3e-4a5b-8c6d-1e2f3a4b5c6d",
    currency: "USD",
    channel: "b2b_portal",
    items: [
      { sku: "INJ-6.7-CR", name: "6.7L Common-Rail Injector", quantity: 8, unitPrice: 289.5 },
    ],
  }),
});
const { data: order } = await res.json();`,
  },
  {
    label: 'Python',
    code: `order = requests.post(
  "https://api.sparx.works/v1/orders",
  headers={"Authorization": f"Bearer {os.environ['SPARX_KEY']}"},
  json={
    "customerId": "8a1f0b2c-9d3e-4a5b-8c6d-1e2f3a4b5c6d",
    "currency": "USD",
    "channel": "b2b_portal",
    "items": [
      {"sku": "INJ-6.7-CR", "name": "6.7L Common-Rail Injector", "quantity": 8, "unitPrice": 289.50}
    ],
  },
).json()["data"]`,
  },
];

const RESPONSE_TABS = [
  {
    label: '201',
    code: `{
  "success": true,
  "data": {
    "id": "0c7b1a2d-4e5f-4a6b-9c8d-2e1f0a9b8c7d",
    "orderNumber": "1042",
    "status": "placed",
    "paymentStatus": "unpaid",
    "customerId": "8a1f0b2c-9d3e-4a5b-8c6d-1e2f3a4b5c6d",
    "channel": "b2b_portal",
    "currency": "USD",
    "subtotal": 2316.00,
    "shippingTotal": 0,
    "discountTotal": 0,
    "taxTotal": 0,
    "total": 2316.00,
    "items": [
      { "sku": "INJ-6.7-CR", "name": "6.7L Common-Rail Injector", "quantity": 8, "unitPrice": 289.50 }
    ],
    "createdAt": "2026-06-05T17:41:09Z"
  }
}`,
  },
  {
    label: '404',
    code: `{
  "success": false,
  "error": {
    "code": "not_found",
    "message": "Customer 8a1f0b2c-… was not found."
  }
}`,
  },
];

export default function CreateOrderPage() {
  return (
    <ApiReference
      breadcrumb={[{ label: 'API reference' }, { label: 'CRM' }, { label: 'Orders' }]}
      title="Create an order"
      method="POST"
      url="https://api.sparx.works/v1/orders"
      description={
        <>
          Creates an order in the CRM, which owns the order spine. Post a customer and one or more
          line items; the service computes <InlineCode>subtotal</InlineCode> and{' '}
          <InlineCode>total</InlineCode> from the items and writes the order transactionally. An{' '}
          <InlineCode>order.placed</InlineCode> event is emitted after commit. Requires the{' '}
          <InlineCode>crm</InlineCode> module and an <strong>editor</strong> role.
        </>
      }
      left={
        <>
          <ApiSection title="Body parameters" />
          <ApiParam name="customerId" type="string" required>
            The <code>id</code> of the customer placing the order. Must belong to the same tenant as
            the API key.
          </ApiParam>
          <ApiParam
            name="items"
            type="array of objects"
            required
            nested={
              <>
                <ApiParam name="sku" type="string" required>
                  Stock-keeping unit for the line.
                </ApiParam>
                <ApiParam name="name" type="string" required>
                  Display name captured on the order line.
                </ApiParam>
                <ApiParam name="quantity" type="integer">
                  Defaults to <code>1</code>. Must be positive.
                </ApiParam>
                <ApiParam name="unitPrice" type="number">
                  Price per unit in <code>currency</code> units (e.g. <code>289.50</code>). Defaults
                  to <code>0</code>.
                </ApiParam>
                <ApiParam name="productId" type="string">
                  Optional link to a catalog product (UUID).
                </ApiParam>
                <ApiParam name="variantId" type="string">
                  Optional link to a specific variant (UUID).
                </ApiParam>
                <ApiParam name="description" type="string">
                  Optional free-text line description.
                </ApiParam>
              </>
            }
          >
            The line items. At least one is required (max 500). The service sums them into the order
            totals.
          </ApiParam>
          <ApiParam name="currency" type="string">
            ISO 4217 currency code. Defaults to <code>USD</code>.
          </ApiParam>
          <ApiParam name="channel" type="enum">
            Where the order originated: <code>storefront</code>, <code>b2b_portal</code>,{' '}
            <code>admin</code>, <code>import</code>, or <code>mcp</code>.
          </ApiParam>
          <ApiParam name="propertyId" type="string">
            The site (property) the order was placed on. Optional for admin, import, and MCP orders.
          </ApiParam>
          <ApiParam name="shippingTotal" type="number">
            Shipping charge in <code>currency</code> units. Defaults to <code>0</code>.
          </ApiParam>
          <ApiParam name="discountTotal" type="number">
            Order-level discount. Defaults to <code>0</code>.
          </ApiParam>
          <ApiParam name="taxTotal" type="number">
            Header-level tax override. If omitted, the service sums per-line tax amounts.
          </ApiParam>
          <ApiParam name="shippingAddress" type="object">
            Shipping address snapshot (<code>line1</code>, <code>city</code>, … ).
          </ApiParam>
          <ApiParam name="billingAddress" type="object">
            Billing address snapshot.
          </ApiParam>
          <ApiParam name="customerNote" type="string">
            A note from the customer, shown on the order.
          </ApiParam>
          <ApiParam name="internalNote" type="string">
            An internal-only note, not shown to the customer.
          </ApiParam>
          <ApiParam name="orderNumber" type="string">
            Override the human-facing order number. Auto-generated when omitted.
          </ApiParam>
          <ApiParam name="metadata" type="object">
            Arbitrary key/value pairs you can attach. Returned verbatim; never used by sparx.
          </ApiParam>

          <ApiSection title="Returns" />
          <p className="docs-param-desc py-3.5">
            Returns the created <code className="font-mono">Order</code> with its line items. New
            orders open at status <code className="font-mono">placed</code> and payment status{' '}
            <code className="font-mono">unpaid</code>; <code className="font-mono">subtotal</code>{' '}
            and <code className="font-mono">total</code> are computed from the items. Status then
            advances through dedicated endpoints (fulfill, deliver, cancel, refund).
          </p>

          <ApiSection title="Errors" />
          <ApiError label="401 · unauthorized">
            Missing, malformed, revoked, or expired API key.
          </ApiError>
          <ApiError label="403 · module_disabled">
            The tenant hasn&rsquo;t activated the CRM module (or the key lacks the editor role).
          </ApiError>
          <ApiError label="404 · not_found">
            The <code>customerId</code> doesn&rsquo;t resolve to a customer in this tenant.
          </ApiError>
          <ApiError label="422 · validation_error">
            The body failed validation — e.g. an empty <code>items</code> array or a missing{' '}
            <code>sku</code>.
          </ApiError>
        </>
      }
      right={
        <>
          <CodeBlock caption="Request" tabs={REQUEST_TABS} />
          <CodeBlock caption="Response" variant="resp" status="201" tabs={RESPONSE_TABS} />
        </>
      }
    />
  );
}
