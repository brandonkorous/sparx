'use client';

// THEIR FILE — signed contracts, ID scans, anything attached to the person.

import { Text } from '@wizeworks/silicaui-react';
import { faFileText } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { isForbidden, useStaffDocuments } from './data';
import { documentKindLabel, formatMoment } from './format';

export function DocumentsSection({
  staffMemberId,
  canSeePay,
}: {
  staffMemberId: string;
  canSeePay: boolean;
}) {
  const docs = useStaffDocuments(staffMemberId, canSeePay);
  if (!canSeePay || isForbidden(docs.error)) return null;

  const items = docs.data?.items ?? [];
  return (
    <FormSection
      title="Paperwork"
      description="Signed contracts, handbooks and ID — the drawer in the back office."
    >
      {docs.isPending ? (
        <Text className="text-sm">Loading…</Text>
      ) : items.length === 0 ? (
        <Text className="text-sm">
          Nothing filed. Attach a signed contract or handbook from your media library and it will be
          listed here with the date it was signed.
        </Text>
      ) : (
        items.map((doc) => (
          <div
            key={doc.id}
            className="border-base-300 rounded-box flex items-center justify-between gap-3 border p-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Icon glyph={faFileText} className="size-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                <div className="truncate font-medium">{doc.title}</div>
                <Text className="text-sm">
                  {documentKindLabel(doc.kind)}
                  {doc.signedAt ? ` · signed ${formatMoment(doc.signedAt)}` : ' · not signed'}
                </Text>
              </div>
            </div>
          </div>
        ))
      )}
    </FormSection>
  );
}

/* ── Recent hours + commission ─────────────────────────────────────────────── */
