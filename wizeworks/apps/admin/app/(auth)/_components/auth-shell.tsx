import { Card, Heading, Stack, Text } from '@wizeworks/ui';
import { Wordmark } from '@wizeworks/brand/react';

// Centered single-column auth chrome for the operator console — deliberately
// plain (an internal tool, not a marketing split-panel).
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh place-items-center p-8">
      <Stack gap={6} className="w-full max-w-sm">
        <Stack gap={1} align="center">
          <Wordmark size={28} />
          <Text size="sm" variant="muted">
            Operator Console
          </Text>
        </Stack>
        <Card>
          <Stack gap={5}>
            <Stack gap={1}>
              <Heading level={2}>{title}</Heading>
              {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
            </Stack>
            {children}
          </Stack>
        </Card>
      </Stack>
    </div>
  );
}
