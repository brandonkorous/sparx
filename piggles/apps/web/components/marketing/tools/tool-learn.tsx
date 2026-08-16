import type { PigglesTool } from './registry';
import { FaqSection, Section } from '@piggles/ui';
import { toolFaqs, toolLearn } from './tool-content';

/**
 * The reading matter under the tool.
 *
 * Placed AFTER the thing somebody came for, never before it. The convention in
 * this genre is eight hundred words of preamble above the tool, on the theory
 * that search engines want text near the top; what it actually does is make
 * somebody scroll past an essay to reach a file picker, which is the most
 * reliable way to teach a visitor that your site wastes their time.
 *
 * So the tool is first. The explanation is for the person who finished, or who
 * scrolled down because they did not understand what they were looking at — and
 * it is written for that person rather than for a crawler (see the note at the
 * top of tool-content.ts).
 *
 * The layout is the site's own two-column reading shape: the section title on
 * the left, the prose in a measured column beside it. Long-form text set across
 * the full width of a 1280px page is unreadable regardless of how good it is.
 */
export function ToolLearn({ tool }: { tool: PigglesTool }) {
  const sections = toolLearn(tool.slug);
  const faqs = toolFaqs(tool.slug);
  if (sections.length === 0 && faqs.length === 0) return null;

  return (
    <>
      {sections.length > 0 ? (
        <Section>
          <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
            <div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">
                What this is, if you have never had to think about it
              </h2>
              <p className="mt-6 text-lg">
                Most people arrive here having been told they need one of these, without being told
                what it is. Nothing below assumes you already know.
              </p>
            </div>
            {/* `text-lg` — 18px, the reading size from DESIGN.md §3. These are
 paragraphs somebody actually reads through, not captions. */}
            <div className="flex flex-col gap-10 lg:col-span-2">
              {sections.map((s) => (
                <div key={s.title} className="max-w-2xl">
                  <h3 className="text-xl font-bold">{s.title}</h3>
                  <p className="mt-3 text-lg">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* A SIBLING of the reading section, not a child: FaqSection brings its
          own gutter and max-width, and nesting it doubled both. */}
      {faqs.length > 0 ? <FaqSection heading="Questions people ask" items={faqs} /> : null}
    </>
  );
}
