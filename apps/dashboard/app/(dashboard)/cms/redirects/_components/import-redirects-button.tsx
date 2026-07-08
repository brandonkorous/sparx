'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { toast } from '@sparx/ui';
import { Button } from 'silicaui-react';
import { FileUp } from 'lucide-react';

import { bulkImportRedirects } from '../actions';

// Header island for CSV bulk import. Replaces the old inline `BulkUploadCard`:
// a single outline button that opens a hidden file picker, reads the chosen
// file as text, and hands it to the `bulkImportRedirects` action. Results are
// reported through the global `toast` channel (success = imported + skipped
// counts; hard failure = error). A successful import refreshes the list.

export function ImportRedirectsButton() {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [pending, startTransition] = React.useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      startTransition(async () => {
        const result = await bulkImportRedirects(text);
        if (fileRef.current) fileRef.current.value = '';
        const imported = result.data?.imported ?? 0;
        const skipped = result.data?.failed ?? [];
        if (!result.ok && imported === 0) {
          toast.error(result.error ?? 'Bulk import failed.');
          return;
        }
        const base = `Imported ${imported} redirect${imported === 1 ? '' : 's'}`;
        const message = skipped.length
          ? `${base} (${skipped.length} row${skipped.length === 1 ? '' : 's'} skipped).`
          : `${base}.`;
        toast.success(message);
        router.refresh();
      });
    });
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onChange}
        className="hidden"
        aria-label="Choose CSV"
      />
      <Button
        type="button"
        variant="outline"
        iconStart={<FileUp className="h-4 w-4" />}
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        loading={pending}
      >
        Import CSV
      </Button>
    </>
  );
}
