import type { Metadata } from 'next';
import { ApiReference, ApiSection, ApiParam, ApiError } from '@/components/docs/api-reference';
import { InlineCode } from '@/components/docs/prose';
import { CodeBlock } from '@/components/docs/code-block';

export const metadata: Metadata = {
  title: 'Create an order',
  description:
    'POST /v1/commerce/orders — create a retail or B2B order in the Sparx commerce module. Parameters, response shape, and error codes.',
  alternates: { canonical: '/docs/api/orders/create' },
};

const REQUEST_TABS = [
  {
    label: 'cURL',
    code: `curl https://api.sparx.works/v1/commerce/orders \\
  -H "Authorization: Bearer $SPARX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerId": "cus_8R4Xz1QkM",
    "terms": { "type": "net", "days": 30 },
    "poNumber": "PO-8841",
    "lines": [{ "sku": "INJ-6.7-CR", "qty": 8 }]
  }'`,
  },
  {
    label: 'Node',
    code: `const order = await client.commerce.orders.create({
  customerId: "cus_8R4Xz1QkM",
  terms: { type: "net", days: 30 },
  poNumber: "PO-8841",
  lines: [{ sku: "INJ-6.7-CR", qty: 8 }],
});`,
  },
  {
    label: 'Python',
    code: `order = client.commerce.orders.create(
  customer_id="cus_8R4Xz1QkM",
  terms={"type": "net", "days": 30},
  po_number="PO-8841",
  lines=[{"sku": "INJ-6.7-CR", "qty": 8}],
)`,
  },
];

const RESPONSE_TABS = [
  {
    label: '200',
    code: `{
  "id": "ord_KdQ19wPmFf",
  "object": "order",
  "status": "approved",
  "customerId": "cus_8R4Xz1QkM",
  "total": { "amount": 189600, "currency": "USD" },
  "terms": { "type": "net", "days": 30 },
  "poNumber": "PO-8841",
  "lines": [
    { "sku": "INJ-6.7-CR", "qty": 8 }
  ],
  "createdAt": "2026-06-05T17:41:09Z"
}`,
  },
  {
    label: '402',
    code: `{
  "error": {
    "code": "payment_required",
    "message": "Customer over credit limit",
    "creditLimit": { "amount": 500000, "currency": "USD" },
    "outstanding": { "amount": 472300, "currency": "USD" }
  }
}`,
  },
];

export default function CreateOrderPage() {
  return (
    <ApiReference
      breadcrumb={[{ label: 'API reference' }, { label: 'Commerce' }, { label: 'Orders' }]}
      title="Create an order"
      method="POST"
      url="https://api.sparx.works/v1/commerce/orders"
      description={
        <>
          Creates a new order in the commerce module. Orders may be retail or B2B; B2B orders accept
          payment terms and a PO number, and are routed through approval when the customer’s credit
          policy requires it. The created order is returned, and an{' '}
          <InlineCode>order.created</InlineCode> event is emitted on Pub/Sub.
        </>
      }
      left={
        <>
          <ApiSection title="Body parameters" />
          <ApiParam name="customerId" type="string" required>
            The <code>id</code> of the customer placing the order, from the CRM module. Must belong
            to the same tenant as the API key.
          </ApiParam>
          <ApiParam
            name="lines"
            type="array of objects"
            required
            nested={
              <>
                <ApiParam name="sku" type="string" required>
                  The variant SKU. Resolved within the tenant’s catalog.
                </ApiParam>
                <ApiParam name="qty" type="integer" required>
                  Quantity to order. Must be ≥ 1.
                </ApiParam>
                <ApiParam name="priceOverride" type="Money">
                  Override the catalog price for this line. Requires the{' '}
                  <code>orders:price_override</code> scope.
                </ApiParam>
              </>
            }
          >
            The line items to order. At least one is required. Each line references a variant by{' '}
            <code>sku</code> and a quantity.
          </ApiParam>
          <ApiParam name="terms" type="object">
            Payment terms for B2B orders, e.g. <code>{'{ "type": "net", "days": 30 }'}</code>. Omit
            for retail orders paid at checkout.
          </ApiParam>
          <ApiParam name="poNumber" type="string">
            The customer’s purchase-order reference. Shown on the invoice.
          </ApiParam>
          <ApiParam name="metadata" type="object">
            Up to 50 key/value pairs you can attach for your own bookkeeping. Returned verbatim;
            never used by Sparx.
          </ApiParam>

          <ApiSection title="Returns" />
          <p className="docs-param-desc" style={{ padding: '14px 0' }}>
            Returns an <code style={{ fontFamily: 'var(--font-mono)' }}>Order</code> object on
            success. The order’s status is{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>approved</code> for retail and
            auto-approved B2B, or{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>pending_review</code> when credit
            policy requires approval. Returns an error object if the customer or a SKU can’t be
            resolved.
          </p>

          <ApiSection title="Errors" />
          <ApiError label="402 · payment_required">
            The B2B customer has exceeded their credit limit. The order is not created.
          </ApiError>
          <ApiError label="404 · sku_not_found">
            One or more <code>lines[].sku</code> values don’t exist in the catalog.
          </ApiError>
          <ApiError label="403 · module_disabled">
            The tenant hasn’t activated the commerce module.
          </ApiError>
        </>
      }
      right={
        <>
          <CodeBlock caption="Request" tabs={REQUEST_TABS} />
          <CodeBlock caption="Response" variant="resp" status="41 ms" tabs={RESPONSE_TABS} />
        </>
      }
    />
  );
}
