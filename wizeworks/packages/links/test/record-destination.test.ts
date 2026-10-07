// Where a search hit opens.
//
// MEASURED 2026-10-06 on Gillett: INV-000009 in the search box opened the whole
// wholesale invoices list, not the invoice (sparx persona issue 094). The
// search entry stored `/wholesale/invoices/<id>`; the box read the type alone.

import { describe, expect, it } from 'vitest';
import { recordDestination } from '../src/index';

const INVOICE = '0f7f8a52-3c1d-4b8e-9d0a-5e6f7a8b9c01';
const OTHER = '6b1c2d3e-4f50-4a61-8b72-9c83d4e5f601';

describe('recordDestination', () => {
  it('opens an invoice on account on its own pane', () => {
    expect(
      recordDestination('billing_document', INVOICE, `/wholesale/invoices/${INVOICE}`)
    ).toEqual({ surface: 'b2b.invoice.detail', params: { id: INVOICE } });
  });

  it('opens any other invoice in the invoice editor', () => {
    expect(
      recordDestination('billing_document', INVOICE, `/invoicing/invoices/${INVOICE}`)
    ).toEqual({ surface: 'invoicing.invoice.edit', params: { id: INVOICE } });
  });

  it('never follows a stored address to another record', () => {
    expect(recordDestination('billing_document', INVOICE, `/wholesale/invoices/${OTHER}`)).toEqual({
      surface: 'b2b.invoices.list',
      params: {},
    });
  });

  it('falls back to the home when the stored address is old or missing', () => {
    expect(
      recordDestination('billing_document', INVOICE, `/invoicing/documents/${INVOICE}`)
    ).toEqual({ surface: 'b2b.invoices.list', params: {} });
    expect(recordDestination('billing_document', INVOICE)).toEqual({
      surface: 'b2b.invoices.list',
      params: {},
    });
  });

  it('keeps a record with its own detail route on that route', () => {
    expect(recordDestination('quote', INVOICE, '/crm/tasks')).toEqual({
      surface: 'b2b.quote.detail',
      params: { id: INVOICE },
    });
  });

  it('has no destination for a type with no home', () => {
    expect(recordDestination('no_such_thing', INVOICE, `/wholesale/invoices/${INVOICE}`)).toBe(
      null
    );
  });
});
