import { Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { Band } from '../band';
import { MODULES } from '../modules-catalog';
import type { Vertical } from './registry';

/**
 * The six things this kind of business actually needs done.
 *
 * Written as OUTCOMES, never as feature names — "Bays booked, not
 * double-booked", not "resource-constrained appointment scheduling". The reader
 * is a business owner, not a buyer of software categories, and the fastest way
 * to lose them is a noun they would have to look up (see the
 * `feedback_non_technical_audience` house rule).
 *
 * Each card carries the badge of the module that does the job, which does two
 * things at once: it colors the grid by function rather than decorating it,
 * and it ties every claim here to a line the reader is about to see priced in
 * the table below. Nothing is promised on this page that is not paid for on it.
 *
 * ## Mosaic, not a grid
 *
 * `columns-*` rather than `grid`, because these cards are different heights and
 * a grid has to reconcile a row: one long card leaves five short ones with dead
 * space underneath. A multi-column flow has no rows to reconcile, so the gaps
 * close themselves. `break-inside-avoid` keeps a card whole across the column
 * break, and the bottom margin lives on the CARD — the container's height
 * already excludes its last child's margin, so no negative margin is needed to
 * correct for it.
 */
export function VerticalJobs({ vertical }: { vertical: Vertical }) {
  return (
    <Band tone="surface">
      <div className="flex flex-col gap-12">
        <div className="flex max-w-3xl flex-col gap-5">
          <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
            {`What ${vertical.plural} actually need`}
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="text-xl">
            Not a tour of everything the platform can do — the six jobs that decide whether the week
            runs smoothly, and the part of sparx that does each one.
          </Text>
        </div>

        <div className="columns-1 gap-5 lg:columns-2">
          {vertical.jobs.map((job) => {
            const entry = MODULES.find((m) => m.id === job.module);
            return (
              <Card
                key={job.title}
                // `bg-base-200` against the band's white `surface`: a card must
                // take the OPPOSITE tone of the band it sits in or it does not
                // read as a card at all. `shadow-none` because this house
                // separates surfaces with edges and tone, not shadows.
                className="border-base-300 bg-base-200 mb-5 w-full break-inside-avoid border shadow-none"
              >
                <CardBody className="flex flex-col items-start gap-4">
                  <Badge color={`module-${job.module}`} variant="solid" size="md">
                    {entry?.label ?? job.module}
                  </Badge>
                  <Heading level={3} size={3} className="tracking-tight">
                    {job.title}
                  </Heading>
                  <Text className="text-lg">{job.body}</Text>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </Band>
  );
}
