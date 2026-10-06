'use client';

// The two small pieces of the Launch step: one value point, and the "You are
// live" view shown once the site is published.

import { Button, Text } from '@wizeworks/silicaui-react';
import { faArrowUpRightFromSquare, faRocket } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { storefrontPreviewUrl } from '../../../lib/onboarding/api';

export function ValuePoint({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-module soft mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm">{body}</p>
      </div>
    </div>
  );
}

export function LaunchSuccess({ slug, host }: { slug: string; host: string }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 text-center">
      <span className="bg-module flex size-14 items-center justify-center rounded-full">
        <Icon glyph={faRocket} className="text-module-content size-7" aria-hidden />
      </span>
      <h2 className="text-2xl font-semibold tracking-tight">You are live</h2>
      <Text className="max-w-prose">
        Your site is published and ready for the world. It is live at{' '}
        <span className="font-medium">{host}</span>, opening your workspace now.
      </Text>
      <Button
        color="module"
        variant="link"
        iconEnd={<Icon glyph={faArrowUpRightFromSquare} className="size-3.5" aria-hidden />}
        render={
          <a
            href={storefrontPreviewUrl(slug)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${host} in a new tab`}
          />
        }
      >
        {host}
      </Button>
    </div>
  );
}
