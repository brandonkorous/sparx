'use server';

import { api } from '@/lib/api-rest-client';

export type ImportActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

async function importAction<T>(handler: () => Promise<T>): Promise<ImportActionResult<T>> {
  try {
    const data = await handler();
    return { ok: true, data };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return {
      ok: false,
      error: { code: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Unexpected error' },
    };
  }
}

export async function submitB2bAccountImportAction(
  rows: Record<string, string>[],
  options: { upsert: boolean; fileName: string }
): Promise<ImportActionResult<{ jobId: string }>> {
  return importAction(async () => {
    const result = await api.post<{ jobId: string }>('/v1/b2b/accounts/import', {
      rows,
      options: { upsert: options.upsert },
      fileName: options.fileName,
    });
    return result;
  });
}

export async function getB2bAccountImportStatusAction(jobId: string): Promise<
  ImportActionResult<{
    status: string;
    importedCount: number;
    updatedCount: number;
    errorCount: number;
    rowCount: number;
    rows: {
      rowIndex: number;
      status: string;
      naturalKey?: string | null;
      errorMsg?: string | null;
    }[];
  }>
> {
  return importAction(async () => api.get(`/v1/b2b/accounts/import/${jobId}`));
}
