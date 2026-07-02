import { Nav } from '@/components/marketing/nav';
import { Hero } from '@/components/marketing/hero';
import { WhoeverYouAre } from '@/components/marketing/whoever-you-are';
import { AudienceStrip } from '@/components/marketing/audience-strip';
import { StackReplacement } from '@/components/marketing/stack-replacement';
import { ModulesGrid } from '@/components/marketing/modules-grid';
import { DashboardShowcase } from '@/components/marketing/dashboard-showcase';
import { McpSpotlight } from '@/components/marketing/mcp-spotlight';
import { Permanence } from '@/components/marketing/permanence';
import { Promise as PromiseSection } from '@/components/marketing/promise';
import { B2bSpotlight } from '@/components/marketing/b2b-spotlight';
import { Testimonial } from '@/components/marketing/testimonial';
import { CompareTable } from '@/components/marketing/compare-table';
import { Pricing } from '@/components/marketing/pricing';
import { Faq } from '@/components/marketing/faq';
import { FinalCta } from '@/components/marketing/final-cta';
import { Footer } from '@/components/marketing/footer';

// Homepage narrative (grab → convince → prove → convert):
//   Hero + WhoeverYouAre     — the purple brand band (locked visual unit; the
//                              video's rounded corners cap the band into content)
//   AudienceStrip            — honest "who it's for" breadth (no fake logos)
//   StackReplacement         — the cost/consolidation argument (the swap ledger)
//   ModulesGrid              — the module menu + capability depth (folds in the
//                              old EverythingIncluded count)
//   DashboardShowcase        — "one pane of glass" product proof
//   McpSpotlight + Permanence — one dark region: "AI builds it / sparx keeps it"
//                              (Permanence moved up from the tail to pair with MCP;
//                              Permanence carries the single proof-metric row)
//   Promise                  — the live-in-5-minutes timeline
//   B2bSpotlight             — a vertical done in depth
//   Testimonial              — the founder's note (honest, no fabricated proof)
//   CompareTable             — sparx vs a stitched stack (capability, not price)
//   Pricing → Faq → FinalCta — the offer, reassurance, and a clean closer
//
// Cut from the old page: the standalone EverythingIncluded (merged into the grid)
// and DeveloperSection (secondary audience; lives on /platform + /docs).
export default function HomePage() {
  return (
    <main className="mkt-paneled">
      <Nav />
      <Hero />
      <WhoeverYouAre />
      <AudienceStrip />
      <StackReplacement />
      <ModulesGrid />
      <DashboardShowcase />
      <McpSpotlight />
      <Permanence />
      <PromiseSection />
      <B2bSpotlight />
      <Testimonial />
      <CompareTable />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  );
}
