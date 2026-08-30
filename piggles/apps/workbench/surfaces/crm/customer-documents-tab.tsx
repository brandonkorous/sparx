'use client';

// The customer's DOCUMENTS — files attached to this person: a signed contract,
// an ID scan, a spec sheet. The bytes go through the same media pipeline as
// every other upload; a CustomerDocument row is the link + a label.
//
// Upload is real work that commits to the server, so its controls live on the
// section itself (an Upload button + per-row Delete), not the pane toolbar —
// each document is its own record with its own immediate write, the same shape
// as the addresses section. PDFs and images are accepted (what the media
// pipeline allows); office files are not, yet.

import { useMemo, useRef } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Button, Card, EmptyState, Text, useToast } from '@wizeworks/silicaui-react';
import { faDownload, faFileText, faTrashCan, faUpload } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import { customerErrorMessage, type CustomerDocument } from './customers-data';
import {
  useAddDocument,
  useCustomerDocuments,
  useDeleteDocument,
} from './customer-attachments-data';
import { useMediaAssets, useUploadMedia, type MediaAsset } from '../commerce/products-data';

const ACCEPT = 'application/pdf,image/*';

function uploadedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The best name to show for a document — the file's own name, else the label,
 *  else a plain fallback so a row is never blank. */
function documentName(doc: CustomerDocument, asset: MediaAsset | undefined): string {
  if (asset?.filename) return asset.filename;
  if (doc.label) return doc.label;
  return 'File';
}

function DocumentRow({
  doc,
  asset,
  onDelete,
  deleting,
}: {
  doc: CustomerDocument;
  asset: MediaAsset | undefined;
  onDelete: () => void;
  deleting: boolean;
}) {
  const name = documentName(doc, asset);
  const processing = asset ? asset.status !== 'ready' || !asset.url : true;

  return (
    <div className="flex items-center gap-3 py-2">
      <Icon glyph={faFileText} className="text-module size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{name}</span>
        <span className="text-sm">
          {doc.label && doc.label !== name ? `${doc.label} · ` : ''}
          Added {uploadedDate(doc.createdAt)}
        </span>
      </div>
      {processing || !asset?.url ? (
        <Text as="span" className="shrink-0 text-sm">
          Preparing…
        </Text>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          color="module"
          aria-label={`Open ${name}`}
          onClick={() => {
            window.open(asset.url ?? '', '_blank', 'noopener,noreferrer');
          }}
        >
          <Icon glyph={faDownload} className="size-4" aria-hidden />
          Open
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        color="danger"
        loading={deleting}
        onClick={onDelete}
        aria-label={`Remove ${name}`}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function CustomerDocumentsTab({ customerId }: { customerId: string }) {
  const { data: docs, isPending, isError } = useCustomerDocuments(customerId);
  const upload = useUploadMedia();
  const add = useAddDocument(customerId);
  const remove = useDeleteDocument(customerId);
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const rows = docs ?? [];
  const assetIds = useMemo(() => (docs ?? []).map((doc) => doc.mediaAssetId), [docs]);
  const assetsQuery = useMediaAssets(assetIds);
  const assetById = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const asset of assetsQuery.data ?? []) map.set(asset.id, asset);
    return map;
  }, [assetsQuery.data]);

  const busy = upload.isPending || add.isPending;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    // Upload the bytes through the media pipeline, then record the link.
    upload.mutate(file, {
      onSuccess: (mediaAssetId) => {
        add.mutate(
          { mediaAssetId, label: file.name },
          {
            onSuccess: () => {
              toast.add({ title: `${file.name} added`, type: 'success' });
            },
            onError: (error) => {
              toast.add({
                title: 'Could not attach that file',
                description: customerErrorMessage(
                  error,
                  'The upload finished but linking it failed.'
                ),
                type: 'error',
              });
            },
          }
        );
      },
      onError: () => {
        toast.add({
          title: 'Could not upload that file',
          description: 'Nothing was added. PDFs and images are accepted — try one of those.',
          type: 'error',
        });
      },
    });
  };

  const onDelete = async (doc: CustomerDocument) => {
    const asset = assetById.get(doc.mediaAssetId);
    const name = documentName(doc, asset);
    const ok = await confirm({
      title: `Remove ${name}?`,
      description: 'It comes off this customer. The file itself is left in your media library.',
      confirmLabel: 'Remove document',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(doc.id);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Button
          size="sm"
          variant="outline"
          color="module"
          loading={busy}
          onClick={() => {
            fileRef.current?.click();
          }}
        >
          <Icon glyph={faUpload} className="size-4" aria-hidden />
          Upload a file
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isError ? (
          <EmptyState
            icon={<Icon glyph={faFileText} className="size-6" aria-hidden />}
            title="Could not load documents"
            description="Something went wrong reaching the server. It may be a temporary problem — try again in a moment."
          />
        ) : isPending ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon glyph={faFileText} className="size-6" aria-hidden />}
            title="No documents yet"
            description="Attach a signed contract, an ID scan, or any PDF or image with “Upload a file” above. Only your team can see them."
          />
        ) : (
          <div className="divide-base-300 flex flex-col divide-y px-4">
            {rows.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                asset={assetById.get(doc.mediaAssetId)}
                deleting={remove.isPending && remove.variables === doc.id}
                onDelete={() => {
                  void onDelete(doc);
                }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
