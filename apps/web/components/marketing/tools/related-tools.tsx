import { Section, SectionHeader, getModuleColor } from '../primitives';
import { relatedTools } from './registry';
import { ToolCard } from './tool-card';

/** "More free tools" strip shown at the foot of every tool page. */
export function RelatedTools({ currentSlug }: { currentSlug: string }) {
  const tools = relatedTools(currentSlug);
  if (tools.length === 0) return null;

  return (
    <Section surface="surface" padding="lg">
      <div className="flex flex-col gap-8">
        <SectionHeader
          headline="More free tools"
          accent={getModuleColor('builder').color}
          lede="Every sparx tool runs entirely in your browser — free, no account, nothing uploaded."
          headlineSize={32}
        />
        <div className="mkt-grid-3-2-1">
          {tools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </div>
    </Section>
  );
}
