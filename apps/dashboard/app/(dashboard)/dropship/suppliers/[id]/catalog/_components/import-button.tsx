'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@sparx/ui';
import { DownloadCloud, Check } from 'lucide-react';
import { importSupplierProduct } from '../../../_lib/catalog-actions';

interface Props {
    supplierId: string;
    productId: string;
    isImported: boolean;
}

export function ImportButton({ supplierId, productId, isImported }: Props) {
    const [done, setDone] = useState(isImported);
    const [pending, startImport] = useTransition();
    const router = useRouter();

    if (done) {
        return (
            <span className="flex items-center gap-1 text-sm text-[var(--color-success)]">
                <Check className="h-4 w-4" /> Imported
            </span>
        );
    }

    return (
        <Button
            color="primary"
            variant="soft"
            size="sm"
            disabled={pending}
            onClick={() =>
                startImport(async () => {
                    await importSupplierProduct(supplierId, productId);
                    setDone(true);
                    router.refresh();
                })
            }
        >
            <DownloadCloud className="mr-1 h-4 w-4" />
            {pending ? 'Importing…' : 'Import'}
        </Button>
    );
}
