// Client-safe DTO shapes for the Automations surface.
//
// The REST surface (`/v1/automations`) returns raw Prisma rows; over the wire
// every `DateTime` is an ISO string and the JSON columns
// (`triggerConfig` / `conditions` / `actions`) arrive as plain JSON. These DTOs
// type that wire shape so list/detail/builder components don't reach for the
// Prisma client (server-only). The rich rule document is parsed from the JSON
// columns with the canonical `@sparx/automation-schemas` parsers — no drift.

import type {
  AutomationOrigin,
  AutomationStatus,
  GateLogEntry,
  RunStatus,
  StepStatus,
} from '@sparx/automation-schemas';

export interface AutomationDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: AutomationStatus;
  triggerType: string;
  triggerConfig: unknown;
  conditions: unknown;
  actions: unknown;
  aiGenerated: boolean;
  aiPrompt: string | null;
  origin: AutomationOrigin;
  locked: boolean;
  clonedFrom: string | null;
  maxDepth: number;
  runCount: number;
  errorCount: number;
  lastRunAt: string | null;
  lastErrorAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunDto {
  id: string;
  automationId: string;
  status: RunStatus;
  causeDepth: number;
  cursorIndex: number;
  resumeAt: string | null;
  actionsTotal: number;
  errorMessage: string | null;
  triggerEvent: unknown;
  dedupeKey: string;
  startedAt: string;
  completedAt: string | null;
}

export interface RunStepDto {
  id: string;
  runId: string;
  actionIndex: number;
  actionType: string;
  status: StepStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  gateLog: GateLogEntry[] | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface RunWithStepsDto extends RunDto {
  steps: RunStepDto[];
}
