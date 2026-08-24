'use client';

// TICKETS AND LICENCES — what they are qualified to do, and when it runs out.
//
// A lapsed licence is a van that cannot leave the yard, so the expiry is the
// column that matters here and on the roster.

import { useState } from 'react';
import { Badge, Button, Text, useToast } from '@wizeworks/silicaui-react';
import { faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { useConfirm } from '../../lib/confirm';
import { productCopy } from '../../lib/product';
import { staffErrorMessage, useCertifications, useDeleteCertification } from './data';
import { certificationLabel, formatDate } from './format';
import { NewCertificationForm } from './person-certifications-form';

export function CertificationsSection({ staffMemberId }: { staffMemberId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const certs = useCertifications({ staffMemberId });
  const remove = useDeleteCertification();
  const [adding, setAdding] = useState(false);
  const drop = async (id: string, label: string) => {
    const ok = await confirm({
      title: `Remove "${label}"?`,
      description: 'This removes the record of the qualification, and any expiry warning with it.',
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(id, {
      onError: (error) => {
        toast.add({
          title: 'Could not remove that',
          description: staffErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const items = certs.data?.items ?? [];

  return (
    <FormSection
      title="Tickets and licenses"
      description="What has to be current before this person can do the work."
      action={
        adding ? null : (
          <Button
            size="sm"
            variant="outline"
            color="module"
            onClick={() => {
              setAdding(true);
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add
          </Button>
        )
      }
    >
      {adding ? (
        <NewCertificationForm
          staffMemberId={staffMemberId}
          onCancel={() => {
            setAdding(false);
          }}
        />
      ) : null}

      {items.length === 0 && !adding ? (
        <Text className="text-sm">
          {productCopy(
            'staff.certs.empty',
            'Nothing recorded. If this person needs a license, ticket or certificate to do their job, add it here and Piggles will warn you before it runs out.'
          )}
        </Text>
      ) : null}

      {items.map((cert) => {
        const state = certificationLabel(cert.state, cert.daysUntilExpiry);
        return (
          <div
            key={cert.id}
            className="border-base-300 rounded-box flex items-center justify-between gap-3 border p-3"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{cert.name}</div>
              <Text className="text-sm">
                {cert.issuer ? `${cert.issuer} · ` : ''}
                {cert.expiresOn ? `Expires ${formatDate(cert.expiresOn)}` : 'No expiry date'}
              </Text>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge
                color={state.tone}
                variant={state.tone === 'error' ? 'solid' : 'soft'}
                size="sm"
              >
                {state.label}
              </Badge>
              <Button
                size="xs"
                variant="ghost"
                color="danger"
                aria-label={`Remove ${cert.name}`}
                onClick={() => {
                  void drop(cert.id, cert.name);
                }}
              >
                <Icon glyph={faTrashCan} className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        );
      })}
    </FormSection>
  );
}
