// Staff paper — the contract, the handbook, the ID, the scan of the licence.
//
// Same storage as a finance receipt: a row pointing at a `MediaAsset`, because
// the media library is the one place files live on this platform. This is a
// RECORD that a document exists and was signed, not a signing workflow — that
// is the document-workflow module and a different product.

import { withTenant, type TxClient } from '@sparx/db';
import { StaffDocumentNotFoundError, StaffMemberNotFoundError } from './errors.js';

export type StaffDocumentKind = 'contract' | 'handbook' | 'id' | 'certification' | 'other';

export interface StaffDocumentInput {
  staffMemberId: string;
  assetId: string;
  title: string;
  kind?: StaffDocumentKind;
  signedAt?: Date | null;
  expiresOn?: Date | null;
}

export async function listDocuments(tenantId: string, staffMemberId?: string) {
  return withTenant({ tenantId }, (tx) =>
    tx.staffDocument.findMany({
      where: staffMemberId ? { staffMemberId } : {},
      include: { asset: true },
      orderBy: [{ createdAt: 'desc' }],
    })
  );
}

export async function addDocument(tenantId: string, input: StaffDocumentInput, tx?: TxClient) {
  const run = async (client: TxClient) => {
    const member = await client.staffMember.findFirst({ where: { id: input.staffMemberId } });
    if (!member) throw new StaffMemberNotFoundError(input.staffMemberId);
    return client.staffDocument.create({
      data: {
        tenantId,
        staffMemberId: input.staffMemberId,
        assetId: input.assetId,
        title: input.title,
        kind: input.kind ?? 'other',
        signedAt: input.signedAt ?? null,
        expiresOn: input.expiresOn ?? null,
      },
      include: { asset: true },
    });
  };
  return tx ? run(tx) : withTenant({ tenantId }, run);
}

export async function updateDocument(
  tenantId: string,
  id: string,
  input: Partial<Omit<StaffDocumentInput, 'staffMemberId' | 'assetId'>>
) {
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.staffDocument.findFirst({ where: { id } });
    if (!existing) throw new StaffDocumentNotFoundError(id);
    return tx.staffDocument.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.signedAt !== undefined ? { signedAt: input.signedAt } : {}),
        ...(input.expiresOn !== undefined ? { expiresOn: input.expiresOn } : {}),
      },
      include: { asset: true },
    });
  });
}

/**
 * Remove the document row.
 *
 * The `MediaAsset` itself is left alone — it belongs to the media library, may
 * be referenced elsewhere, and deleting someone's signed contract as a side
 * effect of tidying a list is not a decision this function gets to make.
 */
export async function deleteDocument(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, (tx) => tx.staffDocument.delete({ where: { id } }));
}
