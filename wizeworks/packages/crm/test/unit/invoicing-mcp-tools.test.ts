// The Invoicing MCP tool array (docs/87 §12) — a pure surface: the tool catalog,
// scopes, confirmation gates, and input-schema validation are asserted directly
// (the handlers themselves run the same services the REST integration tests cover).

import { describe, expect, it } from 'vitest';

import { invoicingMcpTools } from '../../src/mcp/invoicing-tools';

const byName = new Map(invoicingMcpTools.map((t) => [t.name, t]));

describe('invoicingMcpTools', () => {
  // CONTAINS, not equals. This asserted the full catalog by exact list, so it
  // failed the moment anyone shipped a tool — which is what happened: the
  // billing-template and document-workflow/stage/line-type tools took the
  // surface from 7 to 26 and this test went red on `main` for days, reporting
  // "expected 25 items to deeply equal 6" about a change that was entirely
  // intentional.
  //
  // The contract worth protecting is that the create / price / advance / pay
  // path this file is named for stays published. Growth beyond it is a feature,
  // not a regression, and an exhaustive list only taxes it. The invariants that
  // would catch an ACCIDENTAL tool — scope and confirmation gating — are
  // asserted over every tool in the cases below, which is where that belongs.
  it('publishes the expected create / price / advance / pay tools', () => {
    for (const name of [
      'add_billing_line',
      'advance_billing_document',
      'create_billing_document',
      'get_billing_document',
      'get_billing_documents',
      'get_document_workflows',
      'record_billing_payment',
    ]) {
      expect(byName.has(name), `missing invoicing tool: ${name}`).toBe(true);
    }
  });

  it('publishes no tool outside the invoicing surface', () => {
    // The real guard against an accidentally-exported tool: every name has to
    // belong to one of invoicing's nouns. Catches a foreign tool spliced into
    // the array without going red on every legitimate addition.
    const NOUNS = /(billing|document|invoic)/;
    const strays = [...byName.keys()].filter((n) => !NOUNS.test(n));
    expect(strays, `unexpected tools on the invoicing surface: ${strays.join(', ')}`).toEqual([]);
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
