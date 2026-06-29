import Link from 'next/link';
import { ChevronLeft, Wrench } from 'lucide-react';

import { requireSession } from '@sparx/auth';
import { Button, Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { ToolPolicyManager } from './_components/tool-policy-manager';
import type { ToolPolicyDto } from './_components/tool-types';

// AI → MCP tools. The full code-defined MCP tool catalog with each tool's
// effective exposure for this tenant — a per-tool allow/deny overlay on top of
// the module + scope gates (docs/07 §9). Disabling a tool hides it from EVERY
// connected assistant. The grouped list + toggles + reset live in the client
// <ToolPolicyManager>; this server page loads the catalog and frames it. Rose is
// the module identity (the /ai layout's <ModuleProvider module="ai">).

export const dynamic = 'force-dynamic';

export default async function AiToolsPage() {
  await requireSession();

  const tools = await api
    .get<ToolPolicyDto[]>('/v1/ai/tool-policies')
    .catch(() => [] as ToolPolicyDto[]);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <div>
          <Button asChild variant="link" color="module" size="sm" className="mb-2 -ml-2">
            <Link href="/ai">
              <ChevronLeft className="mr-0.5 h-3.5 w-3.5" />
              AI
            </Link>
          </Button>
          <PageHeader
            icon={<Wrench className="h-5 w-5" />}
            title="MCP tools"
            description="The tools your connected AI assistants may call. Disable any tool to hide it from every assistant — your scopes and active modules still apply on top."
          />
        </div>

        <ToolPolicyManager tools={tools} />
      </Stack>
    </Container>
  );
}
