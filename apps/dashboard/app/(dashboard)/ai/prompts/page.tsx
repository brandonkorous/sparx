import Link from 'next/link';
import { ChevronLeft, MessageSquareText } from 'lucide-react';

import { requireSession } from '@sparx/auth';
import { PageHeader } from '@sparx/ui';
import { Button } from 'silicaui-react';

import { api } from '@/lib/api-rest-client';
import { PromptLibrary } from './_components/prompt-library';
import type { PromptTemplateDto } from './_components/prompt-types';

// AI → Prompt library. Reusable AI prompts your flows call, grouped by category
// with persona leading — the active enabled persona grounds the storefront chat
// assistant's voice. The list, create/edit drawer, and delete all live in the
// client <PromptLibrary>; this server page just loads the catalog and frames it.
// Rose is the module identity (the /ai layout's <ModuleProvider module="ai">).

export const dynamic = 'force-dynamic';

export default async function AiPromptsPage() {
  await requireSession();

  const prompts = await api
    .get<PromptTemplateDto[]>('/v1/ai/prompt-templates')
    .catch(() => [] as PromptTemplateDto[]);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <div>
          <Button
            variant="link"
            color="module"
            size="sm"
            className="mb-2 -ml-2"
            render={<Link href="/ai" />}
          >
            <ChevronLeft className="mr-0.5 h-3.5 w-3.5" />
            AI
          </Button>
          <PageHeader
            icon={<MessageSquareText className="h-5 w-5" />}
            title="Prompt library"
            description="Reusable AI prompts your flows can call. The active enabled persona is the voice your storefront chat assistant speaks in."
          />
        </div>

        <PromptLibrary prompts={prompts} />
      </div>
    </div>
  );
}
