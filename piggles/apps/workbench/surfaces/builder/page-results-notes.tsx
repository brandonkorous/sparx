'use client';

// The caveats under the page report. Split from `page-results.tsx` under RULE
// #0.5: that file is the table, this is what has to be said about it.

import { Alert, AlertContent, AlertDescription, AlertTitle } from '@wizeworks/silicaui-react';

import { productCopyWith } from '../../lib/product';
import { formatCount, salesUntraced, type PageResultsReport } from './page-results-data';

/**
 * The caveats, stated where the numbers are rather than left for someone to
 * discover by being confused.
 *
 * Each one exists because leaving it out would make an honest number read as a wrong
 * one: sales are credited to the page that BROUGHT the buyer in, not the one they
 * checked out from; some visits belong to no row here at all; and a load time
 * measured on four visits is not a fact about the page.
 *
 * The leftovers note names checkout, the account area and dead addresses, NOT
 * products and posts, and not the cart or the sign-in page either. It used to name
 * products, which was true while a record template had no address and therefore no
 * row. Then it named cart and sign-in, which are ordinary pages with ordinary rows
 * — it was pointing at two rows on the screen and calling them absent. What is
 * actually left over is the checkout, the customer account area, and addresses
 * nothing is served at any more (persona issue 358).
 */
export function ReportFootnotes({ report }: { report: PageResultsReport | undefined }) {
  if (!report) return null;
  const otherViews = report.otherPaths.reduce((sum, row) => sum + row.views, 0);
  const untraced = salesUntraced(report);
  const placed = report.attribution.placed;

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Why every money column is a dash. It comes FIRST, above the explanation of
          how credit works, because the reader is looking at the dashes now and the
          model only matters once they know these are not zeros. */}
      {untraced ? (
        <Alert color="info" variant="soft">
          <AlertContent>
            <AlertTitle>
              {placed === 1
                ? 'Your one sale could not be tied to a page'
                : `None of your ${formatCount(placed)} sales could be tied to a page`}
            </AlertTitle>
            <AlertDescription>
              A sale is credited to a page only when the visit and the purchase happen on the same
              day, so somebody who looked on Tuesday and bought on Wednesday counts for nothing
              here, and neither does an order you took over the phone. That is why Bought and Sales
              read “—” rather than zero: nothing was measured, so there is nothing to report.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}
      {report.commerce ? (
        <p className="text-base">
          Sales are credited to the page that brought the buyer to your site that day — not the page
          they bought from. So your home page can earn credit for a sale that happened three clicks
          later, which is the point: that is the page that did the work.
        </p>
      ) : null}
      {otherViews > 0 ? (
        <p className="text-base">
          {productCopyWith(
            'builder.pages.otherViews',
            `Another ${formatCount(otherViews)} visits landed on addresses no page here owns: your checkout, the account area where customers look at their own orders, and any address that no longer has a page on it. They are counted in your traffic figures but have no row above.`,
            { count: formatCount(otherViews) }
          )}
        </p>
      ) : null}
      <p className="text-base">
        “Time to appear” is measured in your visitors&rsquo; own browsers, so a page nobody has
        opened has no measurement rather than a fast one.
      </p>
    </div>
  );
}
