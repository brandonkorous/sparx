import Link from 'next/link';
import { LayoutTemplate, Mail } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Grid,
  Heading,
  Stack,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { EmailShell } from '../_components/email-shell';
import type { TemplateListResponse } from '../_lib/types';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const { builtins } = await api.get<TemplateListResponse>('/v1/email/templates');

  return (
    <EmailShell
      width="full"
      icon={<LayoutTemplate className="h-5 w-5" />}
      title="Templates"
      description="Built-in transactional templates. Marketing emails are designed in the Email Builder."
    >
      <Stack gap={3}>
        <Heading level={3}>Transactional</Heading>
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          {builtins.map((t) => (
            <Card key={t.key} variant="module">
              <CardHeader>
                <Stack direction="row" align="center" justify="between" gap={2}>
                  <CardTitle>{t.name}</CardTitle>
                  {t.customized ? <Badge color="primary">Customized</Badge> : null}
                </Stack>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Stack gap={2}>
                  <Text size="sm" variant="muted">
                    Subject: {t.subject}
                  </Text>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/email/templates/builtin/${t.key}`}>Customize</Link>
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Stack>

      <Stack gap={3}>
        <Heading level={3}>Marketing</Heading>
        <Card variant="module">
          <CardHeader>
            <Stack direction="row" align="center" gap={2}>
              <Mail className="h-5 w-5 text-[var(--module-active)]" />
              <CardTitle>Design marketing emails in the Email Builder</CardTitle>
            </Stack>
            <CardDescription>
              Compose a branded email as a single layout — headings, copy, buttons, product grids,
              and per-recipient personalization — then send it to a segment from Broadcasts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button color="module" size="sm" asChild>
              <Link href="/builder/email">Open the Email Builder</Link>
            </Button>
          </CardContent>
        </Card>
      </Stack>
    </EmailShell>
  );
}
