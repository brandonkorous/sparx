'use client';

// Payments against a document — the half of the lifecycle stages can't do.
//
// A document's STAGE is where it is in the tenant's process; whether it is
// PAID is a fact about money, derived server-side from the payments recorded
// against it. Moving an invoice to "Receipt" freezes and locks it — it does
// not settle it. This section is where it gets settled: each payment is an
// append-only row (a correction is a refund row, never an edit), and the
// balance, status, and AR aging all reflow from the ledger.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import {
    Alert,
    Button,
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
    Field,
    FieldControl,
    FieldDescription,
    FieldLabel,
    Input,
    Select,
    Table,
    Text,
    useToast,
} from '@wizeworks/silicaui-react';
import { HandCoins } from 'lucide-react';
import { api } from '../../lib/api/client';
import { PaneScope } from '../../lib/dock/window-boundary';
import { FormSection } from '../../components/form-section';
import { MoneyInput } from './money-input';
import { formatMoney, type BillingDocument } from './types';

export interface PaymentRow {
    id: string;
    kind: 'deposit' | 'payment' | 'refund';
    method: string;
    amount: number | string;
    reference: string | null;
    note: string | null;
    receivedAt: string;
}

const METHOD_LABELS: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    check: 'Check',
    ach: 'Bank transfer (ACH)',
    wire: 'Wire',
    account_credit: 'Account credit',
    other: 'Other',
};

const KIND_LABELS: Record<PaymentRow['kind'], string> = {
    deposit: 'Deposit',
    payment: 'Payment',
    refund: 'Refund',
};

function usePayments(documentId: string, enabled: boolean) {
    return useQuery({
        queryKey: ['invoicing', 'payments', documentId],
        queryFn: () => api.get<PaymentRow[]>(`/v1/invoicing/documents/${documentId}/payments`),
        enabled,
    });
}

interface PaymentsSectionProps {
    doc: BillingDocument;
}

