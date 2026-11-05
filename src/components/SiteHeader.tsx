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
    <header className="sticky top-0 z-30 h-14 bg-bg/80 shadow-[0_1px_0_0_var(--line)] backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-b from-[#f7cf5e] to-[#e9a91f] text-[#231600] shadow-[0_2px_0_#8a5f00,0_0_18px_rgba(240,180,41,0.35)]">
            <Castle size={15} strokeWidth={2.5} aria-hidden />
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
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(240,180,41,0.4)] to-transparent" />
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
