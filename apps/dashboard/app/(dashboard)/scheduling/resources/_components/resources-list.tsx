'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  toast,
  useConfirm,
} from '@sparx/ui';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import type { SchedulingResource } from '../../_lib/types';
import { RESOURCE_KIND_LABEL } from '../../_lib/format';
import { deleteResourceAction } from '../../_lib/actions';
import { ResourceForm } from './resource-form';

export function ResourcesList({ resources }: { resources: SchedulingResource[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<SchedulingResource | null>(null);

  async function remove(r: SchedulingResource) {
    const ok = await confirm({
      title: `Delete "${r.name}"?`,
      description: 'The resource is archived; existing bookings keep their reference.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await deleteResourceAction(r.id);
    if (result.ok) {
      toast.success('Resource deleted');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>Skills</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-2">
                  {r.color ? (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                  ) : null}
                  {r.name}
                </span>
              </TableCell>
              <TableCell>{RESOURCE_KIND_LABEL[r.kind]}</TableCell>
              <TableCell>
                {r.kind === 'table' && (r.capacityMin || r.capacityMax)
                  ? `${r.capacityMin ?? 1}–${r.capacityMax ?? r.capacity}`
                  : r.capacity}
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap gap-1">
                  {r.skillTags.slice(0, 4).map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                  {r.skillTags.length > 4 ? (
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      +{r.skillTags.length - 4}
                    </span>
                  ) : null}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="soft" color={r.exclusive ? 'neutral' : 'info'}>
                  {r.exclusive ? 'Exclusive' : 'Pooled'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge color={r.isActive ? 'success' : 'neutral'} variant="soft">
                  {r.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" shape="square" size="sm" aria-label="Resource actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(r)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void remove(r)}
                      className="text-[var(--color-danger)]"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <ModalContent className="max-w-xl">
          <ModalHeader>
            <ModalTitle>Edit resource</ModalTitle>
          </ModalHeader>
          {editing ? (
            <ResourceForm
              resource={editing}
              onSuccess={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </ModalContent>
      </Modal>
    </>
  );
}
