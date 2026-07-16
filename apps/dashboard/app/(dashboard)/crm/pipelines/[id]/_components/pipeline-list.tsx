// Pipeline list view — flat table of every open deal in the pipeline,
// sortable by stage / value / close date. Server component; re-fetches on
// each view switch.

import Link from 'next/link';

import { Badge, Card, CardBody, EmptyState, Table } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';

import { stageColor } from './kanban-types';

interface PipelineStage {
  id: string;
  name: string;
  color: string | null;
  stageType: 'open' | 'won' | 'lost';
}

interface Pipeline {
  id: string;
  stages: PipelineStage[];
}

interface DealRow {
  id: string;
  title: string;
  stageId: string;
  currency: string;
  value: string | number;
  probability: string | number;
  expectedCloseDate: string | null;
  updatedAt: string;
}

interface PipelineListProps {
  pipelineId: string;
}

export async function PipelineList({ pipelineId }: PipelineListProps) {
  const [{ data: deals }, pipeline] = await Promise.all([
    api.getPaged<DealRow[]>(`/v1/crm/deals?pipeline_id=${pipelineId}&take=250`),
    api.get<Pipeline>(`/v1/crm/pipelines/${pipelineId}`),
  ]);
  const stagesById = new Map(pipeline.stages.map((s) => [s.id, s]));

  if (deals.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No deals yet"
          description="Create a deal to start tracking opportunities through this pipeline."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <Table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Stage</th>
              <th className="text-right">Value</th>
              <th className="text-right">Probability</th>
              <th>Expected close</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => {
              const stage = stagesById.get(d.stageId);
              return (
                <tr key={d.id}>
                  <td>
                    <Link
                      href={`/crm/deals/${d.id}`}
                      className="hover:text-module text-sm font-medium hover:underline"
                    >
                      {d.title}
                    </Link>
                  </td>
                  <td>
                    {stage && (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: stageColor(stage),
                          color: stageColor(stage),
                        }}
                      >
                        {stage.name}
                      </Badge>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {d.currency} {Number(d.value).toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums">{Number(d.probability)}%</td>
                  <td>
                    <p className="text-base-content text-sm">
                      {d.expectedCloseDate
                        ? new Date(d.expectedCloseDate).toLocaleDateString()
                        : '—'}
                    </p>
                  </td>
                  <td>
                    <p className="text-base-content text-sm">
                      {new Date(d.updatedAt).toLocaleDateString()}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </CardBody>
    </Card>
  );
}
