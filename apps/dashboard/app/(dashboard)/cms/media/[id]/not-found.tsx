// Friendly not-found for media assets. Without this, Next.js falls through
// to the framework default 404 chrome with no sparx nav (audit F-34). Keeping
// the user inside the CMS subtree so they can back out to the media library
// with one click.

import Link from 'next/link';
import { Button, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';
import { ImageOff } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <Card className="bg-module bg-soft">
          <CardBody>
            <EmptyState
              icon={<ImageOff className="h-5 w-5" />}
              title="Asset not found"
              description="This media asset doesn't exist, was deleted, or belongs to a different tenant. Head back to the library to find what you need."
              actions={
                <Button color="module" render={<Link href="/cms/media" />}>
                  Back to media library
                </Button>
              }
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
