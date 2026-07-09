'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { ImportDialog, ExportButton, type ImportJobResult } from '@sparx/ui';
import { Button } from '@wizeworks/silicaui-react';
import { parseXlsxAction } from '@/lib/parse-xlsx-action';
import { submitB2bAccountImportAction, getB2bAccountImportStatusAction } from '../import-actions';

const REQUIRED_COLUMNS = ['company_name'];

const TEMPLATE_CSV = `company_name,tax_id,website,pricing_tier,credit_limit,payment_terms,discount_percent,status,notes,tags\n"Acme Diesel","12-3456789","https://acme.com","wholesale","5000","net30","5","active","Fleet account","fleet,key-account"\n`;

export function B2bAccountsImportExport() {
  const [importOpen, setImportOpen] = React.useState(false);

  async function handleSubmit(
    rows: Record<string, string>[],
    options: { upsert: boolean; fileName: string }
  ) {
    const result = await submitB2bAccountImportAction(rows, options);
    if (!result.ok) throw new Error(result.error.message);
    return { jobId: result.data.jobId };
  }

  async function handlePollStatus(jobId: string): Promise<ImportJobResult> {
    const result = await getB2bAccountImportStatusAction(jobId);
    if (!result.ok) throw new Error(result.error.message);
    const d = result.data;
    return {
      status: d.status as ImportJobResult['status'],
      importedCount: d.importedCount,
      updatedCount: d.updatedCount,
      errorCount: d.errorCount,
      rowCount: d.rowCount,
      rows: d.rows.map((r) => ({
        rowIndex: r.rowIndex,
        status: r.status as ImportJobResult['rows'][number]['status'],
        naturalKey: r.naturalKey,
        errorMsg: r.errorMsg,
      })),
    };
  }

  function handleExport() {
    window.open('/api/export/b2b-accounts', '_blank');
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        iconStart={<Upload className="h-4 w-4" />}
        onClick={() => setImportOpen(true)}
      >
        Import
      </Button>

      <ExportButton onExport={handleExport} />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityType="b2b_accounts"
        entityLabel="B2B accounts"
        requiredColumns={REQUIRED_COLUMNS}
        templateCsvContent={TEMPLATE_CSV}
        templateFileName="b2b-accounts-template.csv"
        onParseXlsx={parseXlsxAction}
        onSubmit={handleSubmit}
        onPollStatus={handlePollStatus}
      />
    </>
  );
}
