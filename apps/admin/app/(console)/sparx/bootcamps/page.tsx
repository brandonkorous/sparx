import { requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import {
  Badge,
  Card,
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
import { OperatorApiError, type OperatorBootcampListResult } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { formatDate, formatMoneyCents } from '@/lib/format';
import { bootcampFormatLabel, bootcampLocation, tierLabel, tierTone } from '@/lib/partners';

// Cross-partner published-bootcamp overview (docs/114 §B.5). Read-only for
// operators: bootcamps are owned + run by the host partner (their CRM captures
// the registrations); WizeWorks sees the live public catalog. The list reads the
// same `withSystem` published-visible path the public /bootcamp directory uses.
export default async function BootcampsPage() {
  const operator = await requireCapability('partner:read');

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'partner:read',
      action: 'bootcamps.view',
    });
  } catch {
    // best-effort audit
  }

  let result: OperatorBootcampListResult | null = null;
  let error: string | null = null;
  try {
    result = await operatorApi().listBootcamps(operator.id);
  } catch (err) {
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title="Bootcamps"
        description="Published partner-hosted bootcamps across the platform — the live public catalog. Bootcamps are run by their host partner (registrations flow into that partner’s CRM); this is a read-only overview."
      />

      {error ? (
        <Card>
          <Text variant="muted">{error}</Text>
        </Card>
      ) : !result || result.items.length === 0 ? (
        <Card>
          <Text variant="muted">No published bootcamps right now.</Text>
        </Card>
      ) : (
        <Card>
          <Stack gap={3}>
            <Text size="sm" variant="muted">
              {result.total} published {result.total === 1 ? 'bootcamp' : 'bootcamps'}
            </Text>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bootcamp</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((b) => {
                  const loc = bootcampLocation(b.locationCity, b.locationState);
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Stack gap={0}>
                          <Text className="font-medium">{b.title}</Text>
                          {loc ? (
                            <Text size="xs" variant="muted">
                              {loc}
                            </Text>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" align="center" gap={2}>
                          <Text size="sm">{b.host.displayName}</Text>
                          <Badge color={tierTone(b.host.tier)} variant="soft" size="sm">
                            {tierLabel(b.host.tier)}
                          </Badge>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Text size="sm">{bootcampFormatLabel(b.format)}</Text>
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          {formatDate(b.startsAt)}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text size="sm">
                          {b.seatsFilled}
                          {b.seatsTotal != null ? ` / ${b.seatsTotal}` : ''}
                        </Text>
                      </TableCell>
                      <TableCell className="text-right">
                        <Text size="sm">
                          {b.priceCents > 0 ? formatMoneyCents(b.priceCents) : 'Free'}
                        </Text>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
