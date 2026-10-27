import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import { GAME_DATA_SOURCE } from '@/lib/gamedata';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'CoC Stats – Clash of Clans progress and upgrade planner', template: '%s · CoC Stats' },
  description:
    'Player stats from the Clash of Clans API and an upgrade planner for builders, laboratory and pets, with potions, Gold Pass and Hammer Jam.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-ink-3 sm:flex-row sm:justify-between sm:px-6">
            <p>
              This material is unofficial and is not endorsed by Supercell. For more information see Supercell&apos;s{' '}
              <a className="underline underline-offset-2 hover:text-ink" href="https://www.supercell.com/fan-content-policy" target="_blank" rel="noreferrer">
                Fan Content Policy
              </a>
              .
            </p>
            <p>Upgrade data: {GAME_DATA_SOURCE} (Clash of Clans Wiki)</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
