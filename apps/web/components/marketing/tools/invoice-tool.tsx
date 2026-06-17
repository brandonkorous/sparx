'use client';

import { DocumentTool } from './document-tool';

export function InvoiceTool() {
  return (
    <DocumentTool
      config={{
        storageKey: 'sparx-invoice',
        docTitle: 'INVOICE',
        pdfDateLabel: 'Due',
        dateFieldLabel: 'Due date',
        numberLabel: 'Invoice number',
        defaultNumber: 'INV-0001',
        defaultNotes: 'Thank you for your business.',
        filenameBase: 'invoice',
      }}
    />
  );
}
