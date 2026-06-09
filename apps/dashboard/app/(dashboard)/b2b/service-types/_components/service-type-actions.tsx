'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Modal,
    ModalContent,
    ModalDescription,
    ModalFooter,
    ModalHeader,
    ModalTitle,
    Text,
} from '@sparx/ui';
import { updateServiceType, deleteServiceType } from '../_lib/actions';
import { ServiceTypeForm } from './service-type-form';

interface ServiceType {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    color: string | null;
    isActive: boolean;
    requiresVehicle: boolean;
    notes: string | null;
}

interface Props {
    type: ServiceType;
}

export function ServiceTypeActions({ type }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function refresh() {
        startTransition(() => router.refresh());
    }

    async function toggleActive() {
        setSubmitting(true);
        setError(null);
        try {
            const { error: err } = await updateServiceType(type.id, { isActive: !type.isActive });
            if (err) throw new Error(err);
            refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete() {
        setSubmitting(true);
        setError(null);
        try {
            const { error: err } = await deleteServiceType(type.id);
            if (err) throw new Error(err);
            setDeleteOpen(false);
            refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" disabled={isPending || submitting}>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void toggleActive()}>
                        <Power className="mr-2 h-4 w-4" />
                        {type.isActive ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onSelect={() => setDeleteOpen(true)}
                        className="text-[var(--color-danger)]"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Edit modal */}
            <Modal open={editOpen} onOpenChange={setEditOpen}>
                <ModalContent>
                    <ModalHeader>
                        <ModalTitle>Edit service type</ModalTitle>
                    </ModalHeader>
                    <div className="px-6 pb-6">
                        <ServiceTypeForm
                            type={type}
                            onSuccess={() => {
                                setEditOpen(false);
                                refresh();
                            }}
                            onCancel={() => setEditOpen(false)}
                        />
                    </div>
                </ModalContent>
            </Modal>

            {/* Delete confirm modal */}
            <Modal open={deleteOpen} onOpenChange={setDeleteOpen}>
                <ModalContent>
                    <ModalHeader>
                        <ModalTitle>Delete &ldquo;{type.name}&rdquo;?</ModalTitle>
                        <ModalDescription>
                            This will remove the service type. Existing appointments using this type will not be
                            affected, but new bookings will no longer be possible.
                        </ModalDescription>
                    </ModalHeader>

                    {error && (
                        <div className="px-6 pb-2">
                            <Text size="sm" className="text-[var(--color-danger)]">
                                {error}
                            </Text>
                        </div>
                    )}

                    <ModalFooter>
                        <Button variant="ghost" disabled={submitting} onClick={() => setDeleteOpen(false)}>
                            Keep
                        </Button>
                        <Button color="danger" disabled={submitting} onClick={() => void handleDelete()}>
                            {submitting ? 'Deleting…' : 'Delete'}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
