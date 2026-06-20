// Forge generator — shared copy DATA (no nodes), so the home page and the secondary
// pages stay in sync from one source: the four disciplines, the four process phases, and
// the three partner testimonials. The page modules map these through the section builders
// in sections.ts. (Project cards stay inline in their pages — their gradient thumbs are
// node builders, not plain data.)

export const SERVICES = [
  {
    num: '01',
    title: 'Brand & Identity',
    desc: 'Positioning, naming, visual identity, and brand systems that make ambitious companies impossible to ignore.',
  },
  {
    num: '02',
    title: 'Web Design & Dev',
    desc: 'Conversion-focused marketing sites and product UI — designed, built, and launched on a modern stack.',
  },
  {
    num: '03',
    title: 'Growth Marketing',
    desc: 'Performance creative, SEO, lifecycle, and CRO programs that turn a great launch into compounding pipeline.',
  },
  {
    num: '04',
    title: 'Motion & 3D',
    desc: 'Story-driven motion, product animation, and real-time 3D that make digital experiences feel alive.',
  },
] as const;

export const PHASES = [
  { phase: 'Phase 01', title: 'Discover', desc: 'Audits, stakeholder interviews, and market research to find the real opportunity.' },
  { phase: 'Phase 02', title: 'Define', desc: 'Strategy, positioning, and a creative direction the whole team rallies behind.' },
  { phase: 'Phase 03', title: 'Design', desc: 'Identity, interfaces, and motion crafted to spec — pixel-tight and on-brand.' },
  { phase: 'Phase 04', title: 'Deploy', desc: 'Build, launch, measure, iterate — we stay on as your growth partner.' },
] as const;

export const TESTIMONIALS = [
  {
    quote: 'They didn’t just redesign our site — they rebuilt how the market sees us. Pipeline doubled in two quarters.',
    initials: 'RV',
    name: 'Renata Voss',
    role: 'VP Marketing, Vela',
    avatarCls: 'bg-[#C6F24E]',
  },
  {
    quote: 'The most thoughtful, fastest-moving design team we’ve worked with. Every deliverable raised the bar.',
    initials: 'DC',
    name: 'Daniel Cho',
    role: 'CEO, Contoso',
    avatarCls: 'bg-[#FF6A3D]',
  },
  {
    quote: 'From brand to launch in twelve weeks, with a site that finally feels like the company we’re becoming.',
    initials: 'MA',
    name: 'Mara Aldous',
    role: 'Founder, Aperture',
    avatarCls: 'bg-[#5C97E8]',
  },
] as const;
