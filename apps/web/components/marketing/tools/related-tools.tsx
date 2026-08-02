import { Heading, Text } from '@wizeworks/silicaui-react';
import { Band } from '../band';
import { relatedTools } from './registry';
import { ToolCard } from './tool-card';

/** "More free tools" strip shown at the foot of every tool page. */
export function RelatedTools({ currentSlug }: { currentSlug: string }) {
  const tools = relatedTools(currentSlug);
  if (tools.length === 0) return null;

  return (
    <Band tone="page">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <Heading level={2} size="display" className="text-4xl tracking-tight sm:text-5xl">
            More free tools
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="max-w-3xl">
            Every one of them runs entirely in your browser — free, no account, nothing uploaded.
          </Text>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </div>
    </Band>
  );
}
