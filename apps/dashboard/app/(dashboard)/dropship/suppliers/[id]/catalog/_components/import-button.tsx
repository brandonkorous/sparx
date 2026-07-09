'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@sparx/ui';
import { Button } from '@wizeworks/silicaui-react';
import { DownloadCloud, Check, RefreshCw } from 'lucide-react';
import { importSupplierProduct, resyncSupplierProduct } from '../../../_lib/catalog-actions';

interface Props {
  supplierId: string;
  productId: string;
  isImported: boolean;
}

export function ImportButton({ supplierId, productId, isImported }: Props) {
  const [done, setDone] = useState(isImported);
  const [pending, startImport] = useTransition();
  const [resyncing, startResync] = useTransition();
  const router = useRouter();

  // Already imported: offer a re-sync (refresh availability + pull in images on
  // the existing commerce product) rather than a dead "Imported" label.
  if (done) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-success flex items-center gap-1 text-sm">
          <Check className="h-4 w-4" /> Imported
        </span>
        <Button
          color="neutral"
          variant="ghost"
          size="sm"
          disabled={resyncing}
          iconStart={<RefreshCw className={`h-4 w-4 ${resyncing ? 'animate-spin' : ''}`} />}
          onClick={() =>
            startResync(async () => {
              const { imagesAdded, error } = await resyncSupplierProduct(supplierId, productId);
              if (error) {
                toast.error('Re-sync failed', { description: error });
                return;
              }
              toast.success('Re-synced from supplier', {
                description:
                  imagesAdded && imagesAdded > 0
                    ? `Updated availability and added ${imagesAdded} image${imagesAdded === 1 ? '' : 's'}.`
                    : 'Updated availability from the supplier.',
              });
              router.refresh();
            })
          }
        >
          {resyncing ? 'Re-syncing…' : 'Re-sync'}
        </Button>
      </div>
    );
  }

  return (
    <Button
      color="module"
      variant="soft"
      size="sm"
      disabled={pending}
      iconStart={<DownloadCloud className="h-4 w-4" />}
      onClick={() =>
        startImport(async () => {
          const { error } = await importSupplierProduct(supplierId, productId);
          if (error) {
            toast.error('Import failed', { description: error });
            return;
          }
          setDone(true);
          // Imports land as a draft commerce product (it isn't on the site yet) —
          // tell the merchant the next step so "Imported" never reads as "live".
          toast.success('Imported as a draft product', {
            description: 'Publish it from Commerce → Products to put it on your site.',
          });
          router.refresh();
        })
      }
    >
      {pending ? 'Importing…' : 'Import'}
    </Button>
  );
}
