'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';
import type { OperatorPartnerApplication } from '@sparx/operator';
import { formatDate } from '@/lib/format';
import { applicationStatusTone, partnerKindLabel, tierLabel } from '@/lib/partners';
import { approveApplicationAction, rejectApplicationAction } from '../actions';

// WizeWorks' partner-application review queue. Pending rows get Approve (grants
// the REQUESTED tier — adjust later from the partner's detail) and Reject, each
// confirmed. Approval provisions the applicant's partner row, so it needs an
// applicant with a Sparx account (the server enforces this; we disable + explain
// when there's no linked org).
export function ApplicationsTable({
  applications,
  canAct,
}: {
  applications: OperatorPartnerApplication[];
  canAct: boolean;
}) {
  const confirm = useConfirm();
  const [pending, setPending] = React.useState<Record<string, boolean>>({});
  const [, startTransition] = React.useTransition();

  function act(
    id: string,
    kind: 'approve' | 'reject',
    name: string,
    tier: string,
    run: () => Promise<{ ok: boolean; error?: string }>
  ) {
    return async () => {
      const ok = await confirm({
        title: kind === 'approve' ? `Approve ${name}?` : `Reject ${name}?`,
        description:
          kind === 'approve'
            ? `Activates their partner account at the ${tierLabel(tier)} tier and mints a referral code. They can host bootcamps and earn referral commissions.`
            : `Declines this application. They can re-apply later. No account is created.`,
        confirmLabel: kind === 'approve' ? 'Approve partner' : 'Reject',
        tone: kind === 'approve' ? 'module' : 'warning',
      });
      if (!ok) return;
      setPending((p) => ({ ...p, [id]: true }));
      startTransition(async () => {
        const res = await run();
        if (res.ok) toast.success(kind === 'approve' ? `${name} approved` : `${name} rejected`);
        else toast.error(res.error ?? 'Action failed.');
        setPending((p) => ({ ...p, [id]: false }));
      });
    };
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Applicant</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Requested tier</TableHead>
          <TableHead>Applied</TableHead>
          <TableHead>Status</TableHead>
          {canAct ? <TableHead className="text-right">Review</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((a) => {
          const busy = Boolean(pending[a.id]);
          const isPending = a.status === 'pending';
          const canApprove = isPending && Boolean(a.applicantTenantId);
          return (
            <TableRow key={a.id}>
              <TableCell>
                <Stack gap={0}>
                  <Text className="font-medium">{a.name}</Text>
                  <Text size="xs" variant="muted">
                    {a.email || 'No email on file'}
                    {a.websiteUrl ? ` · ${a.websiteUrl}` : ''}
                  </Text>
                </Stack>
              </TableCell>
              <TableCell>
                <Text size="sm">{partnerKindLabel(a.kind)}</Text>
              </TableCell>
              <TableCell>
                <Text size="sm">{tierLabel(a.requestedTier)}</Text>
              </TableCell>
              <TableCell>
                <Text size="sm" variant="muted">
                  {formatDate(a.createdAt)}
                </Text>
              </TableCell>
              <TableCell>
                <Badge color={applicationStatusTone(a.status)} variant="soft">
                  {a.status}
                </Badge>
              </TableCell>
              {canAct ? (
                <TableCell className="text-right">
                  {isPending ? (
                    <Stack direction="row" gap={2} justify="end">
                      <Button
                        type="button"
                        size="sm"
                        color="primary"
                        disabled={busy || !canApprove}
                        loading={busy}
                        title={
                          canApprove
                            ? undefined
                            : 'The applicant has not created a Sparx account yet.'
                        }
                        onClick={act(a.id, 'approve', a.name, a.requestedTier, () =>
                          approveApplicationAction(a.id)
                        )}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="soft"
                        disabled={busy}
                        onClick={act(a.id, 'reject', a.name, a.requestedTier, () =>
                          rejectApplicationAction(a.id)
                        )}
                      >
                        Reject
                      </Button>
                    </Stack>
                  ) : (
                    <Text size="xs" variant="muted">
                      Reviewed
                    </Text>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
