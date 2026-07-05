import { Card, Heading, Stack, Text } from '@sparx/ui';

// The captured client context (docs/112 §4), rendered readable so staff never
// have to ask "where were you / what were you doing". Per build-plan D7 there is
// NO impersonation deep-link — the entity is shown, never linked into a tenant
// session. Attachments are listed by count/id (an operator-scoped media proxy for
// inline thumbnails is a deferred follow-up).

interface CtxShape {
  route?: unknown;
  routePattern?: unknown;
  module?: unknown;
  section?: unknown;
  entity?: { type?: unknown; id?: unknown } | null;
  pageTitle?: unknown;
  property?: { id?: unknown; name?: unknown } | null;
  trail?: unknown;
  viewport?: { width?: unknown; height?: unknown } | null;
  device?: unknown;
  theme?: unknown;
  locale?: unknown;
  appVersion?: unknown;
  userAgent?: unknown;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" align="start" justify="between" className="gap-4">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <span className="text-right text-sm break-all">{value}</span>
    </Stack>
  );
}

export function ContextPanel({
  context,
  attachmentAssetIds,
}: {
  context: unknown;
  attachmentAssetIds: string[];
}) {
  const ctx = (context && typeof context === 'object' ? context : {}) as CtxShape;
  const entity = ctx.entity ?? null;
  const property = ctx.property ?? null;
  const viewport = ctx.viewport ?? null;
  const trail = Array.isArray(ctx.trail)
    ? ctx.trail.filter((t): t is string => typeof t === 'string')
    : [];

  const facts: { label: string; value: string }[] = [];
  const push = (label: string, value: string | null): void => {
    if (value) facts.push({ label, value });
  };
  push('Page', str(ctx.pageTitle));
  push('Route', str(ctx.route));
  push('Route pattern', str(ctx.routePattern));
  push('Module', str(ctx.module));
  push('Section', str(ctx.section));
  if (entity) {
    const type = str(entity.type);
    const id = str(entity.id);
    if (type ?? id) push('Entity', [type, id].filter(Boolean).join(' · '));
  }
  if (property) push('Site', str(property.name) ?? str(property.id));
  push('Device', str(ctx.device));
  if (viewport && typeof viewport.width === 'number' && typeof viewport.height === 'number') {
    push('Viewport', `${viewport.width} × ${viewport.height}`);
  }
  push('Theme', str(ctx.theme));
  push('Locale', str(ctx.locale));
  push('App version', str(ctx.appVersion));
  push('User agent', str(ctx.userAgent));

  return (
    <Card>
      <Stack gap={3}>
        <Heading level={3}>Context</Heading>
        {facts.length === 0 && trail.length === 0 && attachmentAssetIds.length === 0 ? (
          <Text variant="muted">No context was captured with this submission.</Text>
        ) : (
          <>
            {facts.length > 0 ? (
              <Stack gap={2}>
                {facts.map((f) => (
                  <Fact key={f.label} label={f.label} value={f.value} />
                ))}
              </Stack>
            ) : null}

            {trail.length > 0 ? (
              <Stack gap={1}>
                <Text size="sm" variant="muted">
                  Visit trail
                </Text>
                <Stack gap={0}>
                  {trail.map((step, i) => (
                    <Text
                      key={`${step}-${i}`}
                      size="xs"
                      variant="muted"
                      className="font-mono break-all"
                    >
                      {step}
                    </Text>
                  ))}
                </Stack>
              </Stack>
            ) : null}

            {attachmentAssetIds.length > 0 ? (
              <Stack gap={1}>
                <Text size="sm" variant="muted">
                  {attachmentAssetIds.length}{' '}
                  {attachmentAssetIds.length === 1 ? 'attachment' : 'attachments'}
                </Text>
                <Text size="xs" variant="muted">
                  Inline previews arrive with the operator media proxy; asset ids are on record.
                </Text>
              </Stack>
            ) : null}
          </>
        )}
      </Stack>
    </Card>
  );
}
