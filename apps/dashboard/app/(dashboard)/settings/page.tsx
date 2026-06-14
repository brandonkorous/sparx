import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Container,
  Grid,
  PageHeader,
  Stack,
} from '@sparx/ui';
import { SETTINGS_NAV } from './nav';

export default function SettingsPage() {
  return (
    <Container size="xl">
      <Stack gap={8} className="py-10">
        <PageHeader
          title="Settings"
          description="Manage your site, team, and integrations. Each section will land here as the platform comes online."
        />

        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          {SETTINGS_NAV.map((g) => {
            const Icon = g.icon;
            return (
              <Card key={g.id}>
                <CardHeader>
                  <Stack direction="row" align="center" gap={2}>
                    <span aria-hidden className="text-[var(--color-text-secondary)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <CardTitle>{g.label}</CardTitle>
                    {!g.ready && <Badge variant="outline">Soon</Badge>}
                  </Stack>
                  <CardDescription>{g.description}</CardDescription>
                </CardHeader>
                <CardContent />
                <CardFooter>
                  {g.ready ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={g.href}>Open</Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>
                      Open
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </Grid>
      </Stack>
    </Container>
  );
}
