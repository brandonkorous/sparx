// The Invoicing MCP tool array (docs/87 §12) — a pure surface: the tool catalog,
// scopes, confirmation gates, and input-schema validation are asserted directly
// (the handlers themselves run the same services the REST integration tests cover).

import { describe, expect, it } from 'vitest';

import { invoicingMcpTools } from '../../src/mcp/invoicing-tools';

const byName = new Map(invoicingMcpTools.map((t) => [t.name, t]));

describe('invoicingMcpTools', () => {
  it('publishes the expected create / price / advance / pay tools', () => {
    expect([...byName.keys()].sort()).toEqual(
      [
        'add_billing_line',
        'advance_billing_document',
        'create_billing_document',
        'get_billing_document',
        'get_billing_documents',
        'get_document_workflows',
        'record_billing_payment',
      ].sort()
    );
  });

  it('carries dedicated read:invoicing / write:invoicing scopes', () => {
    for (const tool of invoicingMcpTools) {
      expect(['read:invoicing', 'write:invoicing']).toContain(tool.scope);
    }
    expect(byName.get('get_billing_documents')!.scope).toBe('read:invoicing');
    expect(byName.get('create_billing_document')!.scope).toBe('write:invoicing');
  });

  it('confirmation-gates the consequential writes (advance / payment), not authoring', () => {
    expect(byName.get('advance_billing_document')!.confirmation).toBe(true);
    expect(byName.get('record_billing_payment')!.confirmation).toBe(true);
    expect(byName.get('create_billing_document')!.confirmation).toBe(false);
    expect(byName.get('add_billing_line')!.confirmation).toBe(false);
    expect(byName.get('get_document_workflows')!.confirmation).toBe(false);
  });

  it('validates tool input schemas', () => {
    // create — workflow is required.
    expect(() =>
      byName.get('create_billing_document')!.input.parse({ customerId: crypto.randomUUID() })
    ).toThrow();
    expect(
      byName.get('create_billing_document')!.input.parse({ workflowId: crypto.randomUUID() })
    ).toMatchObject({ workflowId: expect.any(String) });

    // add_billing_line — documentId + description required.
    const docId = crypto.randomUUID();
    expect(() => byName.get('add_billing_line')!.input.parse({ documentId: docId })).toThrow();
    expect(
      byName.get('add_billing_line')!.input.parse({
        documentId: docId,
        lineTypeKey: 'labor',
        description: 'Diagnostic',
        quantity: 2,
        unitPrice: 95,
      })
    ).toMatchObject({ documentId: docId, description: 'Diagnostic' });

    // advance — both ids required.
    expect(() =>
      byName.get('advance_billing_document')!.input.parse({ documentId: docId })
    ).toThrow();
    expect(
      byName.get('advance_billing_document')!.input.parse({ documentId: docId, stageId: docId })
    ).toMatchObject({ stageId: docId });

    // record_billing_payment — a positive amount is required; kind/method default.
    expect(() =>
      byName.get('record_billing_payment')!.input.parse({ documentId: docId, amount: -5 })
    ).toThrow();
    expect(
      byName.get('record_billing_payment')!.input.parse({ documentId: docId, amount: 50 })
    ).toMatchObject({ documentId: docId, amount: 50, kind: 'payment', method: 'other' });
  });
});
