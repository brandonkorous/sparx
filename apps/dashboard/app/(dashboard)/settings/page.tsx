import Link from 'next/link';
import { PageHeader } from '@sparx/ui';
import { Badge, Button, Card, CardActions, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { SETTINGS_NAV } from './nav';

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 py-10">
        <PageHeader
          title="Settings"
          description="Manage your site, team, and integrations. Each section will land here as the platform comes online."
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SETTINGS_NAV.map((g) => {
            const Icon = g.icon;
            return (
              <Card key={g.id}>
                <CardBody>
                  <div className="flex flex-row items-center gap-2">
                    <span aria-hidden className="text-base-content/70">
                      <Icon className="h-4 w-4" />
                    </span>
                    <CardTitle>{g.label}</CardTitle>
                    {!g.ready && (
                      <Badge color="neutral" variant="soft" size="sm">
                        Soon
                      </Badge>
                    )}
                  </div>
                  <p className="opacity-70">{g.description}</p>
                  <CardActions className="justify-start">
                    {g.ready ? (
                      <Button variant="ghost" size="sm" render={<Link href={g.href} />}>
                        Open
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" disabled>
                        Open
                      </Button>
                    )}
                  </CardActions>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
