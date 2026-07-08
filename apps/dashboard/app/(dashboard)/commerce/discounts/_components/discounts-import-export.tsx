'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { ImportDialog, ExportButton, type ImportJobResult } from '@sparx/ui';
import { Button } from 'silicaui-react';
import { parseXlsxAction } from '@/lib/parse-xlsx-action';
import { submitDiscountImportAction, getDiscountImportStatusAction } from '../../discount-actions';

const REQUIRED_COLUMNS = ['name'];

const TEMPLATE_CSV = `code,name,description,type,scope,value_percent,value_cents,status,start_at,end_at,total_usage_limit,per_customer_limit\n"WELCOME10","Welcome 10% off","New customer discount","percent","order","10","","draft","","","500","1"\n`;

export function DiscountsImportExport() {
  const [importOpen, setImportOpen] = React.useState(false);

  async function handleSubmit(
    rows: Record<string, string>[],
    options: { upsert: boolean; fileName: string }
  ) {
    const result = await submitDiscountImportAction(rows, options);
    if (!result.ok) throw new Error(result.error.message);
    return { jobId: result.data.jobId };
  }

  async function handlePollStatus(jobId: string): Promise<ImportJobResult> {
    const result = await getDiscountImportStatusAction(jobId);
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
    window.open('/api/export/discounts', '_blank');
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
        entityType="discounts"
        entityLabel="Discounts"
        requiredColumns={REQUIRED_COLUMNS}
        templateCsvContent={TEMPLATE_CSV}
        templateFileName="discounts-template.csv"
        onParseXlsx={parseXlsxAction}
        onSubmit={handleSubmit}
        onPollStatus={handlePollStatus}
      />
    </>
  );
}
