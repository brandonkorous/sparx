'use client';

import { DocumentTool } from './document-tool';

export function QuoteTool() {
  return (
    <DocumentTool
      config={{
        storageKey: 'sparx-quote',
        docTitle: 'QUOTE',
        pdfDateLabel: 'Valid until',
        dateFieldLabel: 'Valid until',
        numberLabel: 'Quote number',
        defaultNumber: 'Q-0001',
        defaultNotes: 'This quote is valid until the date above. Prices in the listed currency.',
        filenameBase: 'quote',
      }}
    />
  );
}