export function PaymentsSection({ doc }: PaymentsSectionProps) {
    const { data: payments, isLoading } = usePayments(doc.id, true);

    return (
        <FormSection
            title="Payments"
            description={
                doc.balance > 0
                    ? `${formatMoney(doc.balance, doc.currency)} still owed of ${formatMoney(doc.total, doc.currency)}.`
                    : doc.amountPaid > 0
                        ? 'Paid in full.'
                        : 'Nothing owed yet.'
            }
            action={<RecordPaymentDialog doc={doc} />}
        >
            {isLoading ? (
                <Text className="text-sm" role="status">
                    Loading payments…
                </Text>
            ) : !payments || payments.length === 0 ? (
                <Text className="text-sm">
                    No payments recorded yet. When money comes in — however it comes in — record it here and
                    the balance updates everywhere.
                </Text>
            ) : (
                <Table size="sm">
                    <thead>
                        <tr>
                            <th>When</th>
                            <th>Kind</th>
                            <th className="hidden @xl:table-cell">How</th>
                            <th className="hidden @2xl:table-cell">Reference</th>
                            <th className="text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payments.map((payment) => {
                            const amount = Number(payment.amount);
                            const refund = payment.kind === 'refund';
                            return (
                                <tr key={payment.id}>
                                    <td className="whitespace-nowrap">
                                        {new Date(payment.receivedAt).toLocaleDateString(undefined, {
                                            dateStyle: 'medium',
                                        })}
                                    </td>
                                    <td>{KIND_LABELS[payment.kind]}</td>
                                    <td className="hidden @xl:table-cell">
                                        {METHOD_LABELS[payment.method] ?? payment.method}
                                    </td>
                                    <td className="hidden max-w-40 truncate @2xl:table-cell">
                                        {payment.reference ?? '—'}
                                    </td>
                                    {/* Refunds show negative — the ledger reads like a ledger. */}
                                    <td className={`text-right tabular-nums ${refund ? 'text-danger' : ''}`}>
                                        {refund ? '−' : ''}
                                        {formatMoney(amount, doc.currency)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            )}
        </FormSection>
    );
}

function RecordPaymentDialog({ doc }: { doc: BillingDocument }) {
    const queryClient = useQueryClient();
    const toast = useToast();
    const [open, setOpen] = useState(false);
    // Defaults to the outstanding balance — "they paid it off" is the common
    // case and should be zero extra typing. Partial payments edit down.
    const [amount, setAmount] = useState(doc.balance);
    const [method, setMethod] = useState('other');
    const [kind, setKind] = useState<'payment' | 'deposit' | 'refund'>('payment');
    const [reference, setReference] = useState('');

    const record = useMutation({
        mutationFn: () =>
            api.post<{ document: BillingDocument; payment: PaymentRow }>(
                `/v1/invoicing/documents/${doc.id}/payments`,
                {
                    kind,
                    method,
                    amount,
                    reference: reference.trim() || null,
                }
            ),
        onSuccess: (result) => {
            void queryClient.invalidateQueries({ queryKey: ['invoicing'] });
            setOpen(false);
            const settled = Number(result.document.balance) <= 0;
            toast.add({
                title: settled ? 'Paid in full' : 'Payment recorded',
                description: settled
                    ? `${doc.number ?? 'This document'} is settled.`
                    : `${formatMoney(Number(result.document.balance), doc.currency)} still owed.`,
                type: 'success',
            });
        },
        onError: () => {
            toast.add({
                title: 'Could not record that payment',
                description: 'Nothing was saved. Check the amount and try again.',
                type: 'error',
            });
        },
    });

    return (
        // PaneScope portals the dialog into the pane that opened it. Two things
        // depend on it: the modal covers only THIS document rather than the whole
        // app, and — less obviously — `color="module"` resolves at all. A dialog
        // portalled to document.body renders OUTSIDE the pane's [data-module]
        // element, so --color-module is unset and every module-colored control
        // silently falls back to primary. Scoping it is what makes the props below
        // mean what they say.
        <PaneScope>
            <Dialog
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    if (next) {
                        // Fresh numbers every open — the balance may have moved since last time.
                        setAmount(doc.balance);
                        setKind('payment');
                        setMethod('other');
                        setReference('');
                        record.reset();
                    }
                }}
            >
                <DialogTrigger>
                    <Button color="module" variant="soft" size="sm">
                        <HandCoins className="size-4" aria-hidden />
                        Record a payment
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                    <DialogTitle>Record a payment</DialogTitle>
                    <DialogDescription>
                        {doc.balance > 0
                            ? `${formatMoney(doc.balance, doc.currency)} is still owed on ${doc.number ?? 'this document'}.`
                            : `${doc.number ?? 'This document'} has no balance — record a deposit or a refund.`}
                    </DialogDescription>

                    <div className="flex flex-col gap-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <Field>
                                <FieldLabel>Amount</FieldLabel>
                                <FieldControl
                                    render={
                                        <MoneyInput
                                            color="module"
                                            size="md"
                                            value={amount}
                                            aria-label="Payment amount"
                                            onValueChange={setAmount}
                                        />
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel>What kind</FieldLabel>
                                <Select
                                    color="module"
                                    items={KIND_LABELS}
                                    value={kind}
                                    aria-label="What kind of payment"
                                    onValueChange={(next) => {
                                        setKind(next as typeof kind);
                                    }}
                                />
                                <FieldDescription>
                                    {kind === 'refund' ? 'Money going back to the customer' : 'Money coming in'}
                                </FieldDescription>
                            </Field>
                        </div>

                        <Field>
                            <FieldLabel>How it was paid</FieldLabel>
                            <Select
                                color="module"
                                items={METHOD_LABELS}
                                value={method}
                                aria-label="Payment method"
                                onValueChange={(next) => {
                                    setMethod(next as string);
                                }}
                            />
                        </Field>

                        <Field>
                            <FieldLabel>Reference</FieldLabel>
                            <FieldControl
                                render={
                                    <Input
                                        color="module"
                                        value={reference}
                                        placeholder="Check number, memo, confirmation code…"
                                        onChange={(event) => {
                                            setReference(event.target.value);
                                        }}
                                    />
                                }
                            />
                            <FieldDescription>Optional — whatever helps you find it later</FieldDescription>
                        </Field>

                        {record.error ? (
                            <Alert color="danger" variant="soft">
                                That didn&rsquo;t save. Check the amount and try again.
                            </Alert>
                        ) : null}
                    </div>

                    <DialogFooter>
                        <DialogClose>
                            <Button color="neutral" variant="ghost" size="sm">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            color="module"
                            size="sm"
                            disabled={amount <= 0 || record.isPending}
                            onClick={() => {
                                record.mutate();
                            }}
                        >
                            {record.isPending ? 'Recording…' : `Record ${formatMoney(amount, doc.currency)}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PaneScope>
    );
}
