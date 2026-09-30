'use client';

// Her website is live and it is still showing somebody else's words.
//
// A design is COPIED into a site when it is installed, so what goes live on day
// one is real content under her own name: example words on every page, example
// products with prices and a working Add to cart, and example articles in the
// Journal. That is the right way to build it — a site that is empty on day one
// teaches nobody anything — and it stops being right the moment she publishes.
//
// Measured on a real business. The Marrow Review is a reader-funded magazine of
// ideas, live and public and paid for. Its Journal carried three platform
// marketing articles under its own masthead ("How to launch your online store in
// a weekend") and its shop sold thirteen sample products with working Add to
// cart. A stranger learned nothing about the magazine and could buy an enamel
// pin from a literary review. Nothing in the product had ever mentioned it.
//
// ── WHAT THIS IS AND IS NOT ────────────────────────────────────────────────
//
// It is an OFFER, a sibling of the template-update and site-behind panels, and
// it sits with them for the same reason: nothing is late, nothing is waiting on
// her, and folding it into "What needs you" would put it in the quiet line as
// one more thing to be reassured about.
//
// It changes nothing and hides nothing. The examples stay exactly where they
// are: she may have wanted them, and a thing this panel says nothing about is a
// thing she has already made hers.
//
// ONLY ONCE SHE IS PUBLISHED. Before that, the example content is doing its job
// — it is how a new site looks like a site while she works on it — and telling
// her to clear it out would be telling her to empty her own shop window before
// she has anything to put in it.
//
// ONE OFFER AT A TIME, examples before pages. An unedited About page says
// nothing about the business; an unedited shop sells an invented brand's mug to
// the business's customers. Two boxes on Home saying "your site is not yours
// yet" is a wall she scrolls past.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { ModuleScope } from '@/components/module-scope';
import type { SurfaceContext } from '@/lib/surfaces/registry';
import { usePublishState } from '@/lib/studio/publish-data';
import { useBlueprints } from '../builder/blueprints-data';
import {
  namedFew,
  useUntouched,
  type UntouchedArtifact,
  type UntouchedReport,
} from '../builder/blueprints-untouched';

/** Where the things she would change actually live, so the button lands on them
 *  rather than on a page describing them. */
function roadFor(examples: UntouchedArtifact[]): { surface: string; label: string } {
  const hasProducts = examples.some((e) => e.kind === 'product');
  if (hasProducts) return { surface: 'commerce.products.list', label: 'Show me what I am selling' };
  return { surface: 'cms.content.list', label: 'Show me what I am publishing' };
}

function ExampleOffer({ report, ctx }: { report: UntouchedReport; ctx: SurfaceContext }) {
  const products = report.examples.filter((e) => e.kind === 'product');
  const articles = report.examples.filter((e) => e.kind === 'content');
  const road = roadFor(report.examples);

  return (
    <ModuleScope module="builder">
      {/* Solid at 16px and stacked until the pane is wide enough for both, the
          same as its two siblings — `.alert` is a flex row that never wraps and
          its message column may shrink to nothing (issue 258). */}
      <Alert color="module" className="mt-6 flex-col text-base @[34rem]:flex-row">
        <AlertContent>
          <AlertTitle>Your website is still showing the example things it came with</AlertTitle>
          <AlertDescription>
            {products.length > 0 ? (
              <>
                Your shop is selling <strong>{namedFew(products)}</strong>. Those came with your
                design as examples, and anyone visiting can buy one.{' '}
              </>
            ) : null}
            {articles.length > 0 ? (
              <>
                You are publishing <strong>{namedFew(articles)}</strong>, which were written as
                examples rather than by you.{' '}
              </>
            ) : null}
            Change them to your own, or take them down. Nothing happens to them until you say so.
          </AlertDescription>
        </AlertContent>
        <AlertActions>
          <Button
            size="sm"
            onClick={() => {
              ctx.open(road.surface, undefined, { target: 'tab' });
            }}
          >
            {road.label}
          </Button>
        </AlertActions>
      </Alert>
    </ModuleScope>
  );
}

function PageOffer({ report, ctx }: { report: UntouchedReport; ctx: SurfaceContext }) {
  return (
    <ModuleScope module="builder">
      <Alert color="module" className="mt-6 flex-col text-base @[34rem]:flex-row">
        <AlertContent>
          <AlertTitle>Some of your pages still have the example words on them</AlertTitle>
          <AlertDescription>
            <strong>{namedFew(report.pages)}</strong>{' '}
            {report.pages.length === 1 ? 'still says' : 'still say'} what your design came with, and
            your site is live, so that is what a visitor reads. Nothing is wrong with them. They are
            just not about you yet.
          </AlertDescription>
        </AlertContent>
        <AlertActions>
          <Button
            size="sm"
            onClick={() => {
              ctx.open('builder.page', undefined, { target: 'tab' });
            }}
          >
            Write my own
          </Button>
        </AlertActions>
      </Alert>
    </ModuleScope>
  );
}

function InstallOffer({ installId, ctx }: { installId: string; ctx: SurfaceContext }) {
  const { data: publish } = usePublishState();
  // Before she publishes, the examples are doing their job.
  const live = publish ? !publish.neverPublished : false;
  const { data: report } = useUntouched(installId, live);

  if (!live || !report || report.total === 0) return null;
  if (report.examples.length > 0) return <ExampleOffer report={report} ctx={ctx} />;
  if (report.pages.length > 0) return <PageOffer report={report} ctx={ctx} />;
  return null;
}

/** Renders nothing at all when she has made the site hers — which is the case
 *  this panel is trying to reach, and it should cost a reader nothing when it
 *  arrives. */
export function StillTheExamplePanel({ ctx }: { ctx: SurfaceContext }) {
  const { data } = useBlueprints({ installedOnly: true, take: 20, skip: 0 });
  const installed = (data?.items ?? [])
    .map((b) => b.install?.id)
    .filter((id): id is string => Boolean(id));

  return (
    <>
      {installed.map((id) => (
        <InstallOffer key={id} installId={id} ctx={ctx} />
      ))}
    </>
  );
}
