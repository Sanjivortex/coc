import Link from 'next/link';
import { CircleAlert, SearchX } from 'lucide-react';
import { buttonClass } from './ui/styles';

export function ApiError({ reason, message, tag }: { reason: string; message: string; tag: string }) {
  const notFound = reason === 'notFound';
  const Icon = notFound ? SearchX : CircleAlert;
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-line bg-panel p-8 text-center">
      <Icon size={28} className="mx-auto text-ink-3" aria-hidden />
      <h1 className="mt-4 text-lg font-semibold">{notFound ? 'No account with this tag' : 'Could not load this profile'}</h1>
      <p className="mt-2 text-[13px] text-ink-2">
        <span className="font-mono text-ink">#{tag}</span> · {message}
      </p>
      {reason === 'noToken' && (
        <ol className="mx-auto mt-5 max-w-sm list-decimal space-y-1.5 pl-5 text-left text-[13px] text-ink-2">
          <li>
            Create a key on{' '}
            <a className="text-ink underline underline-offset-2" href="https://developer.clashofclans.com" target="_blank" rel="noreferrer">
              developer.clashofclans.com
            </a>{' '}
            for your server&apos;s IP.
          </li>
          <li>
            Put it in <code className="rounded bg-raised px-1 text-ink">.env.local</code> as <code className="rounded bg-raised px-1 text-ink">COC_API_TOKEN</code> and
            restart.
          </li>
        </ol>
      )}
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className={buttonClass('secondary', 'sm')}>
          New search
        </Link>
        <Link href="/player/DEMO" className={buttonClass('primary', 'sm')}>
          Try the demo
        </Link>
      </div>
    </div>
  );
}
