'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { ExternalLink, Globe } from 'lucide-react';
import { industryOf, type StoryState } from '@wizeworks/story-schemas';
import { storefrontPreviewUrl, type OnboardingActions } from '../../../lib/onboarding/api';
import { handleSlug } from '../../../lib/onboarding/story-state';
import type { WizardBlueprint } from '../../../lib/onboarding/types';

// The story's "go live" chapter — the SAME publish beat the wizard calls Launch, told
// as the closing line of the owner's story. It keeps the real work (a live preview of
// the private draft, the monthly savings, the publish that the summary CTA fires) but
// drops the wizard's generic marketing wall for a warm, first-person send-off in the
// compose phase's voice + surface.

const SITE_ZONE = 'sparx.zone';

function usd(n: number): string {
  return n.toLocaleString('en-US');
}

function subjectNoun(story: StoryState): string {
  const noun = story.industry ? industryOf(story.industry).noun : 'a business';
  return noun.replace(/^an? /, '');
}

/** A plain-language recap of what the starting point already dropped into the site. */
function contentFacts(bp: WizardBlueprint | null): string[] {
  if (!bp) return [];
  const c = bp.contents;
  const facts: string[] = [];
  if (c.pages > 0) facts.push(`${String(c.pages)} pages`);
  if (c.products > 0) facts.push(`${String(c.products)} products`);
  if (c.content > 0) facts.push(`${String(c.content)} posts`);
  if (c.emails > 0) facts.push(`${String(c.emails)} emails`);
  return facts;
}

export function StoryGoLive({
  story,
  installId,
  blueprint,
  builderEnabled,
  published,
  moduleCount,
  monthlyTotal,
  monthlyElsewhere,
  actions,
}: {
  story: StoryState;
  installId: string | null;
  blueprint: WizardBlueprint | null;
  builderEnabled: boolean;
  published: boolean;
  moduleCount: number;
  monthlyTotal: number;
  monthlyElsewhere: number;
  actions: OnboardingActions;
}): ReactNode {
  const slug = handleSlug(story.name);
  const host = `${slug}.${SITE_ZONE}`;
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!installId) return;
    let active = true;
    void actions
      .getPreviewToken()
      .then((t) => {
        if (active) setToken(t);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [installId, actions]);

  if (published) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <Heading level={2} className="text-2xl font-semibold tracking-tight">
          And… you’re live.
        </Heading>
        <Text className="max-w-[58ch] text-base">
          Your story is out in the world at <span className="font-medium">{host}</span> — opening
          your workspace now so you can keep shaping it.
        </Text>
        <Button
          color="module"
          variant="link"
          size="lg"
          iconEnd={<ExternalLink className="size-4" aria-hidden />}
          className="self-start"
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

  const monthlySavings = Math.max(0, monthlyElsewhere - monthlyTotal);
  const annualSavings = monthlySavings * 12;
  const facts = contentFacts(blueprint);
  const previewHref = installId && token ? storefrontPreviewUrl(slug, token) : null;

  return (
    <div className="flex min-w-0 flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <Heading level={2} className="text-2xl font-semibold tracking-tight">
          {installId ? 'This is the moment — your story goes live' : 'Your workspace is ready'}
        </Heading>
        <Text className="max-w-[58ch] text-base">
          {installId ? (
            <>
              {blueprint ? (
                <>
                  Your <span className="font-medium">{blueprint.name}</span> starting point is
                  waiting as a private draft
                  {facts.length > 0 ? <> — {facts.join(', ')}, all in place</> : null}.{' '}
                </>
              ) : (
                <>Your site is waiting as a private draft. </>
              )}
              Publish it and <span className="font-medium">{host}</span> is live for the world.
              Nothing locks — keep shaping your {subjectNoun(story)} in the Builder whenever the
              mood strikes.
            </>
          ) : builderEnabled ? (
            <>
              You’re starting from a blank canvas. Finish setup to open the Builder and design your{' '}
              {subjectNoun(story)} — publish the moment it feels right.
            </>
          ) : (
            <>Everything is set up and ready to use. Finish setup to head into your workspace.</>
          )}
        </Text>
      </div>

      {/* The web address is the focal point of "going live" — it stays here, front and
          center, whether or not there's a draft to preview yet. When there IS a draft
          (installId), the card also offers a peek at it before it goes public. */}
      <div className="border-base-300 flex items-center justify-between gap-4 rounded-xl border px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Globe className="text-module size-4 shrink-0" aria-hidden />
          <span className="truncate font-medium">{host}</span>
        </div>
        {previewHref ? (
          <Button
            variant="outline"
            color="module"
            size="sm"
            iconEnd={<ExternalLink className="size-3.5" aria-hidden />}
            render={
              <a
                href={previewHref}
                target="_blank"
                rel="noreferrer"
                aria-label="Preview your site in a new tab"
              />
            }
          >
            Take a look
          </Button>
        ) : null}
      </div>

      {monthlySavings > 0 ? (
        <div className="flex flex-col gap-1">
          <Text className="max-w-[58ch] text-base">
            And here’s the quiet part of the story: you’re running{' '}
            <span className="font-medium">
              {String(moduleCount)} {moduleCount === 1 ? 'tool' : 'tools'}
            </span>{' '}
            on one platform for <span className="font-medium">${usd(monthlyTotal)}/mo</span> after
            your free trial — saving{' '}
            <span className="text-success font-medium">${usd(monthlySavings)}/mo</span>, about{' '}
            <span className="font-medium">${usd(annualSavings)}</span> a year, versus stitching them
            together elsewhere.
          </Text>
        </div>
      ) : null}
    </div>
  );
}
