'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import {
    Badge,
    Button,
    Input,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Text,
} from '@sparx/ui';
import { addApprovalRule, deleteApprovalRule } from '../../_lib/actions';

interface ApprovalRule {
    id: string;
    accountId: string | null;
    accountName: string | null;
    minAmountCents: number;
    minAmountFormatted: string;
    requiredApproverUserId: string | null;
    requiredApproverName: string | null;
    isActive: boolean;
    createdAt: string;
}

interface Props {
    accountId: string;
    rules: ApprovalRule[];
}

export function ApprovalRulesEditor({ accountId, rules }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showAdd, setShowAdd] = useState(false);
    const [minAmount, setMinAmount] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleAdd() {
        const dollars = parseFloat(minAmount.replace(/[^0-9.]/g, ''));
        if (isNaN(dollars) || dollars < 0) {
            setError('Enter a valid amount');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const { error: err } = await addApprovalRule(accountId, Math.round(dollars * 100));
            if (err) throw new Error(err);
            setMinAmount('');
            setShowAdd(false);
            startTransition(() => router.refresh());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add rule');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(ruleId: string) {
        setDeleting(ruleId);
        try {
            await deleteApprovalRule(ruleId);
            startTransition(() => router.refresh());
        } finally {
            setDeleting(null);
        }
    }

    return (
        <Stack gap={4}>
            {rules.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Threshold</TableHead>
                            <TableHead>Required approver</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rules.map((rule) => (
                            <TableRow key={rule.id}>
                                <TableCell>
                                    <Text size="sm" className="font-medium tabular-nums">
                                        Orders over {rule.minAmountFormatted}
                                    </Text>
                                </TableCell>
                                <TableCell>
                                    <Text size="sm" variant={rule.requiredApproverName ? 'default' : 'muted'}>
                                        {rule.requiredApproverName ?? 'Any staff member'}
                                    </Text>
                                </TableCell>
                                <TableCell>
                                    <Badge color={rule.isActive ? 'success' : 'neutral'} variant="soft">
                                        {rule.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Button
                                        size="sm"
                                        color="danger"
                                        variant="ghost"
                                        disabled={deleting === rule.id || isPending}
                                        onClick={() => void handleDelete(rule.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <Text size="sm" variant="muted">
                    No approval rules. Orders from this account are placed immediately.
                </Text>
            )}

            {showAdd ? (
                <Stack gap={3}>
                    <Stack direction="row" align="end" gap={3}>
                        <Stack gap={2}>
                            <Text size="sm" className="font-medium">
                                Require approval for orders over
                            </Text>
                            <Input
                                type="text"
                                placeholder="e.g. 500"
                                value={minAmount}
                                onChange={(e) => {
                                    setMinAmount(e.target.value);
                                    setError(null);
                                }}
                                className="w-40"
                                disabled={saving}
                            />
                        </Stack>
                        <Button
                            color="module"
                            size="sm"
                            disabled={saving || isPending}
                            onClick={() => void handleAdd()}
                        >
                            {saving ? 'Saving…' : 'Add Rule'}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={saving}
                            onClick={() => {
                                setShowAdd(false);
                                setMinAmount('');
                                setError(null);
                            }}
                        >
                            Cancel
                        </Button>
                    </Stack>
                    {error && (
                        <Text size="sm" className="text-[var(--color-danger)]">
                            {error}
                        </Text>
                    )}
                </Stack>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    color="module"
                    className="self-start"
                    onClick={() => setShowAdd(true)}
                >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add approval rule
                </Button>
            )}
        </Stack>
    );
}
