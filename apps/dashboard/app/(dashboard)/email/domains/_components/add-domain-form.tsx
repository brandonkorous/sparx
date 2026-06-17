'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  Button,
  Heading,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Text,
  toast,
} from '@sparx/ui';

import { createDomainAction } from '../actions';

// Surface-aware create form (§13.1). The SAME component renders:
//   - `surface="page"`    inside the /new route's Container + PageHeader
//   - `surface="overlay"` inside drawer/modal chrome (internal heading block)
//
// Sending domains have NO detail view, so there is no create-flows-into-view
// transition: on success we keep the form open, reset the field, refresh the
// list behind, and let the user add another / read the DNS records.

interface AddDomainFormProps {
  surface: 'page' | 'overlay';
}

export function AddDomainForm({ surface }: AddDomainFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [domain, setDomain] = useState('');
  const [region, setRegion] = useState('us');
  const [error, setError] = useState<string | null>(null);

  function closeOverlay() {
    const next = new URLSearchParams(searchParams ?? '');
    next.delete('drawer');
    next.delete('modal');
    const qs = next.toString();
    router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createDomainAction({ domain: domain.trim(), region });
      if (result.ok) {
        toast.success(`${result.data.domain} added — publish the DNS records, then verify.`);
        setDomain('');
        router.refresh();
      } else {
        setError(result.error.message);
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Stack gap={6}>
      {surface === 'overlay' && (
        <Stack gap={1}>
          <Heading level={2}>Add a sending domain</Heading>
          <Text size="sm" variant="muted">
            Enter the domain (or subdomain) you want to send from. sparx provisions it in Mailgun
            and shows the exact DNS records to publish.
          </Text>
        </Stack>
      )}

      <form onSubmit={onSubmit}>
        <Stack direction="row" align="end" gap={3} className="flex-wrap">
          <Stack gap={2} className="min-w-64 flex-1">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="mail.yourstore.com"
              disabled={pending}
              autoComplete="off"
            />
          </Stack>
          <Stack gap={2}>
            <Label htmlFor="region">Region</Label>
            <Select value={region} onValueChange={setRegion} disabled={pending}>
              <SelectTrigger id="region" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">US</SelectItem>
                <SelectItem value="eu">EU</SelectItem>
              </SelectContent>
            </Select>
          </Stack>
          <Button
            type="submit"
            color="module"
            loading={pending}
            disabled={pending || !domain.trim()}
          >
            <Plus className="h-4 w-4" />
            Add domain
          </Button>
          {surface === 'overlay' ? (
            <Button type="button" variant="ghost" onClick={closeOverlay}>
              Close
            </Button>
          ) : (
            <Button variant="ghost" asChild>
              <Link href="/email/domains">Back</Link>
            </Button>
          )}
        </Stack>
        {error ? (
          <Text size="sm" variant="danger" className="mt-2">
            {error}
          </Text>
        ) : null}
      </form>
    </Stack>
  );
}
