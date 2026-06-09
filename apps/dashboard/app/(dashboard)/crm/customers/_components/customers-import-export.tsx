'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { ImportDialog, ExportButton, type ImportJobResult, Button } from '@sparx/ui';
import { submitCustomerImportAction, getCustomerImportStatusAction } from '../../customer-actions';

const REQUIRED_COLUMNS = ['email'];

const TEMPLATE_CSV = `email,first_name,last_name,company,phone,type,tags\n"john@example.com","John","Smith","Acme Co","+1 555 123 4567","retail","vip"\n`;

interface CustomersImportExportProps {
  selectedCount?: number;
}

export function CustomersImportExport({ selectedCount = 0 }: CustomersImportExportProps) {
  const [importOpen, setImportOpen] = React.useState(false);

  async function handleSubmit(
    rows: Record<string, string>[],
    options: { upsert: boolean; fileName: string }
  ) {
    const result = await submitCustomerImportAction(rows, options);
    if (!result.ok) throw new Error(result.error.message);
    return { jobId: result.data.jobId };
  }

  async function handlePollStatus(jobId: string): Promise<ImportJobResult> {
    const result = await getCustomerImportStatusAction(jobId);
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

  function handleExport(_mode: 'all' | 'selected') {
    window.open('/api/export/customers', '_blank');
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Upload className="h-4 w-4" />}
        onClick={() => setImportOpen(true)}
      >
        Import
      </Button>

      <ExportButton selectedCount={selectedCount} onExport={handleExport} />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityType="customers"
        entityLabel="Customers"
        requiredColumns={REQUIRED_COLUMNS}
        templateCsvContent={TEMPLATE_CSV}
        templateFileName="customers-template.csv"
        onSubmit={handleSubmit}
        onPollStatus={handlePollStatus}
      />
    </>
  );
}
