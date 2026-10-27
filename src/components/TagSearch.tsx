'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { normalizeTag, tagSlug } from '@/lib/format';

export function TagSearch() {
  const router = useRouter();
  const [mode, setMode] = useState<'player' | 'clan'>('player');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const tag = normalizeTag(value);
    if (!tag) {
      setError('That does not look like a tag. Tags use only 0 2 8 9 P Y L Q G R J C U V, e.g. #2PP.');
      return;
    }
    setError(null);
    router.push(`/${mode}/${tagSlug(tag)}`);
  };

  return (
    <form onSubmit={submit} className="card w-full max-w-xl p-2">
      <div className="mb-2 flex gap-1 p-1 text-sm">
        {(['player', 'clan'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg px-3 py-1.5 font-medium capitalize transition ${
              mode === m ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {m} tag
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === 'player' ? '#YOURTAG (Profile → tag under your name)' : '#CLANTAG'}
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 font-mono uppercase tracking-wider outline-none placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-accent"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label={`${mode} tag`}
        />
        <button type="submit" className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:brightness-110">
          Search
        </button>
      </div>
      {error && <p className="px-2 pt-2 text-sm text-danger">{error}</p>}
    </form>
  );
}
