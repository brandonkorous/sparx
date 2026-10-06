// Search entity types that are read from one table row.

/**
 * Entity types read from the SAME table row, so an event naming one may be
 * about either. A wholesale quote and an invoice are both billing documents,
 * and the billing events say `billing_document` whichever one the row is. Each
 * kind's projector answers only for its own rows, so re-reading the row under
 * both indexes it as what it is and deletes any entry it has as what it is not
 * (sparx persona issue 086: quotes were filed under "Invoices").
 */
export const SAME_ROW: Readonly<Record<string, readonly string[]>> = {
  billing_document: ['billing_document', 'quote'],
  quote: ['billing_document', 'quote'],
};
