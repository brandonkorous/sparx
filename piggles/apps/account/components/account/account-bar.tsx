import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Logo } from '@piggles/brand/react';
import { AppearanceControl } from '@/components/appearance-control';

/** The account page's top row: the logo, then the way out and the way to work. */
export function AccountBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <Logo />
      {/* `flex-wrap` here too, or the controls overflow a 360px screen. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <AppearanceControl />
        {/* A form: signing out changes state, so no prefetch or crawler may reach it. */}
        <form action="/sign-out" method="post">
          <button className={buttonClasses({ variant: 'ghost' })} type="submit">
            Sign out
          </button>
        </form>
        {/* A plain <a>: `/handoff` 303s to another origin, which a <Link> fetch fails. */}
        <a className={buttonClasses({ color: 'primary' })} href="/handoff">
          Go to my business
        </a>
      </div>
    </div>
  );
}
