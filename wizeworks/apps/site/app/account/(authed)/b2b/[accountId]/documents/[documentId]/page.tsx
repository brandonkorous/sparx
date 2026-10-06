'use client';

// Wholesale account: one quote or invoice, as the shop prints it, for the buyer
// to print or save as a PDF.
//
// The /b2b page promises "The buyer gets a branded quote PDF". The buyer got an
// email with the figures in it and nothing they could keep, file or forward to
// their accounts department: only the shop could print the document (sparx
// persona issue 085). This shows the SAME branded page the shop previews (its
// published print template, logo and letterhead), and the browser's own print
// dialog turns it into a PDF with "Save as PDF". The quote and invoice emails,
// and the quote and invoice lists, link here.
//
// The page is fetched, not pointed at, so a document that is not on this
// account (or not priced yet) says so in words rather than printing an error
// payload into the frame.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import { getB2bDocumentHtml } from '@/lib/customer-client';
import { Alert, Button } from '@wizeworks/silicaui-react';

export default function B2bDocumentPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ accountId: string; documentId: string }>();
  const { accountId, documentId } = params;
  const frame = useRef<HTMLIFrameElement>(null);
  // undefined while loading; null when it is not theirs to see.
  const [html, setHtml] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    getB2bDocumentHtml(tenantSlug, accountId, documentId)
      .then((page) => {
        if (live) setHtml(page);
      })
      .catch(() => {
        if (live) setHtml(null);
      });
    return () => {
      live = false;
    };
  }, [tenantSlug, accountId, documentId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/account/b2b/${accountId}`} className="link link-primary">
          ← Back to account
        </Link>
        {html ? (
          <Button
            type="button"
            color="primary"
            onClick={() => {
              frame.current?.contentWindow?.print();
            }}
          >
            Print or save as PDF
          </Button>
        ) : null}
      </div>

      {html === undefined ? (
        <div className="skeleton h-[70vh]" />
      ) : html === null ? (
        <Alert color="warning" role="status">
          This document is not on your account, or it is not ready to view yet. Your quotes and
          invoices are listed on your account page.
        </Alert>
      ) : (
        <>
          <p className="text-base-content">
            To keep a copy, press Print or save as PDF and choose Save as PDF as the printer.
          </p>
          <iframe
            ref={frame}
            srcDoc={html}
            title="Your document"
            className="border-base-300 rounded-box h-[80vh] w-full border"
          />
        </>
      )}
    </div>
  );
}
