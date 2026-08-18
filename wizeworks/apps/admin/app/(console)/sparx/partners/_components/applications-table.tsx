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
} from '@wizeworks/ui';
import type { OperatorPartnerApplication } from '@wizeworks/operator';
import { formatDate } from '@/lib/format';
import { applicationStatusTone, partnerKindLabel, tierLabel } from '@/lib/partners';
import { approveApplicationAction, rejectApplicationAction } from '../actions';

// WizeWorks' partner-application review queue. Pending rows get Approve (grants
// the REQUESTED tier — adjust later from the partner's detail) and Reject, each
// confirmed. A partner IS a tenant, so approval needs a Sparx account: if the
// applicant applied from one it's already linked; if they applied via the public
// form (email only), approving CREATES the account for them and emails a
// set-password invite (the confirm copy says which). We only disable Approve when
// there's neither a linked account NOR an email to invite.
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
    a: OperatorPartnerApplication,
    kind: 'approve' | 'reject',
    run: () => Promise<{ ok: boolean; error?: string }>
  ) {
    return async () => {
      // Approving an application with no linked account provisions one now.
      const willProvision = kind === 'approve' && !a.applicantTenantId;
      const description =
        kind === 'reject'
          ? 'Declines this application. They can re-apply later. No account is created.'
          : willProvision
            ? `No Sparx account is linked yet. Approving sets ${
                a.email || 'this applicant'
              } up as a partner at the ${tierLabel(
                a.requestedTier
              )} tier — creating their account (or adding a partner workspace if they already have one) and emailing them how to sign in. They can then manage referrals, commissions, and payouts.`
            : `Activates their partner account at the ${tierLabel(
                a.requestedTier
              )} tier and mints a referral code. They can host bootcamps and earn referral commissions.`;
      const ok = await confirm({
        title: kind === 'approve' ? `Approve ${a.name}?` : `Reject ${a.name}?`,
        description,
        confirmLabel:
          kind === 'reject'
            ? 'Reject'
            : willProvision
              ? 'Create account & approve'
              : 'Approve partner',
        color: kind === 'approve' ? 'module' : 'warning',
      });
      if (!ok) return;
      setPending((p) => ({ ...p, [a.id]: true }));
      startTransition(async () => {
        const res = await run();
        if (res.ok) toast.success(kind === 'approve' ? `${a.name} approved` : `${a.name} rejected`);
        else toast.error(res.error ?? 'Action failed.');
        setPending((p) => ({ ...p, [a.id]: false }));
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
          // Approvable if pending AND we can attach a partner to a tenant — either
          // a linked account, or an email we can provision + invite an account for.
          const canApprove = isPending && (Boolean(a.applicantTenantId) || Boolean(a.email));
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
                            : 'This applicant has no Sparx account and no email to invite.'
                        }
                        onClick={act(a, 'approve', () => approveApplicationAction(a.id))}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="soft"
                        disabled={busy}
                        onClick={act(a, 'reject', () => rejectApplicationAction(a.id))}
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
