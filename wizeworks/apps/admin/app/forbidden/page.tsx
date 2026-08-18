import Link from 'next/link';
import { Button, Card, Heading, Stack, Text } from '@wizeworks/ui';

// Where requireCapability() sends an operator who is signed in but lacks the
// capability for a surface. Deliberately outside the (console) group so it never
// re-triggers the session gate.
export default function ForbiddenPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-8">
      <Card>
        <Stack gap={4} className="max-w-md">
          <Heading level={2}>Not authorized</Heading>
          <Text variant="muted">
            Your operator account doesn&apos;t have the capability required for this area. Ask a
            super admin if you need access.
          </Text>
          <Button variant="soft" asChild>
            <Link href="/">Back to console</Link>
          </Button>
        </Stack>
      </Card>
    </div>
  );
}
