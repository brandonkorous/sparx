'use client';

// Customer create entry point (docs/68 B-5) — a dropdown split:
//   • Quick add   — a narrow modal: first/last/email → POST /v1/crm/customers,
//                   then jump straight to the new customer's detail view.
//   • Full profile — the three-step wizard at /crm/customers/new.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Stack,
} from '@sparx/ui';
import { ChevronDown, Plus, UserCog, Zap } from 'lucide-react';

import { createCustomerAction } from '../../customer-actions';

export function CustomerNewButton(): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(): void {
    setError(null);
    start(async () => {
      const res = await createCustomerAction({
        type: 'retail',
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setOpen(false);
      router.push(`/crm/customers/${res.data.id}`);
    });
  }

  const canSubmit = (firstName.trim() !== '' || email.trim() !== '') && !pending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button color="module" leftIcon={<Plus className="h-4 w-4" />}>
            New
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <Zap className="mr-2 h-4 w-4" />
            Quick add
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/crm/customers/new">
              <UserCog className="mr-2 h-4 w-4" />
              Full profile
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Quick add customer</ModalTitle>
          </ModalHeader>
          <Stack gap={3} className="px-6 py-2">
            <Input
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          </Stack>
          <ModalFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button color="module" onClick={submit} disabled={!canSubmit}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
