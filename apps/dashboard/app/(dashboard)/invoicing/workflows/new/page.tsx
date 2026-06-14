'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Container,
  Input,
  Label,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { createWorkflowAction } from '../../workflow-actions';

// New-workflow form. Stages are added on the edit screen after creation — keeping
// create simple (just name + slug) means a tenant can start from an empty workflow
// and shape its lifecycle next. Mirrors the CRM new-pipeline form.

export default function NewWorkflowPage() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const input = {
      name: nonEmpty(form.get('name')),
      slug: nonEmpty(form.get('slug')),
      isDefault: form.get('isDefault') === 'on',
      sortOrder: 0,
    };

    startTransition(async () => {
      const result = await createWorkflowAction(input);
      if (result.ok) {
        router.push(`/invoicing/workflows/${result.data.id}/edit`);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="New workflow"
          description="Create the workflow shell now; add its stages on the edit screen next."
        />

        <form onSubmit={onSubmit} noValidate>
          <Card>
            <CardHeader>
              <CardTitle>Workflow details</CardTitle>
            </CardHeader>
            <CardContent>
              <Stack gap={4}>
                <Stack gap={2}>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required placeholder="Repair order" />
                  <Text size="xs" variant="muted">
                    The internal name for this lifecycle (e.g. Repair Order, Quick Invoice, Tattoo
                    Booking).
                  </Text>
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    name="slug"
                    required
                    placeholder="repair-order"
                    pattern="^[a-z][a-z0-9-]*$"
                  />
                  <Text size="xs" variant="muted">
                    Lowercase kebab-case. Used as the stable identifier.
                  </Text>
                </Stack>
                <Stack direction="row" align="center" gap={2}>
                  <input type="checkbox" id="isDefault" name="isDefault" className="h-4 w-4" />
                  <Label htmlFor="isDefault">Make this the default workflow</Label>
                </Stack>

                {error && (
                  <Text size="sm" variant="danger" role="alert" aria-live="polite">
                    {error}
                  </Text>
                )}
              </Stack>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" asChild>
                <Link href="/invoicing/workflows">Cancel</Link>
              </Button>
              <Button type="submit" color="module" disabled={pending} loading={pending}>
                Create workflow
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Stack>
    </Container>
  );
}

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
