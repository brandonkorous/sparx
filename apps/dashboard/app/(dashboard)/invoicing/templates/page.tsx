import { LayoutTemplate } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  Container,
  PageHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { TemplateRowActions } from './_components/template-row-actions';

interface TemplateRow {
  id: string;
  name: string;
  isDefault: boolean;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export const dynamic = 'force-dynamic';

export default async function InvoicingTemplatesPage() {
  // listOrSeed lazily materializes the built-in default on first visit.
  const templates = await api.get<TemplateRow[]>('/v1/invoicing/templates');

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<LayoutTemplate className="h-5 w-5" />}
          title="Print templates"
          description="Design how invoices and estimates print. Every document renders with the built-in default until you publish a template; the default template, once published, drives every document's print + PDF."
        />

        <Card padding="none">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Stack direction="row" align="center" gap={2}>
                        <Text size="sm" className="font-medium">
                          {t.name}
                        </Text>
                        {t.isDefault && (
                          <Badge color="module" variant="soft" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {t.published ? (
                        <Badge color="success" variant="soft" className="text-xs">
                          Published
                        </Badge>
                      ) : (
                        <Badge color="neutral" variant="soft" className="text-xs">
                          Draft
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {new Date(t.updatedAt).toLocaleDateString()}
                      </Text>
                    </TableCell>
                    <TableCell className="text-right">
                      <TemplateRowActions
                        id={t.id}
                        name={t.name}
                        isDefault={t.isDefault}
                        published={t.published}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Text size="xs" variant="muted">
          Templates reuse the builder framework (the same node-tree machinery as the page + email
          builders). The visual template editor is coming; today the default ships ready to publish,
          and you can preview any template against sample data.
        </Text>
      </Stack>
    </Container>
  );
}
