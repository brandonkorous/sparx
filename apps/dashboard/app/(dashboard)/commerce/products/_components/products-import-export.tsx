'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { ImportDialog, ExportButton, type ImportJobResult } from '@sparx/ui';
import { Button } from '@sparx/ui';
import {
  submitProductImportAction,
  getProductImportStatusAction,
} from '../../product-actions';

// Client island: Import + Export buttons for the Products list page.
// This component owns the ImportDialog open state so the parent page
// stays a server component.

const REQUIRED_COLUMNS = ['title', 'sku'];

const TEMPLATE_CSV = `title,sku,vendor,product_type,status,price,compare_at_price,cost_per_item,fulfillment_type,tags,weight_kg,track_inventory,quantity\n"Example Product","EXAMPLE-001","Acme Co","Widget","draft","19.99","","","physical","tag1,tag2","0.5","true","10"\n`;

interface ProductsImportExportProps {
  selectedCount?: number;
}

export function ProductsImportExport({ selectedCount = 0 }: ProductsImportExportProps) {
  const [importOpen, setImportOpen] = React.useState(false);

  async function handleSubmit(
    rows: Record<string, string>[],
    options: { upsert: boolean; fileName: string }
  ) {
    const result = await submitProductImportAction(rows, options);
    if (!result.ok) throw new Error(result.error.message);
    return { jobId: result.data.jobId };
  }

  async function handlePollStatus(jobId: string): Promise<ImportJobResult> {
    const result = await getProductImportStatusAction(jobId);
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

  function handleExport(mode: 'all' | 'selected') {
    const params = new URLSearchParams();
    if (mode === 'selected' && selectedCount > 0) {
      // For selected export, this would carry selected IDs — for now export all (filtered)
      // A future slice will pass IDs via props.
    }
    const url = `/api/export/products?${params.toString()}`;
    window.open(url, '_blank');
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
        entityType="products"
        entityLabel="Products"
        requiredColumns={REQUIRED_COLUMNS}
        templateCsvContent={TEMPLATE_CSV}
        templateFileName="products-template.csv"
        onSubmit={handleSubmit}
        onPollStatus={handlePollStatus}
      />
    </>
  );
}
