// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's `cloneElement(render, …)` then throws at prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { SparkMascot } from '@/components/marketing/spark-mascot';

// 404 for the marketing site. The spark mascot carries the "nothing here" beat
// with an expression instead of a mono eyebrow — same brand character as the
// hero, reused as a state (see components/marketing/spark-mascot.tsx).
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <div className="max-w-[460px] text-center">
        <div className="mb-6 flex justify-center">
          <SparkMascot expression="surprised" tone="light" size={120} bob={false} />
        </div>
        <h1 className="m-0 mb-2.5 text-3xl font-semibold">This page wandered off</h1>
        <p className="text-md m-0 mb-6">
          We couldn&apos;t find what you were looking for. It may have moved, or never existed.
        </p>
        <a href="/" className={buttonClasses({ color: 'primary' })}>
          Back to sparx
        </a>
      </div>
    </main>
  );
}
