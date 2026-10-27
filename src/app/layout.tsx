import type { Metadata } from 'next';
import { Geist, Geist_Mono, Lilita_One } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const lilita = Lilita_One({ variable: '--font-lilita', subsets: ['latin'], weight: '400' });

export const metadata: Metadata = {
  title: { default: 'CoC Stats – Clash of Clans progress & upgrade planner', template: '%s | CoC Stats' },
  description:
    'Enter your player tag to see heroes, pets, equipment, troops and defenses, and how long it takes to max your Town Hall with builder potions, Gold Pass and Hammer Jam.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${lilita.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="font-display text-2xl tracking-wide text-accent">
              CoC Stats
            </Link>
            <div className="ml-auto flex items-center gap-1 text-sm">
              <Link className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-ink" href="/">
                Search
              </Link>
              <Link className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-ink" href="/tracker">
                Upgrade Tracker
              </Link>
              <Link className="hidden rounded-lg px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-ink sm:block" href="/player/DEMO">
                Demo
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-line/70 px-4 py-6 text-center text-xs leading-relaxed text-muted">
          This material is unofficial and is not endorsed by Supercell. For more information see Supercell&apos;s{' '}
          <a className="underline hover:text-ink" href="https://www.supercell.com/fan-content-policy" target="_blank" rel="noreferrer">
            Fan Content Policy
          </a>
          . Game data: clash-of-clans-data (Clash of Clans Wiki).
        </footer>
      </body>
    </html>
  );
}
