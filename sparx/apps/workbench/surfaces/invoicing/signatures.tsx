'use client';

// Asking a customer to sign a document, and what came back (docs/144 §12).
//
// SIGNING IS NOT A STAGE MOVE SOMEBODY DOES ON THE CUSTOMER'S BEHALF. A stage
// says where a document is in the tenant's own process; a signature is the
// customer's own act, taken on their own screen, with the date, the address and
// a frozen copy of exactly what they agreed to. That is why this is its own
// section rather than a button on the lifecycle row — and why the only thing
// staff can do to a live request is take it back.
//
// ONE LIVE REQUEST AT A TIME. Asking again revokes whatever was outstanding, so
// two people cannot both hold a working link to the same document and sign two
// different versions of it. The section says so before you press the button
// rather than after.
//
// THE LINK IS SHOWN ONCE. It is not stored and cannot be re-issued: it is the
// whole credential, and a signing address sitting in a panel that anybody with
// workbench access can reopen is a signature anybody could forge. If it is lost,
// ask again — which revokes the old one, which is the point.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Switch,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { Copy, PenLine } from 'lucide-react';
import { useConfirm } from '../../lib/confirm';
import { PaneScope } from '../../lib/dock/window-boundary';
import { FormSection } from '../../components/form-section';
import {
  signatureTone,
  useSignatureMutations,
  useSignatures,
  workspaceErrorMessage,
  type DocumentSignature,
} from '../crm/workspace-data';
import type { BillingDocument } from './types';

const STATUS_LABEL: Record<DocumentSignature['status'], string> = {
  pending: 'Waiting for them',
  signed: 'Signed',
  declined: 'Declined',
  expired: 'Ran out',
  revoked: 'Replaced',
};

