import { Calendar } from 'lucide-react';

import {
  Badge,
  Card,
  Container,
  EmptyState,
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
import { ServiceTypeActions } from './_components/service-type-actions';
import { NewServiceTypeButton } from './_components/new-service-type-button';

export const dynamic = 'force-dynamic';

interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  color: string | null;
  isActive: boolean;
  requiresVehicle: boolean;
  notes: string | null;
  createdAt: string;
}

export default async function ServiceTypesPage() {
  const { data } = await api.get<{ types: ServiceType[] }>('/v1/b2b/service-types');
  const types = data.types ?? [];

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Calendar className="h-5 w-5" />}
          title="Service Types"
          description="Define the types of service your team offers for B2B account appointments."
          actions={<NewServiceTypeButton />}
        />

        {types.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title="No service types yet"
              description="Add your first service type so B2B accounts can book appointments."
              action={<NewServiceTypeButton />}
            />
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Requires vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Stack direction="row" gap={2} className="items-center">
                      {t.color && (
                        <span
                          className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                      )}
                      <Stack gap={1}>
                        <Text size="sm" className="font-medium">
                          {t.name}
                        </Text>
                        {t.description && (
                          <Text size="xs" variant="muted" className="line-clamp-1">
                            {t.description}
                          </Text>
                        )}
                      </Stack>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Text size="sm">{t.durationMinutes} min</Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm">{t.requiresVehicle ? 'Yes' : 'No'}</Text>
                  </TableCell>
                  <TableCell>
                    <Badge color={t.isActive ? 'success' : 'warning'} variant="soft" size="sm">
                      {t.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ServiceTypeActions type={t} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
    </Container>
  );
}
