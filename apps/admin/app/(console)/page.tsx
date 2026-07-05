import { Badge, Card, Heading, Stack, Text } from '@sparx/ui';
import { requireOperator } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import { OPERATOR_CAPABILITY_LABELS } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';

export default async function ConsoleHome() {
  const operator = await requireOperator();

  // Audit the cross-tenant console view at the action level (§7). Best-effort —
  // a logging failure must never blank the page.
  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      action: 'console.view',
    });
  } catch {
    // swallowed — see comment above
  }

  // Prove the api-rest /internal/operator seam end-to-end (the Slice-1 DoD): the
  // admin app authenticates the operator, then reaches api-rest with the shared
  // secret + the operator id, and api-rest echoes it back.
  let apiOk = false;
  let apiDetail: string;
  try {
    const res = await operatorApi().whoami(operator.id);
    apiOk = res.ok && res.operatorId === operator.id;
    apiDetail = apiOk
      ? `api-rest echoed operator ${res.operatorId} at ${res.time}`
      : `Unexpected response (operatorId=${res.operatorId ?? 'null'})`;
  } catch (err) {
    apiDetail = err instanceof Error ? err.message : 'api-rest unreachable';
  }

  return (
    <Stack gap={6}>
      <Stack gap={1}>
        <Heading level={1}>Operator console</Heading>
        <Text variant="muted">
          Signed in as {operator.email}. This is the Slice-1 shell — tenant management, metrics,
          billing, domains, support, and feedback land in the next slices.
        </Text>
      </Stack>

      <Card>
        <Stack gap={3}>
          <Heading level={3}>Your capabilities</Heading>
          {operator.capabilities.length === 0 ? (
            <Text variant="muted">
              No capabilities granted yet — ask a super admin to grant access.
            </Text>
          ) : (
            <div className="flex flex-wrap gap-2">
              {operator.capabilities.map((capability) => (
                <Badge key={capability} color="primary" variant="soft">
                  {OPERATOR_CAPABILITY_LABELS[capability]}
                </Badge>
              ))}
            </div>
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={2}>
          <Stack direction="row" align="center" justify="between">
            <Heading level={3}>api-rest connectivity</Heading>
            <Badge color={apiOk ? 'success' : 'danger'} variant="soft">
              {apiOk ? 'Connected' : 'Unavailable'}
            </Badge>
          </Stack>
          <Text size="sm" variant="muted">
            {apiDetail}
          </Text>
          <Text size="xs" variant="muted">
            All cross-tenant data flows through this internal seam — the console holds no tenant
            database access of its own.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