function whenText(signature: DocumentSignature): string {
  const stamp = signature.signedAt ?? signature.declinedAt ?? signature.requestedAt;
  return new Date(stamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function SignaturesSection({
  doc,
  isDraft,
}: {
  doc: BillingDocument;
  /** Whether the document sits at a DRAFT stage — see the warning in the ask
   *  dialog. Passed in because the editor already resolved the workflow. */
  isDraft: boolean;
}) {
  const { data, isPending } = useSignatures(doc.id);
  const { request, revoke } = useSignatureMutations(doc.id);
  const toast = useToast();
  const confirm = useConfirm();

  const [asking, setAsking] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [notify, setNotify] = useState(true);
  // The one-time link, held only for as long as the panel is open.
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);

  const rows = data?.items ?? [];
  const live = rows.find((row) => row.status === 'pending');
  const signed = rows.find((row) => row.status === 'signed');

  const closeAsk = (): void => {
    setAsking(false);
    setSignerName('');
    setSignerEmail('');
    setNotify(true);
  };

  const submit = (): void => {
    request.mutate(
      { signerName: signerName.trim(), signerEmail: signerEmail.trim(), notify },
      {
        onSuccess: (result) => {
          closeAsk();
          setIssuedUrl(result.signingUrl);
          toast.add({
            title: result.emailed ? `Sent to ${signerEmail.trim()}` : 'Signing link ready',
            description: result.emailed
              ? undefined
              : 'Copy it below — it is shown once and cannot be looked up again.',
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not ask for a signature',
            description: workspaceErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const takeBack = async (signature: DocumentSignature): Promise<void> => {
    const ok = await confirm({
      title: `Take back the request to ${signature.signerName}?`,
      description:
        'Their link stops working straight away and they will be told it was replaced. Nothing about the document changes, and you can ask again whenever you are ready.',
      confirmLabel: 'Take it back',
      cancelLabel: 'Leave it',
      color: 'danger',
    });
    if (!ok) return;
    revoke.mutate(signature.id, {
      onSuccess: () => {
        setIssuedUrl(null);
        toast.add({ title: 'Request taken back', type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not take it back',
          description: workspaceErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const canAsk = signerName.trim() !== '' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(signerEmail.trim());

  return (
    // No description on the section: this renders in the document's narrow
    // right-hand column beside Payments, where a sentence becomes four words per
    // line and stops being readable. What it is for is said once, in the empty
    // state, where somebody who has never used it is actually looking.
    <FormSection
      title="Signature"
      action={
        signed ? null : (
          <Button
            color="module"
            variant={live ? 'outline' : 'solid'}
            size="sm"
            onClick={() => {
              setAsking(true);
            }}
          >
            <PenLine className="size-4" aria-hidden />
            {live ? 'Ask someone else' : 'Ask for a signature'}
          </Button>
        )
      }
    >
      {/* Shown once, right after issuing. Deliberately not persisted anywhere. */}
      {issuedUrl !== null ? (
        <Alert color="info">
          <AlertContent>
            <AlertTitle>Here is the link — this is the only time it is shown</AlertTitle>
            <AlertDescription>
              <span className="block font-mono text-sm break-all">{issuedUrl}</span>
            </AlertDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                color="module"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(issuedUrl);
                  toast.add({ title: 'Link copied', type: 'success' });
                }}
              >
                <Copy className="size-4" aria-hidden />
                Copy the link
              </Button>
              <Button
                color="neutral"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIssuedUrl(null);
                }}
              >
                Done with it
              </Button>
            </div>
          </AlertContent>
        </Alert>
      ) : null}

      {isPending ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : rows.length === 0 ? (
        <Text className="text-sm">
          Nobody has been asked to sign this yet. They get a link of their own — no account, no
          password — and signing it moves this document forward.
        </Text>
      ) : (
        // A STACKED LIST, not a table. This section lives in the document's
        // narrow right-hand column, where four columns cannot fit: the table
        // scrolled sideways and clipped the state to "Waiting fo", which is the
        // one word on the row somebody is actually reading. Stacked, every part
        // of it is legible at any width the column ever takes.
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="border-base-300 flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={signatureTone(row.status)} variant="soft" size="sm">
                  {STATUS_LABEL[row.status]}
                </Badge>
                <Text as="span" className="text-sm">
                  {whenText(row)}
                </Text>
              </div>
              <Text as="span" className="font-medium">
                {row.signerName}
              </Text>
              <Text as="span" className="text-sm break-all">
                {row.signerEmail}
              </Text>
              {row.declineReason !== null && row.declineReason !== '' ? (
                <Text as="span" className="text-sm">
                  They said: “{row.declineReason}”
                </Text>
              ) : null}
              {row.status === 'pending' ? (
                <div>
                  <Button
                    color="danger"
                    variant="ghost"
                    size="sm"
                    loading={revoke.isPending}
                    onClick={() => void takeBack(row)}
                  >
                    Take it back
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* Two fields and a switch, with no signature-request screen to come back
          to — a dialog by docs/123's test, exactly like inviting a teammate. */}
      <PaneScope>
        <Dialog
          open={asking}
          onOpenChange={(next) => {
            if (!next) closeAsk();
          }}
        >
          <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden">
            <DialogTitle>Ask for a signature</DialogTitle>

            <form
              id="ask-for-signature"
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (canAsk) submit();
              }}
            >
              {isDraft ? (
                <Alert color="warning">
                  <AlertContent>
                    <AlertTitle>This is still a draft</AlertTitle>
                    <AlertDescription>
                      You can send it, but a draft is the stage that means you have not finished
                      writing it — and anything they sign is frozen exactly as it is now. Move it on
                      first if you were still working on it.
                    </AlertDescription>
                  </AlertContent>
                </Alert>
              ) : null}

              {live ? (
                <Alert color="warning">
                  <AlertContent>
                    <AlertTitle>{live.signerName} already has a link</AlertTitle>
                    <AlertDescription>
                      Asking again stops theirs working. Only one person can hold a live link to a
                      document, so two versions of it can never be signed.
                    </AlertDescription>
                  </AlertContent>
                </Alert>
              ) : null}

              <Field>
                <FieldLabel>Their name</FieldLabel>
                <Input
                  color="module"
                  value={signerName}
                  placeholder="Dana Whitfield"
                  onChange={(event) => {
                    setSignerName(event.target.value);
                  }}
                />
                <FieldDescription>
                  Filled in for them on the signing page, and editable there — people sign for each
                  other.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Their email address</FieldLabel>
                <Input
                  color="module"
                  type="email"
                  value={signerEmail}
                  placeholder="dana@brightleafcatering.com"
                  autoComplete="off"
                  onChange={(event) => {
                    setSignerEmail(event.target.value);
                  }}
                />
              </Field>

              <Field>
                <div className="flex items-start gap-3">
                  <Switch
                    color="module"
                    aria-label="Email them the link"
                    checked={notify}
                    onCheckedChange={(checked) => {
                      setNotify(checked === true);
                    }}
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel>Email them the link</FieldLabel>
                    <FieldDescription>
                      Leave this off to send it yourself — you get the link to copy either way, and
                      only this once.
                    </FieldDescription>
                  </div>
                </div>
              </Field>
            </form>

            <DialogFooter>
              <Button color="neutral" variant="ghost" size="sm" onClick={closeAsk}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="ask-for-signature"
                color="module"
                size="sm"
                loading={request.isPending}
                disabled={!canAsk}
              >
                {notify ? 'Send it' : 'Make the link'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PaneScope>
    </FormSection>
  );
}
