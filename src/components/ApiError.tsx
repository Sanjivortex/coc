import Link from 'next/link';

export function ApiError({ reason, message, tag }: { reason: string; message: string; tag: string }) {
  return (
    <div className="card mx-auto max-w-xl p-6 text-center">
      <h1 className="font-display text-2xl tracking-wide">{reason === 'notFound' ? 'Not found' : 'Could not load data'}</h1>
      <p className="mt-2 text-sm text-muted">
        <span className="font-mono text-ink">#{tag}</span> – {message}
      </p>
      {reason === 'noToken' && (
        <ol className="mx-auto mt-4 max-w-md list-decimal space-y-1 pl-5 text-left text-sm text-muted">
          <li>
            Create a key on{' '}
            <a className="text-accent underline-offset-4 hover:underline" href="https://developer.clashofclans.com" target="_blank" rel="noreferrer">
              developer.clashofclans.com
            </a>{' '}
            with your server&apos;s IP (or 45.79.218.79 for the RoyaleAPI proxy).
          </li>
          <li>
            Put it in <code className="text-ink">.env.local</code> as <code className="text-ink">COC_API_TOKEN=…</code> and restart.
          </li>
        </ol>
      )}
      <div className="mt-5 flex justify-center gap-2 text-sm">
        <Link href="/" className="rounded-xl bg-surface-2 px-4 py-2 hover:text-accent">
          New search
        </Link>
        <Link href="/player/DEMO" className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink">
          Demo profile
        </Link>
      </div>
    </div>
  );
}
