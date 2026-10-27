'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { normalizeTag, tagSlug } from '@/lib/format';
import { Segmented } from './ui/controls';
import { buttonClass } from './ui/styles';

export function TagSearch() {
  const router = useRouter();
  const [mode, setMode] = useState<'player' | 'clan'>('player');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const tag = normalizeTag(value);
    if (!tag) {
      setError('Tags use only 0 2 8 9 P Y L Q G R J C U V, for example #2PP.');
      return;
    }
    setError(null);
    router.push(`/${mode}/${tagSlug(tag)}`);
  };

  return (
    <form onSubmit={submit} className="w-full max-w-xl" role="search">
      <div className="mb-3 flex justify-center">
        <Segmented
          label="Search for"
          size="md"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'player', label: 'Player' },
            { value: 'clan', label: 'Clan' },
          ]}
        />
      </div>
      <div className={`flex items-center gap-2 rounded-xl border bg-panel p-1.5 pl-4 transition-colors focus-within:border-line-strong ${error ? 'border-critical' : 'border-line'}`}>
        <Search size={18} className="shrink-0 text-ink-3" aria-hidden />
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder={mode === 'player' ? 'Player tag, e.g. #9Y9PGP9VP' : 'Clan tag, e.g. #2PP'}
          aria-label={`${mode} tag`}
          aria-invalid={!!error}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="h-10 min-w-0 flex-1 bg-transparent font-mono text-[15px] uppercase outline-none placeholder:font-sans placeholder:normal-case placeholder:text-ink-3"
        />
        <button type="submit" className={buttonClass('primary', 'md', 'h-10 px-5')}>
          Search
        </button>
      </div>
      <p className={`mt-2 text-left text-[13px] ${error ? 'text-critical' : 'text-ink-3'}`} aria-live="polite">
        {error ?? 'Find your tag in the game under your name on the profile screen.'}
      </p>
    </form>
  );
}
