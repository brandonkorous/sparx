'use client';

// One campaign, as a row in the list.
//
// Rows and not tiles: a campaign has no picture, and what tells two apart is the
// name, the state, and the shape of its ladder.

import { Badge, Heading, Text } from '@wizeworks/silicaui-react';
import { KIND_LABEL, statusMeta } from './presentation';
import type { Funnel } from './types';

/**
 * The ladder as a strip of step names, so a row shows the SHAPE of a campaign
 * without fetching its numbers.
 *
 * No counts here on purpose: per-row figures would be one request per row.
 */
function StageStrip({ funnel }: { funnel: Funnel }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {funnel.stages.map((stage, index) => (
        <span key={stage.key} className="flex items-center gap-1">
          {index > 0 ? <span aria-hidden>›</span> : null}
          <Badge color={stage.kind === 'convert' ? 'module' : 'info'} variant="soft" size="sm">
            {stage.name}
          </Badge>
        </span>
      ))}
    </div>
  );
}

export function CampaignRow({
  funnel,
  onOpen,
}: {
  funnel: Funnel;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const meta = statusMeta(funnel.status);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="border-base-300 bg-base-100 hover:border-module flex w-full cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition-colors"
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Heading level={3} className="text-base font-semibold">
            {funnel.name}
          </Heading>
          <Badge color={meta.tone} variant="soft" size="sm">
            {meta.label}
          </Badge>
          <div className="flex-1" />
          <Text className="text-sm">{KIND_LABEL[funnel.kind]}</Text>
        </div>

        {funnel.description ? <Text className="text-sm">{funnel.description}</Text> : null}

        <StageStrip funnel={funnel} />
      </button>
    </li>
  );
}
