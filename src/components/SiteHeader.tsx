import Link from 'next/link';
import { Castle } from 'lucide-react';
import { Suspense } from 'react';
import { HeaderSearch, NavLinks } from './HeaderParts';

const NAV = [
  { href: '/tracker', label: 'Upgrade Tracker' },
  { href: '/player/DEMO', label: 'Demo' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-brand text-bg">
            <Castle size={14} strokeWidth={2.5} aria-hidden />
          </span>
          CoC Stats
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {/* The active state needs the URL, which dynamic pages only know at request time. */}
          <Suspense fallback={NAV.map((n) => <NavLinkPlain key={n.href} {...n} />)}>
            <NavLinks items={NAV} />
          </Suspense>
        </nav>
        <HeaderSearch />
      </div>
    </header>
  );
}

function NavLinkPlain({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-md px-2.5 py-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink">
      {label}
    </Link>
  );
}
